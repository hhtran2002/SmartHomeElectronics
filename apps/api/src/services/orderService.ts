import { getPool, sql } from '../config/database.js'

export type CheckoutItem = {
  skuId: number
  quantity: number
}

export type CheckoutOrderInput = {
  userId?: number
  customerName: string
  phone: string
  email: string
  province: string
  district: string
  ward: string
  streetAddress: string
  note: string
  paymentMethodId: number
  couponCode?: string
  items: CheckoutItem[]
}

type SkuSnapshot = {
  SkuId: number
  SkuCode: string
  Price: number
  FinalPrice: number
  DiscountAmount: number
  ProductName: string
  WarrantyMonths: number
  AvailableQuantity: number
  ProductId: number
  CategoryId: number
  BrandId: number
}

type PaymentMethodSnapshot = {
  PaymentMethodId: number
  MethodCode: string
  MethodName: string
}

export async function createCheckoutOrder(input: CheckoutOrderInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const paymentMethodResult = await tx()
      .input('paymentMethodId', sql.TinyInt, input.paymentMethodId)
      .query(`
        SELECT TOP (1) PaymentMethodId, MethodCode, MethodName
        FROM dbo.PaymentMethod
        WHERE PaymentMethodId = @paymentMethodId AND Status = 'Active'
      `)

    const paymentMethod = paymentMethodResult.recordset[0] as PaymentMethodSnapshot | undefined
    if (!paymentMethod) throw new Error('Phương thức thanh toán không hợp lệ.')

    const isPayLater = paymentMethod.MethodCode === 'COD'
    const orderStatusCode = isPayLater ? 'PendingConfirmation' : 'PendingPayment'
    const paymentStatusCode = 'Pending'

    const statusResult = await tx()
      .input('orderStatusCode', sql.VarChar(50), orderStatusCode)
      .input('paymentStatusCode', sql.VarChar(50), paymentStatusCode)
      .query(`
        SELECT
          (SELECT OrderStatusId FROM dbo.OrderStatus WHERE StatusCode = @orderStatusCode) AS OrderStatusId,
          (SELECT PaymentStatusId FROM dbo.PaymentStatus WHERE StatusCode = @paymentStatusCode) AS PaymentStatusId
      `)

    const orderStatusId = Number(statusResult.recordset[0]?.OrderStatusId)
    const paymentStatusId = Number(statusResult.recordset[0]?.PaymentStatusId)
    if (!orderStatusId || !paymentStatusId) throw new Error('Thiếu cấu hình trạng thái đơn hàng hoặc thanh toán.')

    let userId = input.userId
    if (!userId) {
      const existingUser = await tx()
        .input('phone', sql.VarChar(20), input.phone)
        .input('email', sql.VarChar(255), input.email || null)
        .query(`
          SELECT TOP (1) UserId
          FROM dbo.UserAccount
          WHERE Phone = @phone OR (@email IS NOT NULL AND Email = @email)
          ORDER BY UserId
        `)
      userId = existingUser.recordset[0]?.UserId as number | undefined
    }

    if (!userId) {
      const insertedUser = await tx()
        .input('fullName', sql.NVarChar(150), input.customerName)
        .input('email', sql.VarChar(255), input.email || null)
        .input('phone', sql.VarChar(20), input.phone)
        .input('passwordHash', sql.VarChar(255), 'GUEST_CHECKOUT_NO_PASSWORD')
        .query(`
          INSERT INTO dbo.UserAccount (FullName, Email, Phone, PasswordHash, Status, CreatedAt)
          OUTPUT INSERTED.UserId
          VALUES (@fullName, @email, @phone, @passwordHash, 'Active', SYSDATETIME())
        `)
      userId = insertedUser.recordset[0].UserId
    }

    const customerProfile = await tx()
      .input('userId', sql.BigInt, userId)
      .query(`SELECT TOP (1) CustomerId FROM dbo.CustomerProfile WHERE UserId = @userId`)

    let customerId = customerProfile.recordset[0]?.CustomerId as number | undefined
    if (!customerId) {
      const insertedCustomer = await tx()
        .input('userId', sql.BigInt, userId)
        .query(`
          INSERT INTO dbo.CustomerProfile (UserId, LoyaltyPoint)
          OUTPUT INSERTED.CustomerId
          VALUES (@userId, 0)
        `)
      customerId = insertedCustomer.recordset[0].CustomerId
    }

    const skuIds = [...new Set(input.items.map((item) => item.skuId))]
    const skuResult = await tx().query(`
      SELECT
        ps.SkuId,
        ps.SkuCode,
        p.ProductId,
        p.CategoryId,
        p.BrandId,
        ps.Price,
        CASE
          WHEN promotion.PromotionId IS NULL THEN ps.Price
          WHEN promotion.DiscountType = 'Percent' THEN CASE WHEN ps.Price - (ps.Price * promotion.DiscountValue / 100) < 0 THEN 0 ELSE ps.Price - (ps.Price * promotion.DiscountValue / 100) END
          WHEN promotion.DiscountType = 'FixedAmount' THEN CASE WHEN ps.Price - promotion.DiscountValue < 0 THEN 0 ELSE ps.Price - promotion.DiscountValue END
          WHEN promotion.DiscountType = 'FixedPrice' THEN CASE WHEN promotion.DiscountValue < 0 THEN ps.Price ELSE promotion.DiscountValue END
          ELSE ps.Price
        END AS FinalPrice,
        ps.Price - CASE
          WHEN promotion.PromotionId IS NULL THEN ps.Price
          WHEN promotion.DiscountType = 'Percent' THEN CASE WHEN ps.Price - (ps.Price * promotion.DiscountValue / 100) < 0 THEN 0 ELSE ps.Price - (ps.Price * promotion.DiscountValue / 100) END
          WHEN promotion.DiscountType = 'FixedAmount' THEN CASE WHEN ps.Price - promotion.DiscountValue < 0 THEN 0 ELSE ps.Price - promotion.DiscountValue END
          WHEN promotion.DiscountType = 'FixedPrice' THEN CASE WHEN promotion.DiscountValue < 0 THEN ps.Price ELSE promotion.DiscountValue END
          ELSE ps.Price
        END AS DiscountAmount,
        p.ProductName,
        p.WarrantyMonths,
        SUM(i.QuantityOnHand - i.QuantityReserved) AS AvailableQuantity
      FROM dbo.ProductSku ps
      INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
      INNER JOIN dbo.Inventory i WITH (UPDLOCK, ROWLOCK) ON i.SkuId = ps.SkuId
      OUTER APPLY (
        SELECT TOP (1)
          promo.PromotionId,
          promo.DiscountType,
          promo.DiscountValue
        FROM dbo.Promotion promo
        WHERE promo.Status = 'Active'
          AND promo.StartAt <= SYSDATETIME()
          AND promo.EndAt > SYSDATETIME()
          AND (
            EXISTS (
              SELECT 1
              FROM dbo.PromotionSku psPromo
              WHERE psPromo.PromotionId = promo.PromotionId
                AND psPromo.SkuId = ps.SkuId
            )
            OR EXISTS (
              SELECT 1
              FROM dbo.PromotionProduct pp
              WHERE pp.PromotionId = promo.PromotionId
                AND pp.ProductId = p.ProductId
            )
          )
        ORDER BY
          CASE promo.DiscountType
            WHEN 'FixedPrice' THEN ps.Price - promo.DiscountValue
            WHEN 'FixedAmount' THEN promo.DiscountValue
            WHEN 'Percent' THEN ps.Price * promo.DiscountValue / 100
            ELSE 0
          END DESC,
          promo.EndAt ASC,
          promo.PromotionId DESC
      ) promotion
      WHERE ps.Status = 'Active'
        AND p.Status = 'Active'
        AND ps.SkuId IN (${skuIds.join(',')})
      GROUP BY
        ps.SkuId,
        ps.SkuCode,
        p.ProductId,
        p.CategoryId,
        p.BrandId,
        ps.Price,
        p.ProductName,
        p.WarrantyMonths,
        promotion.PromotionId,
        promotion.DiscountType,
        promotion.DiscountValue
    `)

    if (skuResult.recordset.length !== skuIds.length) throw new Error('Có SKU không tồn tại hoặc đã ngừng bán.')

    const skuMap = new Map<number, SkuSnapshot>()
    for (const row of skuResult.recordset as SkuSnapshot[]) skuMap.set(Number(row.SkuId), row)

    let subtotal = 0
    let orderDiscount = 0
    let couponDiscount = 0
    let couponId: number | null = null
    for (const item of input.items) {
      const sku = skuMap.get(item.skuId)
      if (!sku || Number(sku.AvailableQuantity) < item.quantity) throw new Error(`SKU ${item.skuId} không đủ tồn kho.`)
      subtotal += Number(sku.Price) * item.quantity
      orderDiscount += Number(sku.DiscountAmount) * item.quantity
    }

    const finalSubtotal = subtotal - orderDiscount
    const couponCode = String(input.couponCode ?? '').trim().toUpperCase()
    if (couponCode) {
      const coupon = await tx()
        .input('couponCode', sql.VarChar(50), couponCode)
        .input('customerId', sql.BigInt, customerId)
        .query(`
          SELECT TOP (1)
            c.CouponId,
            c.CouponCode,
            c.DiscountType,
            c.DiscountValue,
            c.MinOrderAmount,
            c.MaxDiscountAmount,
            c.UsageLimit,
            c.UsedCount,
            c.UsagePerCustomer,
            (
              SELECT COUNT(*)
              FROM dbo.OrderCoupon oc
              INNER JOIN dbo.SalesOrder so ON so.OrderId = oc.OrderId
              WHERE oc.CouponId = c.CouponId AND so.CustomerId = @customerId
            ) AS CustomerUsedCount
          FROM dbo.Coupon c WITH (UPDLOCK, ROWLOCK)
          WHERE c.CouponCode = @couponCode
            AND c.Status = 'Active'
            AND c.StartAt <= SYSDATETIME()
            AND c.EndAt > SYSDATETIME()
        `)

      const row = coupon.recordset[0] as {
        CouponId: number
        DiscountType: 'Percent' | 'FixedAmount'
        DiscountValue: number
        MinOrderAmount: number
        MaxDiscountAmount: number | null
        UsageLimit: number | null
        UsedCount: number
        UsagePerCustomer: number | null
        CustomerUsedCount: number
      } | undefined

      if (!row) throw new Error('Mã giảm giá không hợp lệ hoặc đã hết hạn.')
      if (finalSubtotal < Number(row.MinOrderAmount)) throw new Error('Đơn hàng chưa đạt giá trị tối thiểu để dùng mã giảm giá.')
      if (row.UsageLimit !== null && Number(row.UsedCount) >= Number(row.UsageLimit)) throw new Error('Mã giảm giá đã hết lượt sử dụng.')
      if (row.UsagePerCustomer !== null && Number(row.CustomerUsedCount) >= Number(row.UsagePerCustomer)) {
        throw new Error('Bạn đã dùng hết lượt cho mã giảm giá này.')
      }

      const targets = await tx()
        .input('couponId', sql.BigInt, row.CouponId)
        .query(`
          SELECT TargetType, TargetId
          FROM dbo.CouponTarget
          WHERE CouponId = @couponId
        `)

      let eligibleAmount = 0
      for (const item of input.items) {
        const sku = skuMap.get(item.skuId)!
        const lineAmount = Number(sku.FinalPrice) * item.quantity
        const matches = targets.recordset.length === 0 || targets.recordset.some((target) => {
          const targetId = Number(target.TargetId)
          if (target.TargetType === 'Sku') return targetId === Number(sku.SkuId)
          if (target.TargetType === 'Product') return targetId === Number(sku.ProductId)
          if (target.TargetType === 'Category') return targetId === Number(sku.CategoryId)
          if (target.TargetType === 'Brand') return targetId === Number(sku.BrandId)
          if (target.TargetType === 'Customer') return targetId === Number(customerId)
          return false
        })
        if (matches) eligibleAmount += lineAmount
      }

      if (eligibleAmount <= 0) throw new Error('Mã giảm giá không áp dụng cho sản phẩm trong giỏ.')
      couponDiscount = row.DiscountType === 'Percent'
        ? eligibleAmount * Number(row.DiscountValue) / 100
        : Number(row.DiscountValue)
      if (row.MaxDiscountAmount !== null) couponDiscount = Math.min(couponDiscount, Number(row.MaxDiscountAmount))
      couponDiscount = Math.min(couponDiscount, finalSubtotal)
      couponId = Number(row.CouponId)
    }

    const shippingFee = finalSubtotal >= 5_000_000 ? 0 : 40_000
    const totalAmount = finalSubtotal - couponDiscount + shippingFee
    const orderCode = `AA${Date.now()}`
    const shippingAddress = [input.streetAddress, input.ward, input.district, input.province].filter(Boolean).join(', ')

    const insertedOrder = await tx()
      .input('orderCode', sql.VarChar(50), orderCode)
      .input('customerId', sql.BigInt, customerId)
      .input('receiverName', sql.NVarChar(150), input.customerName)
      .input('receiverPhone', sql.VarChar(20), input.phone)
      .input('shippingAddress', sql.NVarChar(500), shippingAddress)
      .input('subtotal', sql.Decimal(18, 2), subtotal)
      .input('discountAmount', sql.Decimal(18, 2), orderDiscount + couponDiscount)
      .input('shippingFee', sql.Decimal(18, 2), shippingFee)
      .input('orderStatusId', sql.TinyInt, orderStatusId)
      .input('paymentStatusId', sql.TinyInt, paymentStatusId)
      .input('note', sql.NVarChar(500), input.note || null)
      .query(`
        INSERT INTO dbo.SalesOrder (
          OrderCode, CustomerId, OrderStatusId, PaymentStatusId,
          ReceiverName, ReceiverPhone, ShippingAddressSnapshot,
          SubtotalAmount, DiscountAmount, ShippingFee, Note, CreatedAt
        )
        OUTPUT INSERTED.OrderId
        VALUES (
          @orderCode, @customerId, @orderStatusId, @paymentStatusId,
          @receiverName, @receiverPhone, @shippingAddress,
          @subtotal, @discountAmount, @shippingFee, @note, SYSDATETIME()
        )
      `)

    const orderId = insertedOrder.recordset[0].OrderId as number

    await tx()
      .input('orderId', sql.BigInt, orderId)
      .input('orderStatusId', sql.TinyInt, orderStatusId)
      .input('changedByUserId', sql.BigInt, userId)
      .query(`
        INSERT INTO dbo.OrderStatusHistory (
          OrderId, FromStatusId, ToStatusId, ChangedByUserId, Note, ChangedAt
        )
        VALUES (@orderId, NULL, @orderStatusId, @changedByUserId, N'Đặt hàng', SYSDATETIME())
      `)

    if (couponId) {
      await tx()
        .input('orderId', sql.BigInt, orderId)
        .input('couponId', sql.BigInt, couponId)
        .input('discountAmount', sql.Decimal(18, 2), couponDiscount)
        .query(`
          INSERT INTO dbo.OrderCoupon (OrderId, CouponId, DiscountAmount, AppliedAt)
          VALUES (@orderId, @couponId, @discountAmount, SYSDATETIME())

          UPDATE dbo.Coupon
          SET UsedCount = UsedCount + 1,
              UpdatedAt = SYSDATETIME()
          WHERE CouponId = @couponId
        `)
    }

    for (const item of input.items) {
      const sku = skuMap.get(item.skuId)!
      const insertedDetail = await tx()
        .input('orderId', sql.BigInt, orderId)
        .input('skuId', sql.BigInt, item.skuId)
        .input('productName', sql.NVarChar(255), sku.ProductName)
        .input('skuCode', sql.VarChar(100), sku.SkuCode)
        .input('unitPrice', sql.Decimal(18, 2), Number(sku.Price))
        .input('quantity', sql.Int, item.quantity)
        .input('discountAmount', sql.Decimal(18, 2), Number(sku.DiscountAmount) * item.quantity)
        .input('warrantyMonths', sql.Int, sku.WarrantyMonths)
        .query(`
          INSERT INTO dbo.SalesOrderDetail (
            OrderId, SkuId, ProductNameSnapshot, SkuCodeSnapshot,
            UnitPrice, Quantity, DiscountAmount, WarrantyMonthsSnapshot
          )
          OUTPUT INSERTED.OrderDetailId
          VALUES (@orderId, @skuId, @productName, @skuCode, @unitPrice, @quantity, @discountAmount, @warrantyMonths)
        `)

      const orderDetailId = insertedDetail.recordset[0].OrderDetailId as number
      const inventory = await tx()
        .input('skuId', sql.BigInt, item.skuId)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          SELECT TOP (1) InventoryId
          FROM dbo.Inventory WITH (UPDLOCK, ROWLOCK)
          WHERE SkuId = @skuId AND QuantityOnHand - QuantityReserved >= @quantity
          ORDER BY QuantityOnHand - QuantityReserved DESC, InventoryId
        `)

      const inventoryId = inventory.recordset[0]?.InventoryId as number | undefined
      if (!inventoryId) throw new Error(`SKU ${item.skuId} vừa hết tồn kho khả dụng.`)

      await tx()
        .input('inventoryId', sql.BigInt, inventoryId)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          UPDATE dbo.Inventory
          SET QuantityReserved = QuantityReserved + @quantity,
              UpdatedAt = SYSDATETIME()
          WHERE InventoryId = @inventoryId
        `)

      await tx()
        .input('orderDetailId', sql.BigInt, orderDetailId)
        .input('inventoryId', sql.BigInt, inventoryId)
        .input('quantity', sql.Int, item.quantity)
        .query(`
          INSERT INTO dbo.OrderInventoryReservation (
            OrderDetailId, InventoryId, QuantityReserved, QuantityFulfilled, CreatedAt
          )
          VALUES (@orderDetailId, @inventoryId, @quantity, 0, SYSDATETIME())
        `)
    }

    await tx()
      .input('orderId', sql.BigInt, orderId)
      .input('paymentMethodId', sql.TinyInt, input.paymentMethodId)
      .input('paymentStatusId', sql.TinyInt, paymentStatusId)
      .input('amount', sql.Decimal(18, 2), totalAmount)
      .query(`
        INSERT INTO dbo.Payment (
          OrderId, PaymentMethodId, PaymentStatusId, Amount,
          TransactionCode, PaidAt, CreatedAt
        )
        VALUES (@orderId, @paymentMethodId, @paymentStatusId, @amount, NULL, NULL, SYSDATETIME())
      `)

    if (input.userId) {
      const purchasedSkuIds = [...new Set(input.items.map((item) => item.skuId))]
      await tx().input('userId', sql.BigInt, input.userId).query(`
        DELETE ci
        FROM dbo.CartItem ci
        INNER JOIN dbo.Cart c ON c.CartId = ci.CartId
        WHERE c.UserId = @userId AND c.Status = 'Active'
          AND ci.SkuId IN (${purchasedSkuIds.join(',')});
        UPDATE dbo.Cart SET UpdatedAt = SYSDATETIME() WHERE UserId = @userId AND Status = 'Active';
      `)
    }

    await transaction.commit()

    return {
      orderId,
      orderCode,
      totalAmount,
      paymentMethodCode: paymentMethod.MethodCode,
      paymentMethodName: paymentMethod.MethodName,
      paymentStatusCode,
      orderStatusCode,
      paymentInstruction: buildPaymentInstruction(paymentMethod.MethodCode, orderCode, totalAmount),
      paymentQrUrl: buildPaymentQrUrl(paymentMethod.MethodCode, orderCode, totalAmount),
      bankAccount: paymentMethod.MethodCode === 'BANK_TRANSFER' ? getBankAccount() : null,
    }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function confirmBankTransferPayment(orderId: number, transactionCode: string, confirmedByUserId: number) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const current = await tx()
      .input('orderId', sql.BigInt, orderId)
      .query(`
        SELECT TOP (1) so.OrderId, so.OrderStatusId, os.StatusCode AS OrderStatusCode, pm.MethodCode
        FROM dbo.SalesOrder so WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
        INNER JOIN dbo.Payment p ON p.OrderId = so.OrderId
        INNER JOIN dbo.PaymentMethod pm ON pm.PaymentMethodId = p.PaymentMethodId
        WHERE so.OrderId = @orderId
        ORDER BY p.PaymentId DESC
      `)

    const order = current.recordset[0] as { OrderId: number; OrderStatusId: number; OrderStatusCode: string; MethodCode: string } | undefined
    if (!order) throw new Error('Không tìm thấy đơn hàng.')
    if (order.MethodCode !== 'BANK_TRANSFER') throw new Error('Chỉ xác nhận thủ công cho đơn chuyển khoản ngân hàng.')

    if (order.OrderStatusCode !== 'PendingPayment') throw new Error('Only pending-payment orders can be confirmed as paid.')

    const statuses = await tx().query(`
      SELECT
        (SELECT PaymentStatusId FROM dbo.PaymentStatus WHERE StatusCode = 'Success') AS PaymentStatusId,
        (SELECT OrderStatusId FROM dbo.OrderStatus WHERE StatusCode = 'Confirmed') AS ConfirmedOrderStatusId
    `)

    const paymentStatusId = Number(statuses.recordset[0]?.PaymentStatusId)
    const confirmedOrderStatusId = Number(statuses.recordset[0]?.ConfirmedOrderStatusId)
    if (!paymentStatusId || !confirmedOrderStatusId) throw new Error('Missing required payment status configuration.')

    await tx()
      .input('orderId', sql.BigInt, order.OrderId)
      .input('paymentStatusId', sql.TinyInt, paymentStatusId)
      .input('transactionCode', sql.VarChar(255), transactionCode)
      .query(`
        UPDATE dbo.Payment
        SET PaymentStatusId = @paymentStatusId,
            TransactionCode = @transactionCode,
            PaidAt = SYSDATETIME()
        WHERE OrderId = @orderId
      `)

    await tx()
      .input('orderId', sql.BigInt, order.OrderId)
      .input('paymentStatusId', sql.TinyInt, paymentStatusId)
      .input('confirmedOrderStatusId', sql.TinyInt, confirmedOrderStatusId)
      .query(`
        UPDATE dbo.SalesOrder
        SET PaymentStatusId = @paymentStatusId,
            OrderStatusId = @confirmedOrderStatusId,
            UpdatedAt = SYSDATETIME()
        WHERE OrderId = @orderId
      `)

    await tx()
      .input('orderId', sql.BigInt, order.OrderId)
      .input('fromStatusId', sql.TinyInt, order.OrderStatusId)
      .input('toStatusId', sql.TinyInt, confirmedOrderStatusId)
      .input('changedByUserId', sql.BigInt, confirmedByUserId)
      .query(`
        INSERT INTO dbo.OrderStatusHistory (
          OrderId, FromStatusId, ToStatusId, ChangedByUserId, Note, ChangedAt
        )
        VALUES (@orderId, @fromStatusId, @toStatusId, @changedByUserId, N'Admin đã đối chiếu tài khoản ngân hàng và xác nhận thanh toán', SYSDATETIME())
      `)

    await transaction.commit()
    return { orderId, paymentStatusCode: 'Success', orderStatusCode: 'Confirmed' }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

