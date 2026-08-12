import { getPool, sql } from '../config/database.js'

export type ReturnRequestStatus = 'Pending' | 'Approved' | 'Rejected'
export type RefundStatus = 'Pending' | 'Processing' | 'Refunded' | 'Failed'
export type ReturnWorkflowStatus = 'Reviewing' | 'Returning' | 'Refunded'

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
      whUa.FullName AS warehouseConfirmedByName,
      rr.InventoryRestockedAt AS inventoryRestockedAt,
      CASE
        WHEN rr.Status = 'Rejected' THEN 'Rejected'
        WHEN rr.RefundStatus = 'Refunded' AND rr.InventoryRestockedAt IS NOT NULL THEN 'Refunded'
        WHEN rr.RefundStatus IN ('Processing', 'Refunded') THEN 'Returning'
        ELSE 'Reviewing'
      END AS workflowStatus
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

export async function updateReturnWorkflow(input: {
  returnRequestId: number
  workflowStatus: ReturnWorkflowStatus
  adminUserId: number
}) {
  const allowed = new Set<ReturnWorkflowStatus>(['Reviewing', 'Returning', 'Refunded'])
  if (!allowed.has(input.workflowStatus)) throw new Error('Trạng thái hoàn hàng không hợp lệ.')

  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)
    const currentResult = await tx().input('returnRequestId', sql.BigInt, input.returnRequestId).query(`
      SELECT rr.ReturnRequestId, rr.OrderId, rr.Status, rr.RefundStatus, rr.RefundAmount,
        rr.InventoryRestockedAt, so.TotalAmount
      FROM dbo.OrderReturnRequest rr WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN dbo.SalesOrder so ON so.OrderId = rr.OrderId
      WHERE rr.ReturnRequestId = @returnRequestId
    `)
    const current = currentResult.recordset[0]
    if (!current) throw new Error('Không tìm thấy yêu cầu hoàn hàng.')

    if (current.InventoryRestockedAt && input.workflowStatus !== 'Refunded') {
      throw new Error('Yêu cầu đã hoàn tiền và trả tồn kho nên không thể chuyển về trạng thái trước đó.')
    }

    if (current.Status === 'Rejected') {
      throw new Error('Yêu cầu đã bị từ chối nên không thể tiếp tục xử lý hoàn hàng.')
    }

    if (input.workflowStatus === 'Reviewing') {
      if (current.Status !== 'Pending' || current.RefundStatus !== 'Pending') {
        throw new Error('Không thể chuyển yêu cầu đã duyệt về trạng thái chờ xử lý.')
      }
    } else if (input.workflowStatus === 'Returning') {
      if (!['Pending', 'Approved'].includes(String(current.Status)) || !['Pending', 'Processing'].includes(String(current.RefundStatus))) {
        throw new Error('Chỉ yêu cầu đang chờ xử lý mới có thể được duyệt hoàn hàng.')
      }
      await tx().input('returnRequestId', sql.BigInt, input.returnRequestId).input('adminUserId', sql.BigInt, input.adminUserId).query(`
        UPDATE dbo.OrderReturnRequest SET Status = 'Approved', RefundStatus = 'Processing',
          ProcessedAt = SYSDATETIME(), ProcessedBy = @adminUserId
        WHERE ReturnRequestId = @returnRequestId
      `)
    } else if (!current.InventoryRestockedAt) {
      if (current.Status !== 'Approved' || current.RefundStatus !== 'Processing') {
        throw new Error('Phải duyệt yêu cầu hoàn hàng trước khi xác nhận đã nhận hàng và hoàn tiền.')
      }
      const exportedItems = await tx().input('orderId', sql.BigInt, current.OrderId).query(`
        SELECT receipt.WarehouseId, detail.OrderDetailId, detail.SkuId,
          SUM(detail.Quantity) AS Quantity, MAX(detail.UnitCost) AS UnitCost
        FROM dbo.StockOutReceipt receipt
        INNER JOIN dbo.StockOutReceiptDetail detail ON detail.StockOutReceiptId = receipt.StockOutReceiptId
        WHERE receipt.OrderId = @orderId AND receipt.Reason = 'Order' AND receipt.Status = 'Confirmed'
        GROUP BY receipt.WarehouseId, detail.OrderDetailId, detail.SkuId
      `)
      if (!exportedItems.recordset.length) throw new Error('Không tìm thấy phiếu xuất kho gốc của đơn để nhập trả tồn kho.')

      const receiptIds = new Map<number, number>()
      for (const item of exportedItems.recordset) {
        const warehouseId = Number(item.WarehouseId)
        const quantity = Number(item.Quantity)
        const unitCost = Number(item.UnitCost)
        let receiptId = receiptIds.get(warehouseId)
        if (!receiptId) {
          const receiptCode = `RET-REQ-${input.returnRequestId}-${warehouseId}`
          const existingReceipt = await tx().input('receiptCode', sql.VarChar(50), receiptCode).query(`
            SELECT StockInReceiptId FROM dbo.StockInReceipt WITH (UPDLOCK, HOLDLOCK) WHERE ReceiptCode = @receiptCode
          `)
          if (existingReceipt.recordset.length) throw new Error('Yêu cầu này đã có phiếu nhập hoàn hàng.')
          const inserted = await tx()
            .input('receiptCode', sql.VarChar(50), receiptCode)
            .input('warehouseId', sql.BigInt, warehouseId)
            .input('adminUserId', sql.BigInt, input.adminUserId)
            .query(`
              INSERT INTO dbo.StockInReceipt (ReceiptCode, WarehouseId, SupplierId, CreatedByUserId, ReceiptDate, Status, Note)
              OUTPUT INSERTED.StockInReceiptId
              VALUES (@receiptCode, @warehouseId, NULL, @adminUserId, SYSDATETIME(), 'Confirmed', N'Nhập trả tồn kho từ yêu cầu hoàn hàng')
            `)
          receiptId = Number(inserted.recordset[0].StockInReceiptId)
          receiptIds.set(warehouseId, receiptId)
        }

        const inventoryResult = await tx().input('warehouseId', sql.BigInt, warehouseId).input('skuId', sql.BigInt, item.SkuId).query(`
          SELECT InventoryId, QuantityOnHand, AverageUnitCost FROM dbo.Inventory WITH (UPDLOCK, HOLDLOCK)
          WHERE WarehouseId = @warehouseId AND SkuId = @skuId
        `)
        const inventory = inventoryResult.recordset[0]
        const oldQuantity = Number(inventory?.QuantityOnHand ?? 0)
        const oldAverage = Number(inventory?.AverageUnitCost ?? 0)
        const newAverage = oldQuantity + quantity > 0
          ? ((oldQuantity * oldAverage) + (quantity * unitCost)) / (oldQuantity + quantity)
          : unitCost
        if (inventory) {
          await tx().input('inventoryId', sql.BigInt, inventory.InventoryId).input('quantity', sql.Int, quantity)
            .input('averageUnitCost', sql.Decimal(18, 2), newAverage).query(`
              UPDATE dbo.Inventory SET QuantityOnHand = QuantityOnHand + @quantity,
                AverageUnitCost = @averageUnitCost, UpdatedAt = SYSDATETIME() WHERE InventoryId = @inventoryId
            `)
        } else {
          await tx().input('warehouseId', sql.BigInt, warehouseId).input('skuId', sql.BigInt, item.SkuId)
            .input('quantity', sql.Int, quantity).input('averageUnitCost', sql.Decimal(18, 2), unitCost).query(`
              INSERT INTO dbo.Inventory (WarehouseId, SkuId, QuantityOnHand, QuantityReserved, ReorderLevel, AverageUnitCost, UpdatedAt)
              VALUES (@warehouseId, @skuId, @quantity, 0, 3, @averageUnitCost, SYSDATETIME())
            `)
        }

        await tx().input('receiptId', sql.BigInt, receiptId).input('skuId', sql.BigInt, item.SkuId)
          .input('quantity', sql.Int, quantity).input('unitCost', sql.Decimal(18, 2), unitCost).query(`
            INSERT INTO dbo.StockInReceiptDetail (StockInReceiptId, SkuId, Quantity, UnitCost)
            VALUES (@receiptId, @skuId, @quantity, @unitCost)
          `)
        await tx().input('warehouseId', sql.BigInt, warehouseId).input('skuId', sql.BigInt, item.SkuId)
          .input('quantity', sql.Int, quantity).input('unitCost', sql.Decimal(18, 2), unitCost)
          .input('receiptId', sql.BigInt, receiptId).input('adminUserId', sql.BigInt, input.adminUserId).query(`
            INSERT INTO dbo.StockMovement (WarehouseId, SkuId, MovementType, QuantityChange, SourceType,
              StockInReceiptId, UnitCost, AdjustmentNote, CreatedByUserId, CreatedAt)
            VALUES (@warehouseId, @skuId, 'IN', @quantity, 'StockIn', @receiptId, @unitCost,
              N'Nhập lại hàng khách hoàn', @adminUserId, SYSDATETIME())
          `)
        await tx().input('orderDetailId', sql.BigInt, item.OrderDetailId)
          .input('returnedCost', sql.Decimal(18, 2), quantity * unitCost).query(`
            UPDATE dbo.SalesOrderDetail SET CostOfGoodsSold = CASE
              WHEN CostOfGoodsSold >= @returnedCost THEN CostOfGoodsSold - @returnedCost ELSE 0 END
            WHERE OrderDetailId = @orderDetailId
          `)
      }

      const refundedPaymentStatus = await tx().query(`SELECT PaymentStatusId FROM dbo.PaymentStatus WHERE StatusCode = 'Refunded'`)
      const refundedPaymentStatusId = Number(refundedPaymentStatus.recordset[0]?.PaymentStatusId)
      if (!refundedPaymentStatusId) throw new Error('Thiếu trạng thái thanh toán Đã hoàn tiền.')
      await tx().input('orderId', sql.BigInt, current.OrderId).input('paymentStatusId', sql.TinyInt, refundedPaymentStatusId).query(`
        UPDATE dbo.Payment SET PaymentStatusId = @paymentStatusId WHERE OrderId = @orderId;
        UPDATE dbo.SalesOrder SET PaymentStatusId = @paymentStatusId, UpdatedAt = SYSDATETIME() WHERE OrderId = @orderId;
      `)
      await tx().input('returnRequestId', sql.BigInt, input.returnRequestId).input('adminUserId', sql.BigInt, input.adminUserId)
        .input('refundAmount', sql.Decimal(18, 2), Number(current.RefundAmount ?? current.TotalAmount)).query(`
          UPDATE dbo.OrderReturnRequest SET Status = 'Approved', RefundStatus = 'Refunded', RefundAmount = @refundAmount,
            WarehouseConfirmedAt = COALESCE(WarehouseConfirmedAt, SYSDATETIME()),
            WarehouseConfirmedBy = COALESCE(WarehouseConfirmedBy, @adminUserId),
            InventoryRestockedAt = SYSDATETIME(), InventoryRestockedBy = @adminUserId,
            ProcessedAt = SYSDATETIME(), ProcessedBy = @adminUserId
          WHERE ReturnRequestId = @returnRequestId
        `)
    }

    await transaction.commit()
    return { returnRequestId: input.returnRequestId, workflowStatus: input.workflowStatus }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
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
        SELECT ReturnRequestId, OrderId, Status, RefundStatus, WarehouseConfirmedAt, InventoryRestockedAt
        FROM dbo.OrderReturnRequest WITH (UPDLOCK, ROWLOCK)
        WHERE ReturnRequestId = @returnRequestId
      `)
    const currentReq = returnReqResult.recordset[0]
    if (!currentReq) throw new Error('Không tìm thấy yêu cầu hoàn hàng.')

    if (currentReq.InventoryRestockedAt || currentReq.RefundStatus === 'Refunded') {
      throw new Error('Yêu cầu đã hoàn tất nên không thể thay đổi kết quả xử lý.')
    }
    if (input.refundStatus === 'Refunded') {
      throw new Error('Hãy dùng bước xác nhận đã nhận hàng và hoàn tiền để hệ thống đồng thời nhập trả tồn kho và cập nhật thanh toán.')
    }
    if (input.status === 'Rejected') {
      if (!input.adminNote?.trim()) throw new Error('Vui lòng nhập lý do từ chối yêu cầu hoàn hàng.')
      if (input.refundStatus && input.refundStatus !== 'Pending') {
        throw new Error('Yêu cầu bị từ chối không thể đồng thời bắt đầu hoặc hoàn tất hoàn tiền.')
      }
      const canRejectBeforeApproval = currentReq.Status === 'Pending' && currentReq.RefundStatus === 'Pending'
      const canCancelDuringReturn = currentReq.Status === 'Approved'
        && ['Pending', 'Processing'].includes(String(currentReq.RefundStatus))
        && !currentReq.WarehouseConfirmedAt
      if (!canRejectBeforeApproval && !canCancelDuringReturn) {
        throw new Error('Chỉ có thể hủy yêu cầu trước khi hàng hoàn được xác nhận nhận lại, nhập kho hoặc hoàn tiền.')
      }
    }

    await tx()
      .input('returnRequestId', sql.BigInt, input.returnRequestId)
      .input('status', sql.VarChar(20), input.status)
      .input('refundStatus', sql.VarChar(20), input.status === 'Rejected' ? 'Pending' : input.refundStatus || (input.status === 'Approved' ? 'Processing' : 'Pending'))
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
