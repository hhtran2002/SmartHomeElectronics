import { getPool, sql } from '../config/database.js'

function canAccessShipment(deliveryStaffId: unknown, userId: number, isSystemAdmin: boolean) {
  return isSystemAdmin || Number(deliveryStaffId) === userId
}

export async function getShipperShipments(userId: number, isSystemAdmin: boolean) {
  const pool = await getPool()
  const request = pool.request().input('userId', sql.BigInt, userId).input('isSystemAdmin', sql.Bit, isSystemAdmin)
  const result = await request.query(`
    SELECT
      shipment.ShipmentId AS shipmentId,
      shipment.TrackingCode AS trackingCode,
      shipment.ShippingStatus AS shippingStatus,
      shipment.EstimatedDeliveryAt AS estimatedDeliveryAt,
      shipment.AssignedAt AS assignedAt,
      shipment.HandedOverAt AS handedOverAt,
      shipment.DeliveredAt AS deliveredAt,
      shipment.Note AS note,
      shipment.DeliveryStaffId AS deliveryStaffId,
      deliveryStaff.FullName AS deliveryStaffName,
      vehicle.VehicleId AS vehicleId,
      vehicle.VehicleCode AS vehicleCode,
      vehicle.LicensePlate AS licensePlate,
      vehicle.VehicleType AS vehicleType,
      warehouse.WarehouseName AS warehouseName,
      warehouse.Address AS warehouseAddress,
      salesOrder.OrderId AS orderId,
      salesOrder.OrderCode AS orderCode,
      salesOrder.ReceiverName AS receiverName,
      salesOrder.ReceiverPhone AS receiverPhone,
      salesOrder.ShippingAddressSnapshot AS shippingAddress,
      salesOrder.TotalAmount AS totalAmount,
      orderStatus.StatusCode AS orderStatusCode,
      payment.MethodCode AS paymentMethodCode,
      payment.MethodName AS paymentMethodName,
      payment.PaymentStatusCode AS paymentStatusCode,
      CASE
        WHEN payment.MethodCode = 'COD' AND payment.PaymentStatusCode <> 'Success' THEN payment.Amount
        ELSE 0
      END AS codAmount,
      detail.OrderDetailId AS orderDetailId,
      detail.ProductNameSnapshot AS productName,
      detail.SkuCodeSnapshot AS skuCode,
      shipmentItem.Quantity AS quantity
    FROM dbo.Shipment shipment
    INNER JOIN dbo.SalesOrder salesOrder ON salesOrder.OrderId = shipment.OrderId
    INNER JOIN dbo.OrderStatus orderStatus ON orderStatus.OrderStatusId = salesOrder.OrderStatusId
    INNER JOIN dbo.Warehouse warehouse ON warehouse.WarehouseId = shipment.WarehouseId
    LEFT JOIN dbo.UserAccount deliveryStaff ON deliveryStaff.UserId = shipment.DeliveryStaffId
    LEFT JOIN dbo.DeliveryVehicle vehicle ON vehicle.VehicleId = shipment.VehicleId
    OUTER APPLY (
      SELECT TOP (1)
        paymentRecord.Amount,
        paymentMethod.MethodCode,
        paymentMethod.MethodName,
        paymentStatus.StatusCode AS PaymentStatusCode
      FROM dbo.Payment paymentRecord
      INNER JOIN dbo.PaymentMethod paymentMethod ON paymentMethod.PaymentMethodId = paymentRecord.PaymentMethodId
      INNER JOIN dbo.PaymentStatus paymentStatus ON paymentStatus.PaymentStatusId = paymentRecord.PaymentStatusId
      WHERE paymentRecord.OrderId = salesOrder.OrderId
      ORDER BY paymentRecord.PaymentId DESC
    ) payment
    LEFT JOIN dbo.ShipmentItem shipmentItem ON shipmentItem.ShipmentId = shipment.ShipmentId
    LEFT JOIN dbo.SalesOrderDetail detail ON detail.OrderDetailId = shipmentItem.OrderDetailId
    WHERE (@isSystemAdmin = 1 OR shipment.DeliveryStaffId = @userId)
    ORDER BY
      CASE shipment.ShippingStatus
        WHEN 'Picking' THEN 1 WHEN 'Shipping' THEN 2 WHEN 'Failed' THEN 3
        WHEN 'Rescheduled' THEN 4 WHEN 'ReturnPending' THEN 5 ELSE 6
      END,
      shipment.UpdatedAt DESC,
      shipment.ShipmentId DESC,
      detail.OrderDetailId
  `)

  const shipments = new Map<number, Record<string, unknown> & { items: unknown[] }>()
  for (const row of result.recordset) {
    const shipmentId = Number(row.shipmentId)
    if (!shipments.has(shipmentId)) {
      shipments.set(shipmentId, {
        shipmentId,
        trackingCode: row.trackingCode,
        shippingStatus: row.shippingStatus,
        estimatedDeliveryAt: row.estimatedDeliveryAt,
        assignedAt: row.assignedAt,
        handedOverAt: row.handedOverAt,
        deliveredAt: row.deliveredAt,
        note: row.note,
        deliveryStaffId: row.deliveryStaffId,
        deliveryStaffName: row.deliveryStaffName,
        vehicleId: row.vehicleId,
        vehicleCode: row.vehicleCode,
        licensePlate: row.licensePlate,
        vehicleType: row.vehicleType,
        warehouseName: row.warehouseName,
        warehouseAddress: row.warehouseAddress,
        orderId: row.orderId,
        orderCode: row.orderCode,
        receiverName: row.receiverName,
        receiverPhone: row.receiverPhone,
        shippingAddress: row.shippingAddress,
        totalAmount: row.totalAmount,
        orderStatusCode: row.orderStatusCode,
        paymentMethodCode: row.paymentMethodCode,
        paymentMethodName: row.paymentMethodName,
        paymentStatusCode: row.paymentStatusCode,
        codAmount: row.codAmount,
        items: [],
      })
    }
    if (row.orderDetailId) {
      shipments.get(shipmentId)!.items.push({
        orderDetailId: row.orderDetailId,
        productName: row.productName,
        skuCode: row.skuCode,
        quantity: row.quantity,
      })
    }
  }
  return [...shipments.values()]
}

