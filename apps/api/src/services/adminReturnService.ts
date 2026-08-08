import { getPool, sql } from '../config/database.js'

export type ReturnRequestStatus = 'Pending' | 'Approved' | 'Rejected'

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
      rr.ImageUrl AS imageUrl,
      rr.Status AS status,
      rr.AdminNote AS adminNote,
      rr.CreatedAt AS createdAt,
      rr.ProcessedAt AS processedAt,
      procUa.FullName AS processedByName,
      so.TotalAmount AS totalAmount
    FROM dbo.OrderReturnRequest rr
    INNER JOIN dbo.SalesOrder so ON so.OrderId = rr.OrderId
    INNER JOIN dbo.UserAccount ua ON ua.UserId = rr.UserId
    LEFT JOIN dbo.UserAccount procUa ON procUa.UserId = rr.ProcessedBy
    ORDER BY
      CASE WHEN rr.Status = 'Pending' THEN 0 ELSE 1 END,
      rr.CreatedAt DESC
  `)

  return result.recordset
}

export async function updateReturnRequestStatus(
  returnRequestId: number,
  status: ReturnRequestStatus,
  adminNote: string | null,
  moderatorId: number
) {
  const allowed = new Set(['Pending', 'Approved', 'Rejected'])
  if (!allowed.has(status)) throw new Error('Trạng thái yêu cầu không hợp lệ.')

  const pool = await getPool()
  const result = await pool
    .request()
    .input('returnRequestId', sql.BigInt, returnRequestId)
    .input('status', sql.VarChar(20), status)
    .input('adminNote', sql.NVarChar(1000), adminNote || null)
    .input('moderatorId', sql.BigInt, moderatorId)
    .query(`
      UPDATE dbo.OrderReturnRequest
      SET Status = @status,
          AdminNote = @adminNote,
          ProcessedAt = SYSDATETIME(),
          ProcessedBy = @moderatorId
      WHERE ReturnRequestId = @returnRequestId

      SELECT @@ROWCOUNT AS affectedRows
    `)

  if (!Number(result.recordset[0]?.affectedRows)) {
    throw new Error('Không tìm thấy yêu cầu hoàn hàng.')
  }

  return { returnRequestId, status, adminNote }
}
