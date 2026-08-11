import bcrypt from 'bcryptjs'
import { getPool, sql } from '../config/database.js'
import { getReviewModerationRequired } from './reviewSettingsService.js'

export type ProfileUpdateInput = {
  userId: number
  fullName: string
  email: string | null
  dateOfBirth: string | null
  gender: string | null
}

export type AddressInput = {
  userId: number
  addressId?: number
  receiverName: string
  receiverPhone: string
  provinceCode: string
  wardCode: string
  streetAddress: string
  isDefault: boolean
}

export async function getCustomerOrders(userId: number) {
  const pool = await getPool()
  const result = await pool.request()
    .input('userId', sql.BigInt, userId)
    .query(`
      SELECT
        so.OrderId AS orderId,
        so.OrderCode AS orderCode,
        so.TotalAmount AS totalAmount,
        so.CreatedAt AS createdAt,
        so.ReceiverName AS receiverName,
        so.ShippingAddressSnapshot AS shippingAddress,
        os.StatusCode AS orderStatusCode,
        os.StatusName AS orderStatusName,
        ps.StatusName AS paymentStatusName,
        COUNT(sod.OrderDetailId) AS itemCount,
        SUM(sod.Quantity) AS totalQuantity
      FROM dbo.CustomerProfile cp
      INNER JOIN dbo.SalesOrder so ON so.CustomerId = cp.CustomerId
      INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      INNER JOIN dbo.PaymentStatus ps ON ps.PaymentStatusId = so.PaymentStatusId
      LEFT JOIN dbo.SalesOrderDetail sod ON sod.OrderId = so.OrderId
      WHERE cp.UserId = @userId
      GROUP BY
        so.OrderId, so.OrderCode, so.TotalAmount, so.CreatedAt,
        so.ReceiverName, so.ShippingAddressSnapshot,
        os.StatusCode, os.StatusName, ps.StatusName
      ORDER BY so.OrderId DESC
    `)
  return result.recordset
}

export async function getCustomerOrderDetail(userId: number, orderId: number) {
  const pool = await getPool()
  const orderResult = await pool.request()
    .input('userId', sql.BigInt, userId)
    .input('orderId', sql.BigInt, orderId)
    .query(`
      SELECT
        so.OrderId AS orderId,
        so.OrderCode AS orderCode,
        so.SubtotalAmount AS subtotalAmount,
        so.DiscountAmount AS discountAmount,
        so.ShippingFee AS shippingFee,
        so.TotalAmount AS totalAmount,
        so.CreatedAt AS createdAt,
        so.ReceiverName AS receiverName,
        so.ReceiverPhone AS receiverPhone,
        so.ShippingAddressSnapshot AS shippingAddress,
        so.Note AS note,
        os.StatusCode AS orderStatusCode,
        os.StatusName AS orderStatusName,
        ps.StatusName AS paymentStatusName
      FROM dbo.CustomerProfile cp
      INNER JOIN dbo.SalesOrder so ON so.CustomerId = cp.CustomerId
      INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      INNER JOIN dbo.PaymentStatus ps ON ps.PaymentStatusId = so.PaymentStatusId
      WHERE cp.UserId = @userId AND so.OrderId = @orderId
    `)

  const order = orderResult.recordset[0]
  if (!order) return null

  const items = await pool.request()
    .input('orderId', sql.BigInt, orderId)
    .input('userId', sql.BigInt, userId)
    .query(`
      SELECT
        sod.OrderDetailId AS orderDetailId,
        sod.SkuId AS skuId,
        sod.ProductNameSnapshot AS productName,
        sod.SkuCodeSnapshot AS skuCode,
        sod.UnitPrice AS unitPrice,
        sod.Quantity AS quantity,
        sod.DiscountAmount AS discountAmount,
        sod.LineTotal AS lineTotal,
        pi.ImageUrl AS imageUrl,
        p.Slug AS productSlug,
        CAST(CASE WHEN EXISTS (
          SELECT 1 FROM dbo.Review r
          WHERE r.OrderDetailId = sod.OrderDetailId AND r.UserId = @userId
        ) THEN 1 ELSE 0 END AS BIT) AS hasReview
      FROM dbo.SalesOrderDetail sod
      INNER JOIN dbo.ProductSku ps ON ps.SkuId = sod.SkuId
      INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
      OUTER APPLY (
        SELECT TOP (1) ImageUrl
        FROM dbo.ProductImage
        WHERE ProductId = p.ProductId
        ORDER BY IsPrimary DESC, SortOrder, ImageId
      ) pi
      WHERE sod.OrderId = @orderId
      ORDER BY sod.OrderDetailId
    `)

  const returnRequestResult = await pool.request()
    .input('orderId', sql.BigInt, orderId)
    .input('userId', sql.BigInt, userId)
    .query(`
      SELECT TOP (1)
        ReturnRequestId AS returnRequestId,
        Reason AS reason,
        Note AS note,
        ISNULL(EvidenceUrl, ImageUrl) AS evidenceUrl,
        RefundMethod AS refundMethod,
        BankName AS bankName,
        BankAccountNumber AS bankAccountNumber,
        BankAccountName AS bankAccountName,
        RefundStatus AS refundStatus,
        RefundAmount AS refundAmount,
        Status AS status,
        AdminNote AS adminNote,
        CreatedAt AS createdAt
      FROM dbo.OrderReturnRequest
      WHERE OrderId = @orderId AND UserId = @userId
      ORDER BY ReturnRequestId DESC
    `)

  return {
    order,
    items: items.recordset,
    returnRequest: returnRequestResult.recordset[0] ?? null,
  }
}

