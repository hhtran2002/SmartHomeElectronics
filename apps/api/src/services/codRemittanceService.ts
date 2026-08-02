import { getPool, sql } from '../config/database.js'

export type CodRemittanceMethod = 'Cash' | 'BankTransfer'

type CreateRemittanceInput = {
  deliveryStaffId: number
  collectionIds: number[]
  method: CodRemittanceMethod
  referenceCode?: string | null
  note?: string | null
}

type AdminCodFilters = {
  deliveryStaffId?: number | null
  status?: string | null
  fromDate?: Date | null
  toDate?: Date | null
}

function asNumber(value: unknown) {
  return Number(value ?? 0)
}

function remittanceCode(deliveryStaffId: number) {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `CODR-${timestamp}-${deliveryStaffId}-${suffix}`
}

const collectionBalanceColumns = `
  collection.CodCollectionId AS codCollectionId,
  collection.PaymentId AS paymentId,
  collection.ShipmentId AS shipmentId,
  collection.OrderId AS orderId,
  collection.DeliveryStaffId AS deliveryStaffId,
  deliveryStaff.FullName AS deliveryStaffName,
  salesOrder.OrderCode AS orderCode,
  collection.CollectedAmount AS collectedAmount,
  collection.CollectedAt AS collectedAt,
  collection.Status AS storedStatus,
  COALESCE(amounts.ConfirmedAmount, 0) AS remittedAmount,
  COALESCE(amounts.PendingAmount, 0) AS pendingAmount,
  collection.CollectedAmount - COALESCE(amounts.ConfirmedAmount, 0) AS outstandingAmount,
  CASE
    WHEN collection.CollectedAmount - COALESCE(amounts.ConfirmedAmount, 0) - COALESCE(amounts.PendingAmount, 0) > 0
      THEN collection.CollectedAmount - COALESCE(amounts.ConfirmedAmount, 0) - COALESCE(amounts.PendingAmount, 0)
    ELSE 0
  END AS availableToSubmit,
  CASE
    WHEN COALESCE(amounts.ConfirmedAmount, 0) >= collection.CollectedAmount THEN 'Settled'
    WHEN COALESCE(amounts.PendingAmount, 0) > 0 THEN 'AwaitingConfirmation'
    WHEN COALESCE(amounts.ConfirmedAmount, 0) > 0 THEN 'PartiallyRemitted'
    ELSE 'Outstanding'
  END AS status
`

const collectionBalanceJoins = `
  INNER JOIN dbo.SalesOrder salesOrder ON salesOrder.OrderId = collection.OrderId
  INNER JOIN dbo.UserAccount deliveryStaff ON deliveryStaff.UserId = collection.DeliveryStaffId
  OUTER APPLY (
    SELECT
      SUM(CASE WHEN remittance.Status = 'Confirmed' THEN item.Amount ELSE 0 END) AS ConfirmedAmount,
      SUM(CASE WHEN remittance.Status = 'Submitted' THEN item.Amount ELSE 0 END) AS PendingAmount
    FROM dbo.CodRemittanceItem item
    INNER JOIN dbo.CodRemittance remittance
      ON remittance.CodRemittanceId = item.CodRemittanceId
    WHERE item.CodCollectionId = collection.CodCollectionId
  ) amounts
`