export async function completeShipmentDelivery(
  shipmentId: number,
  userId: number,
  isSystemAdmin: boolean,
) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)
    const currentResult = await tx()
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        SELECT TOP (1)
          shipment.ShipmentId, shipment.OrderId, shipment.DeliveryStaffId, shipment.ShippingStatus,
          salesOrder.OrderCode, salesOrder.OrderStatusId, orderStatus.StatusCode AS OrderStatusCode,
          payment.PaymentId, payment.PaymentStatusId, paymentStatus.StatusCode AS PaymentStatusCode,
          paymentMethod.MethodCode AS PaymentMethodCode
        FROM dbo.Shipment shipment WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.SalesOrder salesOrder WITH (UPDLOCK, ROWLOCK) ON salesOrder.OrderId = shipment.OrderId
        INNER JOIN dbo.OrderStatus orderStatus ON orderStatus.OrderStatusId = salesOrder.OrderStatusId
        LEFT JOIN dbo.Payment payment ON payment.OrderId = salesOrder.OrderId
        LEFT JOIN dbo.PaymentStatus paymentStatus ON paymentStatus.PaymentStatusId = payment.PaymentStatusId
        LEFT JOIN dbo.PaymentMethod paymentMethod ON paymentMethod.PaymentMethodId = payment.PaymentMethodId
        WHERE shipment.ShipmentId = @shipmentId
        ORDER BY payment.PaymentId DESC
      `)
    const current = currentResult.recordset[0]
    if (!current) throw new Error('Không tìm thấy chuyến giao hàng.')
    if (!canAccessShipment(current.DeliveryStaffId, userId, isSystemAdmin)) throw new Error('Chuyến giao này không được phân công cho bạn.')
    if (current.ShippingStatus !== 'Shipping' || current.OrderStatusCode !== 'Shipping') {
      throw new Error('Chỉ chuyến đang giao mới được xác nhận thành công.')
    }
    if (current.PaymentMethodCode !== 'COD' && current.PaymentStatusCode !== 'Success') {
      throw new Error('Đơn thanh toán online chưa được thanh toán thành công.')
    }

    let successPaymentStatusId: number | null = null
    if (current.PaymentMethodCode === 'COD') {
      const successResult = await tx().query(`SELECT PaymentStatusId FROM dbo.PaymentStatus WHERE StatusCode = 'Success'`)
      successPaymentStatusId = Number(successResult.recordset[0]?.PaymentStatusId)
      if (!successPaymentStatusId) throw new Error('Thiếu trạng thái thanh toán thành công.')
      await tx()
        .input('paymentId', sql.BigInt, current.PaymentId)
        .input('paymentStatusId', sql.TinyInt, successPaymentStatusId)
        .input('transactionCode', sql.VarChar(255), `COD-${current.OrderCode}`)
        .query(`
          UPDATE dbo.Payment
          SET PaymentStatusId = @paymentStatusId,
              TransactionCode = COALESCE(TransactionCode, @transactionCode),
              PaidAt = COALESCE(PaidAt, SYSDATETIME())
          WHERE PaymentId = @paymentId
        `)
    }

    await tx()
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        UPDATE dbo.Shipment
        SET ShippingStatus = 'Delivered', DeliveredAt = SYSDATETIME(), UpdatedAt = SYSDATETIME()
        WHERE ShipmentId = @shipmentId
      `)
    await tx()
      .input('shipmentId', sql.BigInt, shipmentId)
      .input('userId', sql.BigInt, userId)
      .query(`
        INSERT INTO dbo.ShipmentStatusHistory (ShipmentId, Status, ChangedByUserId, Note, ChangedAt)
        VALUES (@shipmentId, 'Delivered', @userId, N'Shipper xác nhận giao hàng thành công.', SYSDATETIME())
      `)

    const remaining = await tx()
      .input('orderId', sql.BigInt, current.OrderId)
      .query(`
        SELECT COUNT(*) AS RemainingCount
        FROM dbo.Shipment
        WHERE OrderId = @orderId AND ShippingStatus <> 'Delivered'
      `)
    if (Number(remaining.recordset[0].RemainingCount) === 0) {
      const completedResult = await tx().query(`SELECT OrderStatusId FROM dbo.OrderStatus WHERE StatusCode = 'Completed'`)
      const completedStatusId = Number(completedResult.recordset[0]?.OrderStatusId)
      if (!completedStatusId) throw new Error('Thiếu trạng thái đơn hàng hoàn thành.')
      await tx()
        .input('orderId', sql.BigInt, current.OrderId)
        .input('orderStatusId', sql.TinyInt, completedStatusId)
        .input('paymentStatusId', sql.TinyInt, successPaymentStatusId)
        .query(`
          UPDATE dbo.SalesOrder
          SET OrderStatusId = @orderStatusId,
              PaymentStatusId = COALESCE(@paymentStatusId, PaymentStatusId),
              UpdatedAt = SYSDATETIME()
          WHERE OrderId = @orderId
        `)
      await tx()
        .input('orderId', sql.BigInt, current.OrderId)
        .input('fromStatusId', sql.TinyInt, current.OrderStatusId)
        .input('toStatusId', sql.TinyInt, completedStatusId)
        .input('userId', sql.BigInt, userId)
        .query(`
          INSERT INTO dbo.OrderStatusHistory (
            OrderId, FromStatusId, ToStatusId, ChangedByUserId, Note, ChangedAt
          )
          VALUES (
            @orderId, @fromStatusId, @toStatusId, @userId,
            N'Shipper xác nhận giao hàng thành công.', SYSDATETIME()
          )
        `)
    }

    await transaction.commit()
    return { shipmentId, orderId: Number(current.OrderId), orderCode: current.OrderCode, paymentCollected: current.PaymentMethodCode === 'COD' }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