export type ReturnRequestPayload = {
  userId: number
  orderId: number
  reason: string
  note?: string
  evidenceUrl: string
  refundMethod?: string
  bankName: string
  bankAccountNumber: string
  bankAccountName: string
}

export async function createReturnRequest(input: ReturnRequestPayload) {
  if (!input.evidenceUrl || !input.evidenceUrl.trim()) {
    throw new Error('Bạn bắt buộc phải cung cấp link hình ảnh hoặc video minh chứng lỗi sản phẩm.')
  }

  if (!input.bankName?.trim() || !input.bankAccountNumber?.trim() || !input.bankAccountName?.trim()) {
    throw new Error('Vui lòng điền đầy đủ Tên ngân hàng, Số tài khoản và Tên chủ tài khoản để nhận tiền hoàn qua chuyển khoản.')
  }

  const pool = await getPool()

  // Validate order belongs to user and is Completed
  const orderResult = await pool.request()
    .input('orderId', sql.BigInt, input.orderId)
    .input('userId', sql.BigInt, input.userId)
    .query(`
      SELECT TOP (1) so.OrderId, so.TotalAmount
      FROM dbo.SalesOrder so
      INNER JOIN dbo.CustomerProfile cp ON cp.CustomerId = so.CustomerId
      INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      WHERE so.OrderId = @orderId
        AND cp.UserId = @userId
        AND os.StatusCode = 'Completed'
    `)

  const orderData = orderResult.recordset[0]
  if (!orderData) {
    throw new Error('Bạn chỉ có thể yêu cầu hoàn hàng đối với đơn hàng đã hoàn thành.')
  }

  // Check if there is already a return request for this order
  const existingResult = await pool.request()
    .input('orderId', sql.BigInt, input.orderId)
    .input('userId', sql.BigInt, input.userId)
    .query(`
      SELECT TOP (1) ReturnRequestId FROM dbo.OrderReturnRequest
      WHERE OrderId = @orderId AND UserId = @userId
    `)

  if (existingResult.recordset[0]) {
    throw new Error('Đơn hàng này đã có yêu cầu hoàn hàng được tạo.')
  }

  const inserted = await pool.request()
    .input('orderId', sql.BigInt, input.orderId)
    .input('userId', sql.BigInt, input.userId)
    .input('reason', sql.NVarChar(255), input.reason)
    .input('note', sql.NVarChar(1000), input.note || null)
    .input('evidenceUrl', sql.NVarChar(500), input.evidenceUrl.trim())
    .input('refundMethod', sql.VarChar(20), 'BankTransfer')
    .input('bankName', sql.NVarChar(100), input.bankName.trim())
    .input('bankAccountNumber', sql.VarChar(50), input.bankAccountNumber.trim())
    .input('bankAccountName', sql.NVarChar(150), input.bankAccountName.trim())
    .input('refundAmount', sql.Decimal(18, 2), Number(orderData.TotalAmount))
    .query(`
      INSERT INTO dbo.OrderReturnRequest (
        OrderId, UserId, Reason, Note, ImageUrl, EvidenceUrl,
        RefundMethod, BankName, BankAccountNumber, BankAccountName,
        RefundStatus, RefundAmount, Status, CreatedAt
      )
      OUTPUT INSERTED.ReturnRequestId
      VALUES (
        @orderId, @userId, @reason, @note, @evidenceUrl, @evidenceUrl,
        @refundMethod, @bankName, @bankAccountNumber, @bankAccountName,
        'Pending', @refundAmount, 'Pending', SYSDATETIME()
      )
    `)

  return { returnRequestId: inserted.recordset[0].ReturnRequestId as number, status: 'Pending' }
}