export async function getMyCodAccount(deliveryStaffId: number) {
  const pool = await getPool()
  const result = await pool.request()
    .input('deliveryStaffId', sql.BigInt, deliveryStaffId)
    .query(`
      WITH balances AS (
        SELECT
          collection.CollectedAmount,
          collection.CollectedAt,
          COALESCE(amounts.ConfirmedAmount, 0) AS ConfirmedAmount,
          COALESCE(amounts.PendingAmount, 0) AS PendingAmount
        FROM dbo.CodCollection collection
        OUTER APPLY (
          SELECT
            SUM(CASE WHEN remittance.Status = 'Confirmed' THEN item.Amount ELSE 0 END) AS ConfirmedAmount,
            SUM(CASE WHEN remittance.Status = 'Submitted' THEN item.Amount ELSE 0 END) AS PendingAmount
          FROM dbo.CodRemittanceItem item
          INNER JOIN dbo.CodRemittance remittance
            ON remittance.CodRemittanceId = item.CodRemittanceId
          WHERE item.CodCollectionId = collection.CodCollectionId
        ) amounts
        WHERE collection.DeliveryStaffId = @deliveryStaffId
      )
      SELECT
        COALESCE(SUM(CollectedAmount), 0) AS totalCollected,
        COALESCE(SUM(CASE WHEN CONVERT(date, CollectedAt) = CONVERT(date, SYSDATETIME()) THEN CollectedAmount ELSE 0 END), 0) AS collectedToday,
        COALESCE(SUM(ConfirmedAmount), 0) AS totalRemitted,
        COALESCE(SUM(PendingAmount), 0) AS pendingConfirmation,
        COALESCE(SUM(CollectedAmount - ConfirmedAmount), 0) AS outstandingAmount,
        COALESCE(SUM(CASE WHEN CollectedAmount - ConfirmedAmount - PendingAmount > 0 THEN CollectedAmount - ConfirmedAmount - PendingAmount ELSE 0 END), 0) AS availableToSubmit
      FROM balances;

      SELECT ${collectionBalanceColumns}
      FROM dbo.CodCollection collection
      ${collectionBalanceJoins}
      WHERE collection.DeliveryStaffId = @deliveryStaffId
      ORDER BY collection.CollectedAt DESC, collection.CodCollectionId DESC;

      SELECT
        remittance.CodRemittanceId AS codRemittanceId,
        remittance.RemittanceCode AS remittanceCode,
        remittance.DeliveryStaffId AS deliveryStaffId,
        remittance.DeclaredAmount AS declaredAmount,
        remittance.Method AS method,
        remittance.Status AS status,
        remittance.SubmittedAt AS submittedAt,
        remittance.ReviewedAt AS reviewedAt,
        remittance.ReferenceCode AS referenceCode,
        remittance.Note AS note,
        remittance.ReviewNote AS reviewNote,
        reviewer.FullName AS reviewedByName,
        COUNT(item.CodCollectionId) AS itemCount,
        STRING_AGG(CONVERT(VARCHAR(MAX), salesOrder.OrderCode), ', ') AS orderCodes
      FROM dbo.CodRemittance remittance
      LEFT JOIN dbo.CodRemittanceItem item
        ON item.CodRemittanceId = remittance.CodRemittanceId
      LEFT JOIN dbo.CodCollection collection
        ON collection.CodCollectionId = item.CodCollectionId
      LEFT JOIN dbo.SalesOrder salesOrder ON salesOrder.OrderId = collection.OrderId
      LEFT JOIN dbo.UserAccount reviewer ON reviewer.UserId = remittance.ReviewedByUserId
      WHERE remittance.DeliveryStaffId = @deliveryStaffId
      GROUP BY
        remittance.CodRemittanceId, remittance.RemittanceCode,
        remittance.DeliveryStaffId, remittance.DeclaredAmount,
        remittance.Method, remittance.Status, remittance.SubmittedAt,
        remittance.ReviewedAt, remittance.ReferenceCode, remittance.Note,
        remittance.ReviewNote, reviewer.FullName
      ORDER BY remittance.SubmittedAt DESC, remittance.CodRemittanceId DESC;
    `)

  const recordsets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>
  return {
    summary: recordsets[0][0],
    collections: recordsets[1],
    remittances: recordsets[2],
  }
}

