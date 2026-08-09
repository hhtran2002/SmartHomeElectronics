import { getPool, sql } from '../config/database.js'

export type ReturnRequestStatus = 'Pending' | 'Approved' | 'Rejected'
export type RefundStatus = 'Pending' | 'Processing' | 'Refunded' | 'Failed'

export async function getAdminReturnRequests() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT TOP (200)
      rr.ReturnRequestId AS returnRequestId,
      rr.OrderId AS orderId,
      so.OrderCode AS orderCode,
      rr.UserId AS userId,
      ua.FullName AS customerName,
      ua.Phone AS phone,
      ua.Email AS email,
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
      rr.ProcessedAt AS processedAt,
      procUa.FullName AS processedByName,
      so.TotalAmount AS totalAmount,
      rr.DeliveryStaffId AS deliveryStaffId,
      staffUa.FullName AS deliveryStaffName,
      staffUa.Phone AS deliveryStaffPhone,
      rr.ReturnShipmentId AS returnShipmentId,
      rr.WarehouseConfirmedAt AS warehouseConfirmedAt,
      whUa.FullName AS warehouseConfirmedByName
    FROM dbo.OrderReturnRequest rr
    INNER JOIN dbo.SalesOrder so ON so.OrderId = rr.OrderId
    INNER JOIN dbo.UserAccount ua ON ua.UserId = rr.UserId
    LEFT JOIN dbo.UserAccount procUa ON procUa.UserId = rr.ProcessedBy
    LEFT JOIN dbo.UserAccount staffUa ON staffUa.UserId = rr.DeliveryStaffId
    LEFT JOIN dbo.UserAccount whUa ON whUa.UserId = rr.WarehouseConfirmedBy
    ORDER BY
      CASE WHEN rr.Status = 'Pending' THEN 0 ELSE 1 END,
      rr.CreatedAt DESC
  `)

  return result.recordset
}

export async function updateReturnRequestStatus(input: {
  returnRequestId: number
  status: ReturnRequestStatus
  refundStatus?: RefundStatus
  refundAmount?: number | null
  adminNote?: string | null
  deliveryStaffId?: number | null
  moderatorId: number
}) {
  const allowedStatus = new Set(['Pending', 'Approved', 'Rejected'])
  if (!allowedStatus.has(input.status)) throw new Error('Trạng thái yêu cầu không hợp lệ.')

  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const returnReqResult = await tx()
      .input('returnRequestId', sql.BigInt, input.returnRequestId)
      .query(`
        SELECT ReturnRequestId, OrderId, Status, WarehouseConfirmedAt
        FROM dbo.OrderReturnRequest WITH (UPDLOCK, ROWLOCK)
        WHERE ReturnRequestId = @returnRequestId
      `)
    const currentReq = returnReqResult.recordset[0]
    if (!currentReq) throw new Error('Không tìm thấy yêu cầu hoàn hàng.')

    // If trying to set refundStatus = 'Refunded', ensure WarehouseConfirmedAt is NOT NULL
    if (input.refundStatus === 'Refunded' && !currentReq.WarehouseConfirmedAt && input.status === 'Approved') {
      throw new Error('Chưa thể bấm hoàn tiền thành công! Thủ kho phải bấm xác nhận sản phẩm đã nhập kho hoàn trả trước khi kế toán hoàn tiền.')
    }

    await tx()
      .input('returnRequestId', sql.BigInt, input.returnRequestId)
      .input('status', sql.VarChar(20), input.status)
      .input('refundStatus', sql.VarChar(20), input.refundStatus || (input.status === 'Approved' ? 'Processing' : 'Pending'))
      .input('refundAmount', sql.Decimal(18, 2), input.refundAmount ?? null)
      .input('adminNote', sql.NVarChar(1000), input.adminNote || null)
      .input('deliveryStaffId', sql.BigInt, input.deliveryStaffId ?? null)
      .input('moderatorId', sql.BigInt, input.moderatorId)
      .query(`
        UPDATE dbo.OrderReturnRequest
        SET Status = @status,
            RefundStatus = @refundStatus,
            RefundAmount = ISNULL(@refundAmount, RefundAmount),
            AdminNote = @adminNote,
            DeliveryStaffId = ISNULL(@deliveryStaffId, DeliveryStaffId),
            ProcessedAt = SYSDATETIME(),
            ProcessedBy = @moderatorId
        WHERE ReturnRequestId = @returnRequestId
      `)

    await transaction.commit()

    return {
      returnRequestId: input.returnRequestId,
      status: input.status,
      refundStatus: input.refundStatus,
      refundAmount: input.refundAmount,
      adminNote: input.adminNote,
      deliveryStaffId: input.deliveryStaffId,
    }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function confirmWarehouseReturnStockIn(returnRequestId: number, warehouseUserId: number) {
  const pool = await getPool()
  const result = await pool.request()
    .input('returnRequestId', sql.BigInt, returnRequestId)
    .input('warehouseUserId', sql.BigInt, warehouseUserId)
    .query(`
      UPDATE dbo.OrderReturnRequest
      SET WarehouseConfirmedAt = SYSDATETIME(),
          WarehouseConfirmedBy = @warehouseUserId,
          RefundStatus = 'Processing'
      WHERE ReturnRequestId = @returnRequestId
        AND Status = 'Approved'

      SELECT @@ROWCOUNT AS affectedRows
    `)

  if (!Number(result.recordset[0]?.affectedRows)) {
    throw new Error('Không thể xác nhận nhập kho cho yêu cầu này (hoặc yêu cầu chưa được CSKH duyệt).')
  }

  return { returnRequestId, warehouseConfirmedAt: new Date().toISOString() }
}