export async function getCustomerReturnRequests(userId: number) {
  const pool = await getPool()
  const result = await pool.request()
    .input('userId', sql.BigInt, userId)
    .query(`
      SELECT
        rr.ReturnRequestId AS returnRequestId,
        rr.OrderId AS orderId,
        so.OrderCode AS orderCode,
        rr.Reason AS reason,
        rr.Note AS note,
        ISNULL(rr.EvidenceUrl, rr.ImageUrl) AS evidenceUrl,
        rr.RefundMethod AS refundMethod,
        rr.BankName AS bankName,
        rr.BankAccountNumber AS bankAccountNumber,
        rr.BankAccountName AS bankAccountName,
        rr.RefundStatus AS refundStatus,
        rr.RefundAmount AS refundAmount,
        rr.Status AS status,
        rr.AdminNote AS adminNote,
        rr.CreatedAt AS createdAt,
        so.TotalAmount AS totalAmount
      FROM dbo.OrderReturnRequest rr
      INNER JOIN dbo.SalesOrder so ON so.OrderId = rr.OrderId
      WHERE rr.UserId = @userId
      ORDER BY rr.ReturnRequestId DESC
    `)
  return result.recordset
}


export async function getCustomerProfile(userId: number) {
  const pool = await getPool()
  const result = await pool.request()
    .input('userId', sql.BigInt, userId)
    .query(`
      SELECT
        ua.UserId AS userId,
        ua.FullName AS fullName,
        ua.Email AS email,
        ua.Phone AS phone,
        ua.CreatedAt AS createdAt,
        cp.DateOfBirth AS dateOfBirth,
        cp.Gender AS gender,
        ISNULL(cp.LoyaltyPoint, 0) AS loyaltyPoint
      FROM dbo.UserAccount ua
      LEFT JOIN dbo.CustomerProfile cp ON cp.UserId = ua.UserId
      WHERE ua.UserId = @userId
    `)
  return result.recordset[0]
}

