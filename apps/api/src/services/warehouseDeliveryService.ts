import { getPool, sql } from '../config/database.js'

export type AssignShipmentInput = {
  orderId: number
  deliveryStaffId: number
  vehicleId: number
  estimatedDeliveryAt: string | null
  note: string | null
  assignedByUserId: number
}

export type CreateDeliveryVehicleInput = {
  vehicleCode: string
  licensePlate: string | null
  vehicleType: string
  note: string | null
}

export async function getWarehouseDeliveryOptions() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT DISTINCT
      userAccount.UserId AS userId,
      userAccount.FullName AS fullName,
      userAccount.Phone AS phone
    FROM dbo.UserAccount userAccount
    INNER JOIN dbo.UserRole userRole ON userRole.UserId = userAccount.UserId
    INNER JOIN dbo.Role role ON role.RoleId = userRole.RoleId
    INNER JOIN dbo.EmployeeProfile employeeProfile ON employeeProfile.UserId = userAccount.UserId
    WHERE role.RoleCode = 'DeliveryStaff'
      AND userAccount.Status = 'Active'
      AND employeeProfile.ApprovalStatus = 'Approved'
    ORDER BY userAccount.FullName;

    SELECT
      VehicleId AS vehicleId,
      VehicleCode AS vehicleCode,
      LicensePlate AS licensePlate,
      VehicleType AS vehicleType,
      Status AS status,
      Note AS note,
      CreatedAt AS createdAt,
      UpdatedAt AS updatedAt
    FROM dbo.DeliveryVehicle
    ORDER BY CASE WHEN Status = 'Active' THEN 0 ELSE 1 END, VehicleCode;
  `)

  const recordsets = result.recordsets as unknown as [
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
  ]

  return {
    deliveryStaff: recordsets[0],
    vehicles: recordsets[1],
  }
}

export async function createDeliveryVehicle(input: CreateDeliveryVehicleInput) {
  const pool = await getPool()
  const result = await pool.request()
    .input('vehicleCode', sql.VarChar(50), input.vehicleCode)
    .input('licensePlate', sql.VarChar(30), input.licensePlate)
    .input('vehicleType', sql.NVarChar(50), input.vehicleType)
    .input('note', sql.NVarChar(500), input.note)
    .query(`
      INSERT INTO dbo.DeliveryVehicle (
        VehicleCode, LicensePlate, VehicleType, Status, Note, CreatedAt
      )
      OUTPUT INSERTED.VehicleId AS vehicleId
      VALUES (@vehicleCode, @licensePlate, @vehicleType, 'Active', @note, SYSDATETIME())
    `)

  return result.recordset[0]
}

export async function updateDeliveryVehicleStatus(vehicleId: number, status: string) {
  const pool = await getPool()
  const result = await pool.request()
    .input('vehicleId', sql.BigInt, vehicleId)
    .input('status', sql.VarChar(20), status)
    .query(`
      UPDATE dbo.DeliveryVehicle
      SET Status = @status, UpdatedAt = SYSDATETIME()
      WHERE VehicleId = @vehicleId
    `)

  if (result.rowsAffected[0] !== 1) throw new Error('Không tìm thấy phương tiện giao hàng.')
  return { vehicleId, status }
}

export async function assignOrderShipment(input: AssignShipmentInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const orderResult = await tx()
      .input('orderId', sql.BigInt, input.orderId)
      .query(`
        SELECT so.OrderId, so.OrderCode, so.ShippingFee, os.StatusCode
        FROM dbo.SalesOrder so WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
        WHERE so.OrderId = @orderId
      `)
    const order = orderResult.recordset[0]
    if (!order) throw new Error('Không tìm thấy đơn hàng.')
    if (order.StatusCode !== 'ReadyToShip') throw new Error('Chỉ có thể phân công đơn đang sẵn sàng giao/xuất kho.')

    const warehouseResult = await tx()
      .input('orderId', sql.BigInt, input.orderId)
      .query(`
        SELECT DISTINCT inventory.WarehouseId
        FROM dbo.SalesOrderDetail detail
        INNER JOIN dbo.OrderInventoryReservation reservation ON reservation.OrderDetailId = detail.OrderDetailId
        INNER JOIN dbo.Inventory inventory ON inventory.InventoryId = reservation.InventoryId
        WHERE detail.OrderId = @orderId
          AND reservation.QuantityReserved > reservation.QuantityFulfilled
      `)
    if (warehouseResult.recordset.length !== 1) {
      throw new Error('Luồng giao nội bộ hiện yêu cầu toàn bộ đơn được lấy từ đúng một kho.')
    }
    const warehouseId = Number(warehouseResult.recordset[0].WarehouseId)

    const staffResult = await tx()
      .input('deliveryStaffId', sql.BigInt, input.deliveryStaffId)
      .query(`
        SELECT TOP (1) userAccount.UserId, userAccount.FullName
        FROM dbo.UserAccount userAccount
        INNER JOIN dbo.UserRole userRole ON userRole.UserId = userAccount.UserId
        INNER JOIN dbo.Role role ON role.RoleId = userRole.RoleId
        INNER JOIN dbo.EmployeeProfile employeeProfile ON employeeProfile.UserId = userAccount.UserId
        WHERE userAccount.UserId = @deliveryStaffId
          AND userAccount.Status = 'Active'
          AND role.RoleCode = 'DeliveryStaff'
          AND employeeProfile.ApprovalStatus = 'Approved'
      `)
    const deliveryStaff = staffResult.recordset[0]
    if (!deliveryStaff) throw new Error('Shipper phải có role DeliveryStaff, tài khoản Active và hồ sơ đã được duyệt.')

    const vehicleResult = await tx()
      .input('vehicleId', sql.BigInt, input.vehicleId)
      .query(`
        SELECT VehicleId, VehicleCode, LicensePlate
        FROM dbo.DeliveryVehicle
        WHERE VehicleId = @vehicleId AND Status = 'Active'
      `)
    const vehicle = vehicleResult.recordset[0]
    if (!vehicle) throw new Error('Phương tiện không tồn tại hoặc hiện không hoạt động.')

    const existingResult = await tx()
      .input('orderId', sql.BigInt, input.orderId)
      .input('warehouseId', sql.BigInt, warehouseId)
      .query(`
        SELECT ShipmentId, ShippingStatus
        FROM dbo.Shipment WITH (UPDLOCK, HOLDLOCK)
        WHERE OrderId = @orderId AND WarehouseId = @warehouseId
      `)
    const existing = existingResult.recordset[0]
    if (existing && !['Pending', 'Picking'].includes(String(existing.ShippingStatus))) {
      throw new Error('Chuyến giao này đã bàn giao hoặc không còn được phép phân công lại.')
    }

    let shipmentId: number
    if (existing) {
      shipmentId = Number(existing.ShipmentId)
      await tx()
        .input('shipmentId', sql.BigInt, shipmentId)
        .input('deliveryStaffId', sql.BigInt, input.deliveryStaffId)
        .input('vehicleId', sql.BigInt, input.vehicleId)
        .input('estimatedDeliveryAt', sql.DateTime2, input.estimatedDeliveryAt ? new Date(input.estimatedDeliveryAt) : null)
        .input('note', sql.NVarChar(500), input.note)
        .query(`
          UPDATE dbo.Shipment
          SET DeliveryStaffId = @deliveryStaffId,
              VehicleId = @vehicleId,
              ShippingStatus = 'Picking',
              EstimatedDeliveryAt = @estimatedDeliveryAt,
              AssignedAt = SYSDATETIME(),
              Note = @note,
              UpdatedAt = SYSDATETIME()
          WHERE ShipmentId = @shipmentId
        `)
    } else {
      const trackingCode = `SHP-${input.orderId}-${Date.now().toString().slice(-8)}`
      const inserted = await tx()
        .input('orderId', sql.BigInt, input.orderId)
        .input('warehouseId', sql.BigInt, warehouseId)
        .input('deliveryStaffId', sql.BigInt, input.deliveryStaffId)
        .input('vehicleId', sql.BigInt, input.vehicleId)
        .input('trackingCode', sql.VarChar(50), trackingCode)
        .input('shippingFee', sql.Decimal(18, 2), Number(order.ShippingFee))
        .input('estimatedDeliveryAt', sql.DateTime2, input.estimatedDeliveryAt ? new Date(input.estimatedDeliveryAt) : null)
        .input('note', sql.NVarChar(500), input.note)
        .query(`
          INSERT INTO dbo.Shipment (
            OrderId, WarehouseId, DeliveryStaffId, VehicleId, TrackingCode,
            ShippingStatus, ShippingFee, EstimatedDeliveryAt, AssignedAt,
            Note, CreatedAt, UpdatedAt
          )
          OUTPUT INSERTED.ShipmentId
          VALUES (
            @orderId, @warehouseId, @deliveryStaffId, @vehicleId, @trackingCode,
            'Picking', @shippingFee, @estimatedDeliveryAt, SYSDATETIME(),
            @note, SYSDATETIME(), SYSDATETIME()
          )
        `)
      shipmentId = Number(inserted.recordset[0].ShipmentId)
    }

    await tx()
      .input('shipmentId', sql.BigInt, shipmentId)
      .input('changedByUserId', sql.BigInt, input.assignedByUserId)
      .input(
        'note',
        sql.NVarChar(500),
        `Phân công ${deliveryStaff.FullName}; xe ${vehicle.VehicleCode}${vehicle.LicensePlate ? ` (${vehicle.LicensePlate})` : ''}.`,
      )
      .query(`
        INSERT INTO dbo.ShipmentStatusHistory (ShipmentId, Status, ChangedByUserId, Note, ChangedAt)
        VALUES (@shipmentId, 'Picking', @changedByUserId, @note, SYSDATETIME())
      `)

    await transaction.commit()
    return { shipmentId, orderId: input.orderId, orderCode: order.OrderCode, warehouseId }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function getReturnPendingShipments() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      shipment.ShipmentId AS shipmentId,
      shipment.TrackingCode AS trackingCode,
      shipment.UpdatedAt AS requestedAt,
      shipment.Note AS returnReason,
      salesOrder.OrderId AS orderId,
      salesOrder.OrderCode AS orderCode,
      salesOrder.ReceiverName AS receiverName,
      deliveryStaff.FullName AS deliveryStaffName,
      vehicle.VehicleCode AS vehicleCode,
      vehicle.LicensePlate AS licensePlate,
      warehouse.WarehouseName AS warehouseName,
      detail.OrderDetailId AS orderDetailId,
      detail.ProductNameSnapshot AS productName,
      detail.SkuCodeSnapshot AS skuCode,
      shipmentItem.Quantity AS quantity
    FROM dbo.Shipment shipment
    INNER JOIN dbo.SalesOrder salesOrder ON salesOrder.OrderId = shipment.OrderId
    INNER JOIN dbo.Warehouse warehouse ON warehouse.WarehouseId = shipment.WarehouseId
    LEFT JOIN dbo.UserAccount deliveryStaff ON deliveryStaff.UserId = shipment.DeliveryStaffId
    LEFT JOIN dbo.DeliveryVehicle vehicle ON vehicle.VehicleId = shipment.VehicleId
    INNER JOIN dbo.ShipmentItem shipmentItem ON shipmentItem.ShipmentId = shipment.ShipmentId
    INNER JOIN dbo.SalesOrderDetail detail ON detail.OrderDetailId = shipmentItem.OrderDetailId
    WHERE shipment.ShippingStatus = 'ReturnPending'
    ORDER BY shipment.UpdatedAt, shipment.ShipmentId, detail.OrderDetailId
  `)

  const shipments = new Map<number, Record<string, unknown> & { items: unknown[] }>()
  for (const row of result.recordset) {
    const shipmentId = Number(row.shipmentId)
    if (!shipments.has(shipmentId)) {
      shipments.set(shipmentId, {
        shipmentId,
        trackingCode: row.trackingCode,
        requestedAt: row.requestedAt,
        returnReason: row.returnReason,
        orderId: row.orderId,
        orderCode: row.orderCode,
        receiverName: row.receiverName,
        deliveryStaffName: row.deliveryStaffName,
        vehicleCode: row.vehicleCode,
        licensePlate: row.licensePlate,
        warehouseName: row.warehouseName,
        items: [],
      })
    }
    shipments.get(shipmentId)!.items.push({
      orderDetailId: row.orderDetailId,
      productName: row.productName,
      skuCode: row.skuCode,
      quantity: row.quantity,
    })
  }
  return [...shipments.values()]
}