async function updateShipmentWorkflowStatus(input: {
  shipmentId: number
  userId: number
  isSystemAdmin: boolean
  allowedCurrentStatuses: string[]
  targetStatus: 'Failed' | 'Rescheduled' | 'Shipping' | 'ReturnPending'
  note: string
  estimatedDeliveryAt?: string | null
}) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)
    const currentResult = await tx()
      .input('shipmentId', sql.BigInt, input.shipmentId)
      .query(`
        SELECT ShipmentId, DeliveryStaffId, ShippingStatus
        FROM dbo.Shipment WITH (UPDLOCK, ROWLOCK)
        WHERE ShipmentId = @shipmentId
      `)
    const current = currentResult.recordset[0]
    if (!current) throw new Error('Không tìm thấy chuyến giao hàng.')
    if (!canAccessShipment(current.DeliveryStaffId, input.userId, input.isSystemAdmin)) throw new Error('Chuyến giao này không được phân công cho bạn.')
    if (!input.allowedCurrentStatuses.includes(String(current.ShippingStatus))) {
      throw new Error(`Không thể chuyển chuyến từ ${current.ShippingStatus} sang ${input.targetStatus}.`)
    }

    await tx()
      .input('shipmentId', sql.BigInt, input.shipmentId)
      .input('status', sql.VarChar(30), input.targetStatus)
      .input('note', sql.NVarChar(500), input.note)
      .input('estimatedDeliveryAt', sql.DateTime2, input.estimatedDeliveryAt ? new Date(input.estimatedDeliveryAt) : null)
      .query(`
        UPDATE dbo.Shipment
        SET ShippingStatus = @status,
            Note = @note,
            EstimatedDeliveryAt = COALESCE(@estimatedDeliveryAt, EstimatedDeliveryAt),
            UpdatedAt = SYSDATETIME()
        WHERE ShipmentId = @shipmentId
      `)
    await tx()
      .input('shipmentId', sql.BigInt, input.shipmentId)
      .input('status', sql.VarChar(30), input.targetStatus)
      .input('userId', sql.BigInt, input.userId)
      .input('note', sql.NVarChar(500), input.note)
      .query(`
        INSERT INTO dbo.ShipmentStatusHistory (ShipmentId, Status, ChangedByUserId, Note, ChangedAt)
        VALUES (@shipmentId, @status, @userId, @note, SYSDATETIME())
      `)
    await transaction.commit()
    return { shipmentId: input.shipmentId, shippingStatus: input.targetStatus }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export function failShipmentDelivery(shipmentId: number, userId: number, isSystemAdmin: boolean, reason: string) {
  return updateShipmentWorkflowStatus({
    shipmentId, userId, isSystemAdmin,
    allowedCurrentStatuses: ['Shipping'],
    targetStatus: 'Failed',
    note: `Giao không thành công: ${reason}`,
  })
}

export function rescheduleShipmentDelivery(
  shipmentId: number,
  userId: number,
  isSystemAdmin: boolean,
  estimatedDeliveryAt: string,
  note: string,
) {
  return updateShipmentWorkflowStatus({
    shipmentId, userId, isSystemAdmin,
    allowedCurrentStatuses: ['Failed'],
    targetStatus: 'Rescheduled',
    note: `Hẹn giao lại: ${note}`,
    estimatedDeliveryAt,
  })
}

export function retryShipmentDelivery(shipmentId: number, userId: number, isSystemAdmin: boolean) {
  return updateShipmentWorkflowStatus({
    shipmentId, userId, isSystemAdmin,
    allowedCurrentStatuses: ['Failed', 'Rescheduled'],
    targetStatus: 'Shipping',
    note: 'Shipper bắt đầu giao lại.',
  })
}

export function requestShipmentReturn(shipmentId: number, userId: number, isSystemAdmin: boolean, reason: string) {
  return updateShipmentWorkflowStatus({
    shipmentId, userId, isSystemAdmin,
    allowedCurrentStatuses: ['Failed', 'Rescheduled'],
    targetStatus: 'ReturnPending',
    note: `Đề nghị trả hàng về kho: ${reason}`,
  })
}