function buildPaymentInstruction(methodCode: string, orderCode: string, amount: number) {
  if (methodCode === 'COD') return 'Thanh toán cho shipper khi nhận hàng. Đơn không cần bước thanh toán trước.'
  if (methodCode === 'BANK_TRANSFER') {
    const bank = getBankAccount()
    if (!bank) return `Chuyển khoản ${amount.toLocaleString('vi-VN')}đ với nội dung ${orderCode}. Quản trị viên sẽ đối chiếu tài khoản và xác nhận.`
    return `Chuyển khoản ${amount.toLocaleString('vi-VN')}đ tới ${bank.bankCode} - ${bank.accountNumber} - ${bank.accountName}, nội dung: ${orderCode}. Quản trị viên sẽ đối chiếu và xác nhận.`
  }
  return 'Phương thức thanh toán không được hỗ trợ.'
}

function getBankAccount() {
  const bankCode = process.env.BANK_CODE?.trim()
  const accountNumber = process.env.BANK_ACCOUNT_NUMBER?.trim()
  const accountName = process.env.BANK_ACCOUNT_NAME?.trim()
  if (!bankCode || !accountNumber || !accountName) return null
  return { bankCode, accountNumber, accountName }
}

function buildPaymentQrUrl(methodCode: string, orderCode: string, amount: number) {
  if (methodCode !== 'BANK_TRANSFER') return null
  const bank = getBankAccount()
  if (!bank) return null
  const query = new URLSearchParams({
    amount: String(Math.round(amount)), addInfo: orderCode, accountName: bank.accountName,
  })
  return `https://img.vietqr.io/image/${encodeURIComponent(bank.bankCode)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?${query.toString()}`
}