export async function confirmShipmentReturn(shipmentId: number, warehouseUserId: number) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const shipmentResult = await tx()
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        SELECT
          shipment.ShipmentId, shipment.OrderId, shipment.WarehouseId, shipment.ShippingStatus,
          salesOrder.OrderCode, salesOrder.OrderStatusId, salesOrder.PaymentStatusId,
          orderStatus.StatusCode AS OrderStatusCode,
          paymentStatus.StatusCode AS PaymentStatusCode
        FROM dbo.Shipment shipment WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.SalesOrder salesOrder WITH (UPDLOCK, ROWLOCK) ON salesOrder.OrderId = shipment.OrderId
        INNER JOIN dbo.OrderStatus orderStatus ON orderStatus.OrderStatusId = salesOrder.OrderStatusId
        INNER JOIN dbo.PaymentStatus paymentStatus ON paymentStatus.PaymentStatusId = salesOrder.PaymentStatusId
        WHERE shipment.ShipmentId = @shipmentId
      `)
    const shipment = shipmentResult.recordset[0]
    if (!shipment) throw new Error('Không tìm thấy chuyến giao hàng.')
    if (shipment.ShippingStatus !== 'ReturnPending') throw new Error('Chuyến giao chưa ở trạng thái chờ trả về kho.')
    if (shipment.OrderStatusCode !== 'Shipping') throw new Error('Đơn hàng không còn ở trạng thái đang giao.')

    const existingReturn = await tx()
      .input('shipmentId', sql.BigInt, shipmentId)
      .query('SELECT StockInReceiptId FROM dbo.StockInReceipt WITH (UPDLOCK, HOLDLOCK) WHERE ShipmentId = @shipmentId')
    if (existingReturn.recordset.length) throw new Error('Chuyến giao này đã được kho nhận lại.')

    const items = await tx()
      .input('shipmentId', sql.BigInt, shipmentId)
      .input('warehouseId', sql.BigInt, shipment.WarehouseId)
      .query(`
        SELECT
          shipmentItem.OrderDetailId,
          detail.SkuId,
          shipmentItem.Quantity,
          receiptDetail.UnitCost
        FROM dbo.ShipmentItem shipmentItem
        INNER JOIN dbo.SalesOrderDetail detail ON detail.OrderDetailId = shipmentItem.OrderDetailId
        INNER JOIN dbo.StockOutReceipt receipt
          ON receipt.OrderId = detail.OrderId
          AND receipt.WarehouseId = @warehouseId
          AND receipt.Reason = 'Order'
          AND receipt.Status = 'Confirmed'
        INNER JOIN dbo.StockOutReceiptDetail receiptDetail
          ON receiptDetail.StockOutReceiptId = receipt.StockOutReceiptId
          AND receiptDetail.OrderDetailId = shipmentItem.OrderDetailId
        WHERE shipmentItem.ShipmentId = @shipmentId
      `)
    if (!items.recordset.length) throw new Error('Không tìm thấy chi tiết giá vốn của hàng đã xuất.')

    const receiptCode = `RET-${shipment.OrderId}-${shipmentId}`
    const receiptResult = await tx()
      .input('receiptCode', sql.VarChar(50), receiptCode)
      .input('warehouseId', sql.BigInt, shipment.WarehouseId)
      .input('shipmentId', sql.BigInt, shipmentId)
      .input('userId', sql.BigInt, warehouseUserId)
      .query(`
        INSERT INTO dbo.StockInReceipt (
          ReceiptCode, WarehouseId, SupplierId, CreatedByUserId,
          ReceiptDate, Status, Note, ShipmentId
        )
        OUTPUT INSERTED.StockInReceiptId
        VALUES (
          @receiptCode, @warehouseId, NULL, @userId,
          SYSDATETIME(), 'Confirmed', N'Kho nhận lại hàng giao không thành công', @shipmentId
        )
      `)
    const receiptId = Number(receiptResult.recordset[0].StockInReceiptId)

    for (const item of items.recordset) {
      const quantity = Number(item.Quantity)
      const unitCost = Number(item.UnitCost)
      const inventoryResult = await tx()
        .input('warehouseId', sql.BigInt, shipment.WarehouseId)
        .input('skuId', sql.BigInt, item.SkuId)
        .query(`
          SELECT InventoryId, QuantityOnHand, AverageUnitCost
          FROM dbo.Inventory WITH (UPDLOCK, HOLDLOCK)
          WHERE WarehouseId = @warehouseId AND SkuId = @skuId
        `)
      const inventory = inventoryResult.recordset[0]
      const oldQuantity = Number(inventory?.QuantityOnHand ?? 0)
      const oldAverage = Number(inventory?.AverageUnitCost ?? 0)
      const newAverage = ((oldQuantity * oldAverage) + (quantity * unitCost)) / (oldQuantity + quantity)

      if (inventory) {
        await tx()
          .input('inventoryId', sql.BigInt, inventory.InventoryId)
          .input('quantity', sql.Int, quantity)
          .input('averageUnitCost', sql.Decimal(18, 2), newAverage)
          .query(`
            UPDATE dbo.Inventory
            SET QuantityOnHand = QuantityOnHand + @quantity,
                AverageUnitCost = @averageUnitCost,
                UpdatedAt = SYSDATETIME()
            WHERE InventoryId = @inventoryId
          `)
      } else {
        await tx()
          .input('warehouseId', sql.BigInt, shipment.WarehouseId)
          .input('skuId', sql.BigInt, item.SkuId)
          .input('quantity', sql.Int, quantity)
          .input('averageUnitCost', sql.Decimal(18, 2), newAverage)
          .query(`
            INSERT INTO dbo.Inventory (
              WarehouseId, SkuId, QuantityOnHand, QuantityReserved,
              ReorderLevel, AverageUnitCost, UpdatedAt
            )
            VALUES (@warehouseId, @skuId, @quantity, 0, 3, @averageUnitCost, SYSDATETIME())
          `)
      }

      await tx()
        .input('receiptId', sql.BigInt, receiptId)
        .input('skuId', sql.BigInt, item.SkuId)
        .input('quantity', sql.Int, quantity)
        .input('unitCost', sql.Decimal(18, 2), unitCost)
        .query(`
          INSERT INTO dbo.StockInReceiptDetail (StockInReceiptId, SkuId, Quantity, UnitCost)
          VALUES (@receiptId, @skuId, @quantity, @unitCost)
        `)

      await tx()
        .input('warehouseId', sql.BigInt, shipment.WarehouseId)
        .input('skuId', sql.BigInt, item.SkuId)
        .input('quantity', sql.Int, quantity)
        .input('unitCost', sql.Decimal(18, 2), unitCost)
        .input('receiptId', sql.BigInt, receiptId)
        .input('userId', sql.BigInt, warehouseUserId)
        .query(`
          INSERT INTO dbo.StockMovement (
            WarehouseId, SkuId, MovementType, QuantityChange, SourceType,
            StockInReceiptId, UnitCost, AdjustmentNote, CreatedByUserId, CreatedAt
          )
          VALUES (
            @warehouseId, @skuId, 'IN', @quantity, 'StockIn',
            @receiptId, @unitCost, N'Nhận lại hàng giao thất bại', @userId, SYSDATETIME()
          )
        `)

      await tx()
        .input('orderDetailId', sql.BigInt, item.OrderDetailId)
        .input('returnedCost', sql.Decimal(18, 2), quantity * unitCost)
        .query(`
          UPDATE dbo.SalesOrderDetail
          SET CostOfGoodsSold = CASE
            WHEN CostOfGoodsSold >= @returnedCost THEN CostOfGoodsSold - @returnedCost
            ELSE 0
          END
          WHERE OrderDetailId = @orderDetailId
        `)
    }

    let nextPaymentStatusId: number | null = null
    if (shipment.PaymentStatusCode === 'Success') {
      const refundResult = await tx().query(`
        SELECT PaymentStatusId FROM dbo.PaymentStatus WHERE StatusCode = 'RefundPending'
      `)
      nextPaymentStatusId = Number(refundResult.recordset[0]?.PaymentStatusId)
      if (!nextPaymentStatusId) throw new Error('Thiếu trạng thái thanh toán chờ hoàn tiền.')

      await tx()
        .input('orderId', sql.BigInt, shipment.OrderId)
        .input('paymentStatusId', sql.TinyInt, nextPaymentStatusId)
        .query('UPDATE dbo.Payment SET PaymentStatusId = @paymentStatusId WHERE OrderId = @orderId')
    }

    const cancelledStatus = await tx().query(`SELECT OrderStatusId FROM dbo.OrderStatus WHERE StatusCode = 'Cancelled'`)
    const cancelledStatusId = Number(cancelledStatus.recordset[0]?.OrderStatusId)
    if (!cancelledStatusId) throw new Error('Thiếu trạng thái đơn hàng đã hủy.')

    await tx()
      .input('shipmentId', sql.BigInt, shipmentId)
      .query(`
        UPDATE dbo.Shipment
        SET ShippingStatus = 'Cancelled', UpdatedAt = SYSDATETIME(),
            Note = N'Kho đã nhận lại hàng giao không thành công.'
        WHERE ShipmentId = @shipmentId
      `)
    await tx()
      .input('shipmentId', sql.BigInt, shipmentId)
      .input('userId', sql.BigInt, warehouseUserId)
      .query(`
        INSERT INTO dbo.ShipmentStatusHistory (ShipmentId, Status, ChangedByUserId, Note, ChangedAt)
        VALUES (@shipmentId, 'Cancelled', @userId, N'Kho xác nhận đã nhận lại hàng.', SYSDATETIME())
      `)
    await tx()
      .input('orderId', sql.BigInt, shipment.OrderId)
      .input('orderStatusId', sql.TinyInt, cancelledStatusId)
      .input('paymentStatusId', sql.TinyInt, nextPaymentStatusId)
      .query(`
        UPDATE dbo.SalesOrder
        SET OrderStatusId = @orderStatusId,
            PaymentStatusId = COALESCE(@paymentStatusId, PaymentStatusId),
            CancelledAt = SYSDATETIME(), UpdatedAt = SYSDATETIME()
        WHERE OrderId = @orderId
      `)
    await tx()
      .input('orderId', sql.BigInt, shipment.OrderId)
      .input('fromStatusId', sql.TinyInt, shipment.OrderStatusId)
      .input('toStatusId', sql.TinyInt, cancelledStatusId)
      .input('userId', sql.BigInt, warehouseUserId)
      .query(`
        INSERT INTO dbo.OrderStatusHistory (
          OrderId, FromStatusId, ToStatusId, ChangedByUserId, Note, ChangedAt
        )
        VALUES (
          @orderId, @fromStatusId, @toStatusId, @userId,
          N'Kho nhận lại hàng giao thất bại và hủy đơn.', SYSDATETIME()
        )
      `)

    await transaction.commit()
    return { shipmentId, orderId: Number(shipment.OrderId), orderCode: shipment.OrderCode, receiptCode }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}
