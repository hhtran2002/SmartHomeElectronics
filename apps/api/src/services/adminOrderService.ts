import { getPool, sql } from '../config/database.js'

export async function getAdminOrders() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT TOP (100)
      so.OrderId AS orderId,
      so.OrderCode AS orderCode,
      so.ReceiverName AS receiverName,
      so.ReceiverPhone AS receiverPhone,
      so.TotalAmount AS totalAmount,
      so.CreatedAt AS createdAt,
      os.OrderStatusId AS orderStatusId,
      os.StatusName AS orderStatusName,
      ps.PaymentStatusId AS paymentStatusId,
      ps.StatusName AS paymentStatusName
    FROM dbo.SalesOrder so
    INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
    INNER JOIN dbo.PaymentStatus ps ON ps.PaymentStatusId = so.PaymentStatusId
    ORDER BY so.OrderId DESC
  `)

  return result.recordset
}

export async function getAdminOrderStatuses() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT OrderStatusId AS id, StatusCode AS code, StatusName AS name
    FROM dbo.OrderStatus
    ORDER BY SortOrder
  `)

  return result.recordset
}

export async function getAdminOrderDetail(orderId: number) {
  const pool = await getPool()
  const orderResult = await pool
    .request()
    .input('orderId', sql.BigInt, orderId)
    .query(`
      SELECT TOP (1)
        so.OrderId AS orderId,
        so.OrderCode AS orderCode,
        so.ReceiverName AS receiverName,
        so.ReceiverPhone AS receiverPhone,
        so.ShippingAddressSnapshot AS shippingAddress,
        so.SubtotalAmount AS subtotalAmount,
        so.DiscountAmount AS discountAmount,
        so.ShippingFee AS shippingFee,
        so.TotalAmount AS totalAmount,
        so.Note AS note,
        so.CreatedAt AS createdAt,
        os.OrderStatusId AS orderStatusId,
        os.StatusName AS orderStatusName,
        ps.PaymentStatusId AS paymentStatusId,
        ps.StatusName AS paymentStatusName,
        pm.MethodName AS paymentMethodName
      FROM dbo.SalesOrder so
      INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      INNER JOIN dbo.PaymentStatus ps ON ps.PaymentStatusId = so.PaymentStatusId
      LEFT JOIN dbo.Payment p ON p.OrderId = so.OrderId
      LEFT JOIN dbo.PaymentMethod pm ON pm.PaymentMethodId = p.PaymentMethodId
      WHERE so.OrderId = @orderId
      ORDER BY p.PaymentId DESC
    `)

  const order = orderResult.recordset[0]
  if (!order) return null

  const detailResult = await pool
    .request()
    .input('orderId', sql.BigInt, orderId)
    .query(`
      SELECT
        OrderDetailId AS orderDetailId,
        SkuId AS skuId,
        ProductNameSnapshot AS productName,
        SkuCodeSnapshot AS skuCode,
        UnitPrice AS unitPrice,
        Quantity AS quantity,
        DiscountAmount AS discountAmount,
        LineTotal AS lineTotal,
        WarrantyMonthsSnapshot AS warrantyMonths
      FROM dbo.SalesOrderDetail
      WHERE OrderId = @orderId
      ORDER BY OrderDetailId
    `)

  return { order, items: detailResult.recordset }
}