export async function createCodRemittance(input: CreateRemittanceInput) {
  const collectionIds = [...new Set(input.collectionIds)]
  if (!collectionIds.length) throw new Error('Vui lòng chọn ít nhất một khoản COD cần nộp.')
  if (collectionIds.length > 100) throw new Error('Mỗi phiếu chỉ được chứa tối đa 100 khoản COD.')
  if (input.method === 'BankTransfer' && !input.referenceCode?.trim()) {
    throw new Error('Vui lòng nhập mã tham chiếu chuyển khoản.')
  }

  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
    const request = new sql.Request(transaction).input('deliveryStaffId', sql.BigInt, input.deliveryStaffId)
    const parameters = collectionIds.map((collectionId, index) => {
      request.input(`collectionId${index}`, sql.BigInt, collectionId)
      return `@collectionId${index}`
    })
    const selected = await request.query(`
      SELECT
        collection.CodCollectionId,
        collection.CollectedAmount,
        COALESCE(SUM(CASE WHEN remittance.Status = 'Confirmed' THEN item.Amount ELSE 0 END), 0) AS ConfirmedAmount,
        COALESCE(SUM(CASE WHEN remittance.Status = 'Submitted' THEN item.Amount ELSE 0 END), 0) AS PendingAmount
      FROM dbo.CodCollection collection WITH (UPDLOCK, HOLDLOCK)
      LEFT JOIN dbo.CodRemittanceItem item WITH (UPDLOCK, HOLDLOCK)
        ON item.CodCollectionId = collection.CodCollectionId
      LEFT JOIN dbo.CodRemittance remittance WITH (UPDLOCK, HOLDLOCK)
        ON remittance.CodRemittanceId = item.CodRemittanceId
      WHERE collection.DeliveryStaffId = @deliveryStaffId
        AND collection.CodCollectionId IN (${parameters.join(', ')})
      GROUP BY collection.CodCollectionId, collection.CollectedAmount
      ORDER BY collection.CodCollectionId;
    `)
    if (selected.recordset.length !== collectionIds.length) {
      throw new Error('Có khoản COD không tồn tại hoặc không thuộc tài khoản của bạn.')
    }

    const allocations = selected.recordset.map((row) => ({
      collectionId: asNumber(row.CodCollectionId),
      amount: asNumber(row.CollectedAmount) - asNumber(row.ConfirmedAmount) - asNumber(row.PendingAmount),
    }))
    if (allocations.some((item) => item.amount <= 0)) {
      throw new Error('Có khoản COD đã được nộp hoặc đang chờ xác nhận.')
    }
    const declaredAmount = allocations.reduce((sum, item) => sum + item.amount, 0)
    const code = remittanceCode(input.deliveryStaffId)
    const inserted = await new sql.Request(transaction)
      .input('remittanceCode', sql.VarChar(50), code)
      .input('deliveryStaffId', sql.BigInt, input.deliveryStaffId)
      .input('declaredAmount', sql.Decimal(18, 2), declaredAmount)
      .input('method', sql.VarChar(30), input.method)
      .input('referenceCode', sql.VarChar(100), input.referenceCode?.trim() || null)
      .input('note', sql.NVarChar(500), input.note?.trim() || null)
      .query(`
        INSERT INTO dbo.CodRemittance (
          RemittanceCode, DeliveryStaffId, DeclaredAmount, Method, Status,
          SubmittedByUserId, SubmittedAt, ReferenceCode, Note, CreatedAt
        )
        OUTPUT INSERTED.CodRemittanceId
        VALUES (
          @remittanceCode, @deliveryStaffId, @declaredAmount, @method, 'Submitted',
          @deliveryStaffId, SYSDATETIME(), @referenceCode, @note, SYSDATETIME()
        );
      `)
    const codRemittanceId = asNumber(inserted.recordset[0].CodRemittanceId)
    for (const allocation of allocations) {
      await new sql.Request(transaction)
        .input('codRemittanceId', sql.BigInt, codRemittanceId)
        .input('codCollectionId', sql.BigInt, allocation.collectionId)
        .input('amount', sql.Decimal(18, 2), allocation.amount)
        .query(`
          INSERT INTO dbo.CodRemittanceItem (CodRemittanceId, CodCollectionId, Amount)
          VALUES (@codRemittanceId, @codCollectionId, @amount);
        `)
    }
    await new sql.Request(transaction)
      .input('codRemittanceId', sql.BigInt, codRemittanceId)
      .input('deliveryStaffId', sql.BigInt, input.deliveryStaffId)
      .query(`
        INSERT INTO dbo.CodRemittanceStatusHistory (
          CodRemittanceId, FromStatus, ToStatus, ChangedByUserId, Note, ChangedAt
        )
        VALUES (
          @codRemittanceId, NULL, 'Submitted', @deliveryStaffId,
          N'Shipper tạo phiếu nộp tiền COD.', SYSDATETIME()
        );
      `)
    await transaction.commit()
    return { codRemittanceId, remittanceCode: code, declaredAmount, status: 'Submitted' }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function cancelMyCodRemittance(codRemittanceId: number, deliveryStaffId: number) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin()
    const current = await new sql.Request(transaction)
      .input('codRemittanceId', sql.BigInt, codRemittanceId)
      .input('deliveryStaffId', sql.BigInt, deliveryStaffId)
      .query(`
        SELECT CodRemittanceId, Status
        FROM dbo.CodRemittance WITH (UPDLOCK, ROWLOCK)
        WHERE CodRemittanceId = @codRemittanceId
          AND DeliveryStaffId = @deliveryStaffId;
      `)
    if (!current.recordset[0]) throw new Error('Không tìm thấy phiếu nộp tiền COD.')
    if (current.recordset[0].Status !== 'Submitted') {
      throw new Error('Chỉ có thể hủy phiếu đang chờ xác nhận.')
    }
    await new sql.Request(transaction)
      .input('codRemittanceId', sql.BigInt, codRemittanceId)
      .query(`
        UPDATE dbo.CodRemittance
        SET Status = 'Cancelled', UpdatedAt = SYSDATETIME()
        WHERE CodRemittanceId = @codRemittanceId;
      `)
    await new sql.Request(transaction)
      .input('codRemittanceId', sql.BigInt, codRemittanceId)
      .input('deliveryStaffId', sql.BigInt, deliveryStaffId)
      .query(`
        INSERT INTO dbo.CodRemittanceStatusHistory (
          CodRemittanceId, FromStatus, ToStatus, ChangedByUserId, Note, ChangedAt
        )
        VALUES (
          @codRemittanceId, 'Submitted', 'Cancelled', @deliveryStaffId,
          N'Shipper hủy phiếu trước khi được xác nhận.', SYSDATETIME()
        );
      `)
    await transaction.commit()
    return { codRemittanceId, status: 'Cancelled' }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function getAdminCodOverview(filters: AdminCodFilters) {
  const pool = await getPool()
  const request = pool.request()
    .input('deliveryStaffId', sql.BigInt, filters.deliveryStaffId ?? null)
    .input('status', sql.VarChar(30), filters.status ?? null)
    .input('fromDate', sql.DateTime2, filters.fromDate ?? null)
    .input('toDate', sql.DateTime2, filters.toDate ?? null)
  const result = await request.query(`
    WITH filteredBalances AS (
      SELECT
        collection.DeliveryStaffId,
        collection.CollectedAmount,
        COALESCE(amounts.ConfirmedAmount, 0) AS ConfirmedAmount,
        COALESCE(amounts.PendingAmount, 0) AS PendingAmount
      FROM dbo.CodCollection collection
      OUTER APPLY (
        SELECT
          SUM(CASE WHEN remittance.Status = 'Confirmed' THEN item.Amount ELSE 0 END) AS ConfirmedAmount,
          SUM(CASE WHEN remittance.Status = 'Submitted' THEN item.Amount ELSE 0 END) AS PendingAmount
        FROM dbo.CodRemittanceItem item
        INNER JOIN dbo.CodRemittance remittance
          ON remittance.CodRemittanceId = item.CodRemittanceId
        WHERE item.CodCollectionId = collection.CodCollectionId
      ) amounts
      WHERE (@deliveryStaffId IS NULL OR collection.DeliveryStaffId = @deliveryStaffId)
        AND (@fromDate IS NULL OR collection.CollectedAt >= @fromDate)
        AND (@toDate IS NULL OR collection.CollectedAt < DATEADD(DAY, 1, @toDate))
    )
    SELECT
      COALESCE(SUM(CollectedAmount), 0) AS totalCollected,
      COALESCE(SUM(ConfirmedAmount), 0) AS totalRemitted,
      COALESCE(SUM(PendingAmount), 0) AS pendingConfirmation,
      COALESCE(SUM(CollectedAmount - ConfirmedAmount), 0) AS outstandingAmount
    FROM filteredBalances;

    WITH staffBalances AS (
      SELECT
        collection.DeliveryStaffId,
        collection.CollectedAmount,
        COALESCE(amounts.ConfirmedAmount, 0) AS ConfirmedAmount,
        COALESCE(amounts.PendingAmount, 0) AS PendingAmount
      FROM dbo.CodCollection collection
      OUTER APPLY (
        SELECT
          SUM(CASE WHEN remittance.Status = 'Confirmed' THEN item.Amount ELSE 0 END) AS ConfirmedAmount,
          SUM(CASE WHEN remittance.Status = 'Submitted' THEN item.Amount ELSE 0 END) AS PendingAmount
        FROM dbo.CodRemittanceItem item
        INNER JOIN dbo.CodRemittance remittance
          ON remittance.CodRemittanceId = item.CodRemittanceId
        WHERE item.CodCollectionId = collection.CodCollectionId
      ) amounts
      WHERE (@deliveryStaffId IS NULL OR collection.DeliveryStaffId = @deliveryStaffId)
        AND (@fromDate IS NULL OR collection.CollectedAt >= @fromDate)
        AND (@toDate IS NULL OR collection.CollectedAt < DATEADD(DAY, 1, @toDate))
    )
    SELECT
      staff.UserId AS deliveryStaffId,
      staff.FullName AS deliveryStaffName,
      staff.Phone AS phone,
      COUNT(*) AS collectionCount,
      SUM(balance.CollectedAmount) AS collectedAmount,
      SUM(balance.ConfirmedAmount) AS remittedAmount,
      SUM(balance.PendingAmount) AS pendingAmount,
      SUM(balance.CollectedAmount - balance.ConfirmedAmount) AS outstandingAmount
    FROM staffBalances balance
    INNER JOIN dbo.UserAccount staff ON staff.UserId = balance.DeliveryStaffId
    GROUP BY staff.UserId, staff.FullName, staff.Phone
    ORDER BY outstandingAmount DESC, staff.FullName;

    SELECT ${collectionBalanceColumns}
    FROM dbo.CodCollection collection
    ${collectionBalanceJoins}
    WHERE (@deliveryStaffId IS NULL OR collection.DeliveryStaffId = @deliveryStaffId)
      AND (@fromDate IS NULL OR collection.CollectedAt >= @fromDate)
      AND (@toDate IS NULL OR collection.CollectedAt < DATEADD(DAY, 1, @toDate))
    ORDER BY collection.CollectedAt DESC, collection.CodCollectionId DESC;

    SELECT
      remittance.CodRemittanceId AS codRemittanceId,
      remittance.RemittanceCode AS remittanceCode,
      remittance.DeliveryStaffId AS deliveryStaffId,
      staff.FullName AS deliveryStaffName,
      remittance.DeclaredAmount AS declaredAmount,
      remittance.Method AS method,
      remittance.Status AS status,
      remittance.SubmittedAt AS submittedAt,
      remittance.ReviewedAt AS reviewedAt,
      remittance.ReferenceCode AS referenceCode,
      remittance.Note AS note,
      remittance.ReviewNote AS reviewNote,
      reviewer.FullName AS reviewedByName,
      COUNT(item.CodCollectionId) AS itemCount,
      STRING_AGG(CONVERT(VARCHAR(MAX), salesOrder.OrderCode), ', ') AS orderCodes
    FROM dbo.CodRemittance remittance
    INNER JOIN dbo.UserAccount staff ON staff.UserId = remittance.DeliveryStaffId
    LEFT JOIN dbo.CodRemittanceItem item
      ON item.CodRemittanceId = remittance.CodRemittanceId
    LEFT JOIN dbo.CodCollection collection
      ON collection.CodCollectionId = item.CodCollectionId
    LEFT JOIN dbo.SalesOrder salesOrder ON salesOrder.OrderId = collection.OrderId
    LEFT JOIN dbo.UserAccount reviewer ON reviewer.UserId = remittance.ReviewedByUserId
    WHERE (@deliveryStaffId IS NULL OR remittance.DeliveryStaffId = @deliveryStaffId)
      AND (@status IS NULL OR remittance.Status = @status)
      AND (@fromDate IS NULL OR remittance.SubmittedAt >= @fromDate)
      AND (@toDate IS NULL OR remittance.SubmittedAt < DATEADD(DAY, 1, @toDate))
    GROUP BY
      remittance.CodRemittanceId, remittance.RemittanceCode,
      remittance.DeliveryStaffId, staff.FullName, remittance.DeclaredAmount,
      remittance.Method, remittance.Status, remittance.SubmittedAt,
      remittance.ReviewedAt, remittance.ReferenceCode, remittance.Note,
      remittance.ReviewNote, reviewer.FullName
    ORDER BY
      CASE remittance.Status WHEN 'Submitted' THEN 0 ELSE 1 END,
      remittance.SubmittedAt DESC, remittance.CodRemittanceId DESC;

    SELECT userAccount.UserId AS userId, userAccount.FullName AS fullName
    FROM dbo.UserAccount userAccount
    INNER JOIN dbo.UserRole userRole ON userRole.UserId = userAccount.UserId
    INNER JOIN dbo.Role role ON role.RoleId = userRole.RoleId
    INNER JOIN dbo.EmployeeProfile employeeProfile ON employeeProfile.UserId = userAccount.UserId
    WHERE role.RoleCode = 'DeliveryStaff'
      AND userAccount.Status = 'Active'
      AND employeeProfile.ApprovalStatus = 'Approved'
    ORDER BY userAccount.FullName;
  `)
  const recordsets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>
  return {
    summary: recordsets[0][0],
    shipperBalances: recordsets[1],
    collections: recordsets[2],
    remittances: recordsets[3],
    deliveryStaff: recordsets[4],
  }
}

async function reviewCodRemittance(
  codRemittanceId: number,
  reviewerUserId: number,
  targetStatus: 'Confirmed' | 'Rejected',
  reviewNote: string,
) {
  if (targetStatus === 'Rejected' && !reviewNote.trim()) {
    throw new Error('Vui lòng nhập lý do từ chối phiếu.')
  }
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE)
    const current = await new sql.Request(transaction)
      .input('codRemittanceId', sql.BigInt, codRemittanceId)
      .query(`
        SELECT CodRemittanceId, DeclaredAmount, Status
        FROM dbo.CodRemittance WITH (UPDLOCK, HOLDLOCK)
        WHERE CodRemittanceId = @codRemittanceId;
      `)
    const remittance = current.recordset[0]
    if (!remittance) throw new Error('Không tìm thấy phiếu nộp tiền COD.')
    if (remittance.Status !== 'Submitted') throw new Error('Phiếu này đã được xử lý trước đó.')

    if (targetStatus === 'Confirmed') {
      const validation = await new sql.Request(transaction)
        .input('codRemittanceId', sql.BigInt, codRemittanceId)
        .query(`
          SELECT
            item.CodCollectionId,
            item.Amount,
            collection.CollectedAmount,
            COALESCE(confirmed.ConfirmedAmount, 0) AS PreviouslyConfirmedAmount
          FROM dbo.CodRemittanceItem item WITH (UPDLOCK, HOLDLOCK)
          INNER JOIN dbo.CodCollection collection WITH (UPDLOCK, HOLDLOCK)
            ON collection.CodCollectionId = item.CodCollectionId
          OUTER APPLY (
            SELECT SUM(otherItem.Amount) AS ConfirmedAmount
            FROM dbo.CodRemittanceItem otherItem
            INNER JOIN dbo.CodRemittance otherRemittance
              ON otherRemittance.CodRemittanceId = otherItem.CodRemittanceId
            WHERE otherItem.CodCollectionId = item.CodCollectionId
              AND otherRemittance.Status = 'Confirmed'
          ) confirmed
          WHERE item.CodRemittanceId = @codRemittanceId;
        `)
      if (!validation.recordset.length) throw new Error('Phiếu nộp tiền không có đơn COD nào.')
      const allocatedAmount = validation.recordset.reduce((sum, row) => sum + asNumber(row.Amount), 0)
      if (Math.abs(allocatedAmount - asNumber(remittance.DeclaredAmount)) > 0.001) {
        throw new Error('Tổng chi tiết không khớp số tiền khai báo của phiếu.')
      }
      if (validation.recordset.some((row) => (
        asNumber(row.PreviouslyConfirmedAmount) + asNumber(row.Amount) > asNumber(row.CollectedAmount)
      ))) {
        throw new Error('Có khoản COD đã được xác nhận đủ tiền trước đó.')
      }
    }

    await new sql.Request(transaction)
      .input('codRemittanceId', sql.BigInt, codRemittanceId)
      .input('status', sql.VarChar(30), targetStatus)
      .input('reviewerUserId', sql.BigInt, reviewerUserId)
      .input('reviewNote', sql.NVarChar(500), reviewNote.trim() || null)
      .query(`
        UPDATE dbo.CodRemittance
        SET Status = @status,
            ReviewedByUserId = @reviewerUserId,
            ReviewedAt = SYSDATETIME(),
            ReviewNote = @reviewNote,
            UpdatedAt = SYSDATETIME()
        WHERE CodRemittanceId = @codRemittanceId;
      `)
    await new sql.Request(transaction)
      .input('codRemittanceId', sql.BigInt, codRemittanceId)
      .input('status', sql.VarChar(30), targetStatus)
      .input('reviewerUserId', sql.BigInt, reviewerUserId)
      .input('reviewNote', sql.NVarChar(500), reviewNote.trim() || null)
      .query(`
        INSERT INTO dbo.CodRemittanceStatusHistory (
          CodRemittanceId, FromStatus, ToStatus, ChangedByUserId, Note, ChangedAt
        )
        VALUES (
          @codRemittanceId, 'Submitted', @status, @reviewerUserId,
          @reviewNote, SYSDATETIME()
        );
      `)

    if (targetStatus === 'Confirmed') {
      await new sql.Request(transaction)
        .input('codRemittanceId', sql.BigInt, codRemittanceId)
        .query(`
          UPDATE collection
          SET Status = CASE
                WHEN confirmed.ConfirmedAmount >= collection.CollectedAmount THEN 'Settled'
                WHEN confirmed.ConfirmedAmount > 0 THEN 'PartiallyRemitted'
                ELSE 'Outstanding'
              END,
              UpdatedAt = SYSDATETIME()
          FROM dbo.CodCollection collection
          INNER JOIN dbo.CodRemittanceItem currentItem
            ON currentItem.CodCollectionId = collection.CodCollectionId
           AND currentItem.CodRemittanceId = @codRemittanceId
          CROSS APPLY (
            SELECT COALESCE(SUM(item.Amount), 0) AS ConfirmedAmount
            FROM dbo.CodRemittanceItem item
            INNER JOIN dbo.CodRemittance remittance
              ON remittance.CodRemittanceId = item.CodRemittanceId
            WHERE item.CodCollectionId = collection.CodCollectionId
              AND remittance.Status = 'Confirmed'
          ) confirmed;
        `)
    }
    await transaction.commit()
    return { codRemittanceId, status: targetStatus }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export function confirmCodRemittance(codRemittanceId: number, reviewerUserId: number, reviewNote: string) {
  return reviewCodRemittance(codRemittanceId, reviewerUserId, 'Confirmed', reviewNote)
}

export function rejectCodRemittance(codRemittanceId: number, reviewerUserId: number, reviewNote: string) {
  return reviewCodRemittance(codRemittanceId, reviewerUserId, 'Rejected', reviewNote)
}