export async function updateCustomerProfile(input: ProfileUpdateInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    if (input.email) {
      const duplicate = await tx()
        .input('userId', sql.BigInt, input.userId)
        .input('email', sql.VarChar(255), input.email)
        .query('SELECT UserId FROM dbo.UserAccount WHERE Email = @email AND UserId <> @userId')
      if (duplicate.recordset.length) throw new Error('Email đã được tài khoản khác sử dụng.')
    }

    await tx()
      .input('userId', sql.BigInt, input.userId)
      .input('fullName', sql.NVarChar(150), input.fullName)
      .input('email', sql.VarChar(255), input.email)
      .query(`
        UPDATE dbo.UserAccount
        SET FullName = @fullName, Email = @email, UpdatedAt = SYSDATETIME()
        WHERE UserId = @userId
      `)

    await tx()
      .input('userId', sql.BigInt, input.userId)
      .input('dateOfBirth', sql.Date, input.dateOfBirth)
      .input('gender', sql.NVarChar(20), input.gender)
      .query(`
        MERGE dbo.CustomerProfile AS target
        USING (SELECT @userId AS UserId) AS source
        ON target.UserId = source.UserId
        WHEN MATCHED THEN
          UPDATE SET DateOfBirth = @dateOfBirth, Gender = @gender
        WHEN NOT MATCHED THEN
          INSERT (UserId, DateOfBirth, Gender, LoyaltyPoint)
          VALUES (@userId, @dateOfBirth, @gender, 0);
      `)

    await transaction.commit()
    return { userId: input.userId, fullName: input.fullName, email: input.email }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function changeCustomerPassword(userId: number, currentPassword: string, newPassword: string) {
  const pool = await getPool()
  const account = await pool.request()
    .input('userId', sql.BigInt, userId)
    .query('SELECT PasswordHash FROM dbo.UserAccount WHERE UserId = @userId')
  const passwordHash = account.recordset[0]?.PasswordHash
  if (!passwordHash || !(await bcrypt.compare(currentPassword, passwordHash))) {
    throw new Error('Mật khẩu hiện tại không đúng.')
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await pool.request()
    .input('userId', sql.BigInt, userId)
    .input('passwordHash', sql.VarChar(255), newHash)
    .query(`
      UPDATE dbo.UserAccount
      SET PasswordHash = @passwordHash, UpdatedAt = SYSDATETIME()
      WHERE UserId = @userId
    `)
  return { changed: true }
}

export async function getCustomerAddresses(userId: number) {
  const pool = await getPool()
  const result = await pool.request()
    .input('userId', sql.BigInt, userId)
    .query(`
      SELECT
        AddressId AS addressId, ReceiverName AS receiverName,
        ReceiverPhone AS receiverPhone, Province AS province,
        District AS district, Ward AS ward, StreetAddress AS streetAddress,
        ProvinceCode AS provinceCode, WardCode AS wardCode,
        IsDefault AS isDefault, CreatedAt AS createdAt
      FROM dbo.Address
      WHERE UserId = @userId
      ORDER BY IsDefault DESC, AddressId DESC
    `)
  return result.recordset
}

async function getLocation(tx: () => sql.Request, provinceCode: string, wardCode: string) {
  const location = await tx()
    .input('provinceCode', sql.VarChar(10), provinceCode)
    .input('wardCode', sql.VarChar(10), wardCode)
    .query(`
      SELECT p.ProvinceName, w.WardName
      FROM dbo.AdministrativeWard w
      INNER JOIN dbo.AdministrativeProvince p ON p.ProvinceCode = w.ProvinceCode
      WHERE p.ProvinceCode = @provinceCode AND w.WardCode = @wardCode
    `)
  if (!location.recordset.length) throw new Error('Tỉnh/thành hoặc xã/phường không hợp lệ.')
  return {
    province: location.recordset[0].ProvinceName as string,
    ward: location.recordset[0].WardName as string,
  }
}

export async function createCustomerAddress(input: AddressInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)
    const count = await tx()
      .input('userId', sql.BigInt, input.userId)
      .query('SELECT COUNT(*) AS Total FROM dbo.Address WHERE UserId = @userId')
    const { province, ward } = await getLocation(tx, input.provinceCode, input.wardCode)
    const makeDefault = input.isDefault || Number(count.recordset[0].Total) === 0
    if (makeDefault) {
      await tx().input('userId', sql.BigInt, input.userId)
        .query('UPDATE dbo.Address SET IsDefault = 0 WHERE UserId = @userId')
    }
    const inserted = await tx()
      .input('userId', sql.BigInt, input.userId)
      .input('receiverName', sql.NVarChar(150), input.receiverName)
      .input('receiverPhone', sql.VarChar(20), input.receiverPhone)
      .input('province', sql.NVarChar(100), province)
      .input('district', sql.NVarChar(100), '')
      .input('ward', sql.NVarChar(100), ward)
      .input('streetAddress', sql.NVarChar(300), input.streetAddress)
      .input('provinceCode', sql.VarChar(10), input.provinceCode)
      .input('wardCode', sql.VarChar(10), input.wardCode)
      .input('isDefault', sql.Bit, makeDefault)
      .query(`
        INSERT dbo.Address (
          UserId, ReceiverName, ReceiverPhone, Province, District,
          Ward, StreetAddress, IsDefault, CreatedAt, ProvinceCode, WardCode
        )
        OUTPUT INSERTED.AddressId
        VALUES (
          @userId, @receiverName, @receiverPhone, @province, @district,
          @ward, @streetAddress, @isDefault, SYSDATETIME(), @provinceCode, @wardCode
        )
      `)
    await transaction.commit()
    return { addressId: inserted.recordset[0].AddressId as number }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function updateCustomerAddress(input: AddressInput & { addressId: number }) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)
    const { province, ward } = await getLocation(tx, input.provinceCode, input.wardCode)
    if (input.isDefault) {
      await tx().input('userId', sql.BigInt, input.userId)
        .query('UPDATE dbo.Address SET IsDefault = 0 WHERE UserId = @userId')
    }
    const result = await tx()
      .input('addressId', sql.BigInt, input.addressId)
      .input('userId', sql.BigInt, input.userId)
      .input('receiverName', sql.NVarChar(150), input.receiverName)
      .input('receiverPhone', sql.VarChar(20), input.receiverPhone)
      .input('province', sql.NVarChar(100), province)
      .input('district', sql.NVarChar(100), '')
      .input('ward', sql.NVarChar(100), ward)
      .input('streetAddress', sql.NVarChar(300), input.streetAddress)
      .input('provinceCode', sql.VarChar(10), input.provinceCode)
      .input('wardCode', sql.VarChar(10), input.wardCode)
      .input('isDefault', sql.Bit, input.isDefault)
      .query(`
        UPDATE dbo.Address
        SET ReceiverName=@receiverName, ReceiverPhone=@receiverPhone,
            Province=@province, District=@district, Ward=@ward,
            StreetAddress=@streetAddress, IsDefault=@isDefault,
            ProvinceCode=@provinceCode, WardCode=@wardCode
        WHERE AddressId=@addressId AND UserId=@userId
      `)
    if (result.rowsAffected[0] !== 1) throw new Error('Không tìm thấy địa chỉ.')
    await transaction.commit()
    return { addressId: input.addressId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function deleteCustomerAddress(userId: number, addressId: number) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)
    const current = await tx()
      .input('addressId', sql.BigInt, addressId)
      .input('userId', sql.BigInt, userId)
      .query('SELECT IsDefault FROM dbo.Address WHERE AddressId=@addressId AND UserId=@userId')
    if (!current.recordset.length) throw new Error('Không tìm thấy địa chỉ.')
    await tx()
      .input('addressId', sql.BigInt, addressId)
      .input('userId', sql.BigInt, userId)
      .query('DELETE dbo.Address WHERE AddressId=@addressId AND UserId=@userId')
    if (current.recordset[0].IsDefault) {
      await tx().input('userId', sql.BigInt, userId).query(`
        UPDATE dbo.Address SET IsDefault=1
        WHERE AddressId=(SELECT TOP 1 AddressId FROM dbo.Address WHERE UserId=@userId ORDER BY AddressId DESC)
      `)
    }
    await transaction.commit()
    return { addressId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function createReviewByOrderDetail(
  userId: number,
  orderDetailId: number,
  rating: number,
  comment: string,
) {
  const pool = await getPool()

  // Validate orderDetailId belongs to userId and order is Completed
  const eligibleResult = await pool.request()
    .input('userId', sql.BigInt, userId)
    .input('orderDetailId', sql.BigInt, orderDetailId)
    .query(`
      SELECT
        sod.OrderDetailId,
        sod.SkuId,
        ps.ProductId
      FROM dbo.SalesOrderDetail sod
      INNER JOIN dbo.SalesOrder so ON so.OrderId = sod.OrderId
      INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      INNER JOIN dbo.CustomerProfile cp ON cp.CustomerId = so.CustomerId
      INNER JOIN dbo.ProductSku ps ON ps.SkuId = sod.SkuId
      WHERE sod.OrderDetailId = @orderDetailId
        AND cp.UserId = @userId
        AND os.StatusCode = 'Completed'
    `)

  const eligible = eligibleResult.recordset[0]
  if (!eligible) {
    throw new Error('Bạn chỉ có thể đánh giá sản phẩm trong đơn hàng đã hoàn thành.')
  }

  // Check not already reviewed
  const existingResult = await pool.request()
    .input('userId', sql.BigInt, userId)
    .input('orderDetailId', sql.BigInt, orderDetailId)
    .query(`
      SELECT TOP 1 ReviewId FROM dbo.Review
      WHERE OrderDetailId = @orderDetailId
        AND UserId = @userId
        AND ContentType = 'Review'
    `)

  if (existingResult.recordset[0]) {
    throw new Error('Bạn đã đánh giá sản phẩm này rồi.')
  }

  const moderationRequired = await getReviewModerationRequired()
  const status = moderationRequired ? 'Pending' : 'Approved'

  const inserted = await pool.request()
    .input('productId', sql.BigInt, eligible.ProductId as number)
    .input('orderDetailId', sql.BigInt, orderDetailId)
    .input('userId', sql.BigInt, userId)
    .input('rating', sql.TinyInt, rating)
    .input('comment', sql.NVarChar(1000), comment)
    .input('status', sql.VarChar(20), status)
    .query(`
      INSERT INTO dbo.Review (
        ProductId, OrderDetailId, UserId, Rating, Comment,
        Status, CreatedAt, ParentReviewId, ContentType
      )
      OUTPUT INSERTED.ReviewId
      VALUES (
        @productId, @orderDetailId, @userId, @rating, @comment,
        @status, SYSDATETIME(), NULL, 'Review'
      )
    `)

  return { reviewId: inserted.recordset[0].ReviewId as number, status }
}

export async function getMyReviewedOrderDetails(userId: number) {
  const pool = await getPool()
  const result = await pool.request()
    .input('userId', sql.BigInt, userId)
    .query(`
      SELECT DISTINCT OrderDetailId AS orderDetailId
      FROM dbo.Review
      WHERE UserId = @userId AND ContentType = 'Review'
    `)
  return result.recordset.map((r: { orderDetailId: number }) => r.orderDetailId)
}