export async function updateAdminOrderStatus(input: {
  orderId: number
  orderStatusId: number
}) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const currentOrder = await tx()
      .input('orderId', sql.BigInt, input.orderId)
      .input('orderStatusId', sql.TinyInt, input.orderStatusId)
      .query(`
        SELECT TOP (1)
          so.OrderId,
          so.OrderCode,
          so.OrderStatusId,
          so.PaymentStatusId,
          currentStatus.StatusCode AS CurrentStatusCode,
          targetStatus.StatusCode AS TargetStatusCode,
          paymentStatus.StatusCode AS PaymentStatusCode,
          payment.PaymentId,
          paymentMethod.MethodCode AS PaymentMethodCode
        FROM dbo.SalesOrder so WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.OrderStatus currentStatus ON currentStatus.OrderStatusId = so.OrderStatusId
        INNER JOIN dbo.PaymentStatus paymentStatus ON paymentStatus.PaymentStatusId = so.PaymentStatusId
        LEFT JOIN dbo.Payment payment ON payment.OrderId = so.OrderId
        LEFT JOIN dbo.PaymentMethod paymentMethod ON paymentMethod.PaymentMethodId = payment.PaymentMethodId
        CROSS JOIN dbo.OrderStatus targetStatus
        WHERE so.OrderId = @orderId
          AND targetStatus.OrderStatusId = @orderStatusId
        ORDER BY payment.PaymentId DESC
      `)

    const current = currentOrder.recordset[0]
    if (!current) throw new Error('Không tìm thấy đơn hàng hoặc trạng thái.')

    const oldStatusId = Number(current.OrderStatusId)
    const currentStatusCode = String(current.CurrentStatusCode)
    const targetStatusCode = String(current.TargetStatusCode)
    const paymentStatusCode = String(current.PaymentStatusCode)
    const paymentMethodCode = String(current.PaymentMethodCode || '')

    if (targetStatusCode === 'Shipping') {
      throw new Error('Đơn phải được nhân viên kho xác nhận xuất tại trang Kho hàng.')
    }

    if (targetStatusCode === 'Completed' && currentStatusCode !== 'Shipping') {
      throw new Error('Chỉ đơn đang giao hàng mới được xác nhận hoàn thành.')
    }

    if (targetStatusCode === 'Completed' && paymentMethodCode !== 'COD' && paymentStatusCode !== 'Success') {
      throw new Error('Đơn thanh toán online phải thanh toán thành công trước khi hoàn thành.')
    }

    const existingStockOut = await tx()
      .input('orderId', sql.BigInt, input.orderId)
      .query(`
        SELECT TOP (1) StockOutReceiptId
        FROM dbo.StockOutReceipt WITH (UPDLOCK, HOLDLOCK)
        WHERE OrderId = @orderId AND Reason = 'Order' AND Status = 'Confirmed'
      `)

    const hasStockOut = existingStockOut.recordset.length > 0
    if (targetStatusCode === 'Cancelled' && hasStockOut) {
      throw new Error('Đơn hàng đã xuất kho nên không thể hủy trực tiếp. Cần xử lý hoàn hàng.')
    }

    if (targetStatusCode === 'Cancelled' && oldStatusId !== input.orderStatusId) {
      const details = await tx()
        .input('orderId', sql.BigInt, input.orderId)
        .query(`
          SELECT OrderDetailId, SkuId, Quantity
          FROM dbo.SalesOrderDetail
          WHERE OrderId = @orderId
        `)

      for (const item of details.recordset) {
        let quantityLeft = Number(item.Quantity)
        const reservations = await tx()
          .input('orderDetailId', sql.BigInt, item.OrderDetailId)
          .query(`
            SELECT
              oir.OrderInventoryReservationId,
              oir.InventoryId,
              oir.QuantityReserved - oir.QuantityFulfilled AS QuantityToRelease
            FROM dbo.OrderInventoryReservation oir WITH (UPDLOCK, ROWLOCK)
            INNER JOIN dbo.Inventory i WITH (UPDLOCK, ROWLOCK) ON i.InventoryId = oir.InventoryId
            WHERE oir.OrderDetailId = @orderDetailId
              AND oir.QuantityReserved > oir.QuantityFulfilled
            ORDER BY oir.OrderInventoryReservationId
          `)

        for (const inventory of reservations.recordset) {
          if (quantityLeft === 0) break

          const releaseQuantity = Math.min(quantityLeft, Number(inventory.QuantityToRelease))
          await tx()
            .input('inventoryId', sql.BigInt, inventory.InventoryId)
            .input('quantity', sql.Int, releaseQuantity)
            .query(`
              UPDATE dbo.Inventory
              SET QuantityReserved = QuantityReserved - @quantity,
                  UpdatedAt = SYSDATETIME()
              WHERE InventoryId = @inventoryId
            `)

          await tx()
            .input('reservationId', sql.BigInt, inventory.OrderInventoryReservationId)
            .input('quantity', sql.Int, releaseQuantity)
            .query(`
              UPDATE dbo.OrderInventoryReservation
              SET QuantityFulfilled = QuantityFulfilled + @quantity,
                  UpdatedAt = SYSDATETIME()
              WHERE OrderInventoryReservationId = @reservationId
            `)

          quantityLeft -= releaseQuantity
        }

        if (quantityLeft > 0) throw new Error(`Dữ liệu giữ kho của SKU ${item.SkuId} không khớp với đơn hàng.`)
      }
    }

    let nextPaymentStatusId: number | null = null
    if (targetStatusCode === 'Completed' && paymentMethodCode === 'COD') {
      const successStatus = await tx().query(`
        SELECT PaymentStatusId
        FROM dbo.PaymentStatus
        WHERE StatusCode = 'Success'
      `)

      nextPaymentStatusId = Number(successStatus.recordset[0]?.PaymentStatusId)
      if (!nextPaymentStatusId) throw new Error('Thiếu cấu hình trạng thái thanh toán thành công.')

      await tx()
        .input('orderId', sql.BigInt, input.orderId)
        .input('paymentStatusId', sql.TinyInt, nextPaymentStatusId)
        .input('transactionCode', sql.VarChar(255), `COD-${current.OrderCode}`)
        .query(`
          UPDATE dbo.Payment
          SET PaymentStatusId = @paymentStatusId,
              TransactionCode = COALESCE(TransactionCode, @transactionCode),
              PaidAt = COALESCE(PaidAt, SYSDATETIME())
          WHERE OrderId = @orderId
        `)
    }

    await tx()
      .input('orderId', sql.BigInt, input.orderId)
      .input('orderStatusId', sql.TinyInt, input.orderStatusId)
      .input('paymentStatusId', sql.TinyInt, nextPaymentStatusId)
      .input('isCancelled', sql.Bit, targetStatusCode === 'Cancelled')
      .query(`
        UPDATE dbo.SalesOrder
        SET OrderStatusId = @orderStatusId,
            PaymentStatusId = COALESCE(@paymentStatusId, PaymentStatusId),
            UpdatedAt = SYSDATETIME(),
            CancelledAt = CASE WHEN @isCancelled = 1 THEN SYSDATETIME() ELSE CancelledAt END
        WHERE OrderId = @orderId
      `)

    await transaction.commit()

    return {
      orderId: input.orderId,
      orderStatusId: input.orderStatusId,
      paymentStatusUpdated: nextPaymentStatusId !== null,
      stockExported: false,
    }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}
