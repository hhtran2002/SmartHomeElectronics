import { getPool, sql } from '../config/database.js'

type StockInInput = {
  warehouseId: number
  skuId: number
  quantity: number
  unitCost: number
  note: string | null
  userId: number
}

type StockOutInput = {
  warehouseId: number
  skuId: number
  quantity: number
  reason: string
  note: string | null
  userId: number
}

function makeReceiptCode(prefix: 'IN' | 'OUT') {
  return `${prefix}${Date.now()}`
}

export async function getWarehouses() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT WarehouseId AS warehouseId, WarehouseName AS warehouseName, Address AS address, Status AS status
    FROM dbo.Warehouse
    ORDER BY WarehouseName
  `)
  return result.recordset
}

export async function getInventoryItems() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      i.InventoryId AS inventoryId,
      i.WarehouseId AS warehouseId,
      w.WarehouseName AS warehouseName,
      i.SkuId AS skuId,
      ps.SkuCode AS skuCode,
      p.ProductName AS productName,
      c.CategoryName AS categoryName,
      b.BrandName AS brandName,
      i.QuantityOnHand AS quantityOnHand,
      i.QuantityReserved AS quantityReserved,
      i.QuantityOnHand - i.QuantityReserved AS availableQuantity,
      i.ReorderLevel AS reorderLevel,
      i.AverageUnitCost AS averageUnitCost,
      i.UpdatedAt AS updatedAt
    FROM dbo.Inventory i
    INNER JOIN dbo.Warehouse w ON w.WarehouseId = i.WarehouseId
    INNER JOIN dbo.ProductSku ps ON ps.SkuId = i.SkuId
    INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
    INNER JOIN dbo.Category c ON c.CategoryId = p.CategoryId
    INNER JOIN dbo.Brand b ON b.BrandId = p.BrandId
    ORDER BY availableQuantity ASC, p.ProductName
  `)
  return result.recordset
}

export async function getStockableSkus() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT ps.SkuId AS skuId, ps.SkuCode AS skuCode, p.ProductName AS productName
    FROM dbo.ProductSku ps
    INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
    WHERE ps.Status = 'Active' AND p.Status = 'Active'
    ORDER BY p.ProductName, ps.SkuCode
  `)
  return result.recordset
}

export async function getStockMovements() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT TOP (80)
      sm.StockMovementId AS stockMovementId,
      sm.WarehouseId AS warehouseId,
      w.WarehouseName AS warehouseName,
      sm.SkuId AS skuId,
      ps.SkuCode AS skuCode,
      p.ProductName AS productName,
      sm.MovementType AS movementType,
      sm.QuantityChange AS quantityChange,
      sm.UnitCost AS unitCost,
      sm.SourceType AS sourceType,
      sm.AdjustmentNote AS adjustmentNote,
      sm.CreatedAt AS createdAt,
      u.FullName AS createdBy
    FROM dbo.StockMovement sm
    INNER JOIN dbo.Warehouse w ON w.WarehouseId = sm.WarehouseId
    INNER JOIN dbo.ProductSku ps ON ps.SkuId = sm.SkuId
    INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
    INNER JOIN dbo.UserAccount u ON u.UserId = sm.CreatedByUserId
    ORDER BY sm.CreatedAt DESC, sm.StockMovementId DESC
  `)
  return result.recordset
}

export async function getReadyOrdersForExport() {
  const pool = await getPool()
  const result = await pool.request().query(`
    SELECT
      so.OrderId AS orderId,
      so.OrderCode AS orderCode,
      so.ReceiverName AS receiverName,
      so.ReceiverPhone AS receiverPhone,
      so.ShippingAddressSnapshot AS shippingAddress,
      so.UpdatedAt AS readyAt,
      sod.OrderDetailId AS orderDetailId,
      sod.SkuId AS skuId,
      sod.SkuCodeSnapshot AS skuCode,
      sod.ProductNameSnapshot AS productName,
      sod.Quantity AS quantity,
      w.WarehouseId AS warehouseId,
      w.WarehouseName AS warehouseName,
      oir.QuantityReserved - oir.QuantityFulfilled AS quantityWaiting
    FROM dbo.SalesOrder so
    INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
    INNER JOIN dbo.SalesOrderDetail sod ON sod.OrderId = so.OrderId
    INNER JOIN dbo.OrderInventoryReservation oir ON oir.OrderDetailId = sod.OrderDetailId
    INNER JOIN dbo.Inventory i ON i.InventoryId = oir.InventoryId
    INNER JOIN dbo.Warehouse w ON w.WarehouseId = i.WarehouseId
    WHERE os.StatusCode = 'ReadyToShip'
      AND oir.QuantityReserved > oir.QuantityFulfilled
    ORDER BY so.UpdatedAt, so.OrderId, sod.OrderDetailId
  `)

  const orders = new Map<number, {
    orderId: number
    orderCode: string
    receiverName: string
    receiverPhone: string
    shippingAddress: string
    readyAt: string
    items: unknown[]
  }>()

  for (const row of result.recordset) {
    const orderId = Number(row.orderId)
    if (!orders.has(orderId)) {
      orders.set(orderId, {
        orderId,
        orderCode: row.orderCode,
        receiverName: row.receiverName,
        receiverPhone: row.receiverPhone,
        shippingAddress: row.shippingAddress,
        readyAt: row.readyAt,
        items: [],
      })
    }
    orders.get(orderId)!.items.push({
      orderDetailId: row.orderDetailId,
      skuId: row.skuId,
      skuCode: row.skuCode,
      productName: row.productName,
      quantity: row.quantity,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      quantityWaiting: row.quantityWaiting,
    })
  }

  return [...orders.values()]
}

export async function confirmOrderExport(orderId: number, userId: number) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const orderResult = await tx()
      .input('orderId', sql.BigInt, orderId)
      .query(`
        SELECT so.OrderCode, so.OrderStatusId, os.StatusCode
        FROM dbo.SalesOrder so WITH (UPDLOCK, ROWLOCK)
        INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
        WHERE so.OrderId = @orderId
      `)

    const order = orderResult.recordset[0]
    if (!order) throw new Error('Không tìm thấy đơn hàng.')
    if (order.StatusCode !== 'ReadyToShip') throw new Error('Chỉ đơn ở trạng thái Sẵn sàng giao/xuất kho mới được xác nhận xuất.')

    const existing = await tx()
      .input('orderId', sql.BigInt, orderId)
      .query(`
        SELECT TOP (1) StockOutReceiptId
        FROM dbo.StockOutReceipt WITH (UPDLOCK, HOLDLOCK)
        WHERE OrderId = @orderId AND Reason = 'Order' AND Status = 'Confirmed'
      `)
    if (existing.recordset.length) throw new Error('Đơn hàng này đã được xuất kho.')

    const allocations = await tx()
      .input('orderId', sql.BigInt, orderId)
      .query(`
        SELECT
          sod.OrderDetailId,
          sod.SkuId,
          oir.OrderInventoryReservationId,
          oir.InventoryId,
          i.WarehouseId,
          i.QuantityOnHand,
          i.QuantityReserved,
          i.AverageUnitCost,
          oir.QuantityReserved - oir.QuantityFulfilled AS QuantityToExport
        FROM dbo.SalesOrderDetail sod
        INNER JOIN dbo.OrderInventoryReservation oir WITH (UPDLOCK, ROWLOCK)
          ON oir.OrderDetailId = sod.OrderDetailId
        INNER JOIN dbo.Inventory i WITH (UPDLOCK, ROWLOCK)
          ON i.InventoryId = oir.InventoryId
        WHERE sod.OrderId = @orderId
          AND oir.QuantityReserved > oir.QuantityFulfilled
        ORDER BY i.WarehouseId, sod.OrderDetailId
      `)
    if (!allocations.recordset.length) throw new Error('Đơn không còn hàng đang giữ để xuất.')

    const receiptIds = new Map<number, number>()
    for (const item of allocations.recordset) {
      const quantity = Number(item.QuantityToExport)
      const unitCost = Number(item.AverageUnitCost)
      if (quantity < 1 || Number(item.QuantityOnHand) < quantity || Number(item.QuantityReserved) < quantity) {
        throw new Error(`Tồn kho của SKU ${item.SkuId} không khớp với lượng đang giữ.`)
      }

      const warehouseId = Number(item.WarehouseId)
      let receiptId = receiptIds.get(warehouseId)
      if (!receiptId) {
        const receipt = await tx()
          .input('receiptCode', sql.VarChar(50), `ORD-${orderId}-${warehouseId}`)
          .input('warehouseId', sql.BigInt, warehouseId)
          .input('orderId', sql.BigInt, orderId)
          .input('userId', sql.BigInt, userId)
          .query(`
            INSERT INTO dbo.StockOutReceipt (
              ReceiptCode, WarehouseId, OrderId, CreatedByUserId,
              Reason, ReceiptDate, Status, Note
            )
            OUTPUT INSERTED.StockOutReceiptId
            VALUES (
              @receiptCode, @warehouseId, @orderId, @userId,
              'Order', SYSDATETIME(), 'Confirmed', N'Nhân viên kho xác nhận xuất theo đơn'
            )
          `)
        receiptId = Number(receipt.recordset[0].StockOutReceiptId)
        receiptIds.set(warehouseId, receiptId)
      }

      await tx()
        .input('receiptId', sql.BigInt, receiptId)
        .input('orderDetailId', sql.BigInt, item.OrderDetailId)
        .input('skuId', sql.BigInt, item.SkuId)
        .input('quantity', sql.Int, quantity)
        .input('unitCost', sql.Decimal(18, 2), unitCost)
        .query(`
          INSERT INTO dbo.StockOutReceiptDetail (StockOutReceiptId, OrderDetailId, SkuId, Quantity, UnitCost)
          VALUES (@receiptId, @orderDetailId, @skuId, @quantity, @unitCost)
        `)

      await tx()
        .input('orderDetailId', sql.BigInt, item.OrderDetailId)
        .input('costOfGoodsSold', sql.Decimal(18, 2), unitCost * quantity)
        .query(`UPDATE dbo.SalesOrderDetail SET CostOfGoodsSold = CostOfGoodsSold + @costOfGoodsSold WHERE OrderDetailId = @orderDetailId`)

      await tx()
        .input('inventoryId', sql.BigInt, item.InventoryId)
        .input('quantity', sql.Int, quantity)
        .query(`
          UPDATE dbo.Inventory
          SET QuantityOnHand = QuantityOnHand - @quantity,
              QuantityReserved = QuantityReserved - @quantity,
              UpdatedAt = SYSDATETIME()
          WHERE InventoryId = @inventoryId
        `)

      await tx()
        .input('reservationId', sql.BigInt, item.OrderInventoryReservationId)
        .input('quantity', sql.Int, quantity)
        .query(`
          UPDATE dbo.OrderInventoryReservation
          SET QuantityFulfilled = QuantityFulfilled + @quantity,
              UpdatedAt = SYSDATETIME()
          WHERE OrderInventoryReservationId = @reservationId
        `)

      await tx()
        .input('warehouseId', sql.BigInt, warehouseId)
        .input('skuId', sql.BigInt, item.SkuId)
        .input('quantity', sql.Int, -quantity)
        .input('unitCost', sql.Decimal(18, 2), unitCost)
        .input('receiptId', sql.BigInt, receiptId)
        .input('userId', sql.BigInt, userId)
        .query(`
          INSERT INTO dbo.StockMovement (
            WarehouseId, SkuId, MovementType, QuantityChange, SourceType,
            StockOutReceiptId, UnitCost, AdjustmentNote, CreatedByUserId, CreatedAt
          )
          VALUES (
            @warehouseId, @skuId, 'OUT', @quantity, 'StockOut',
            @receiptId, @unitCost, N'Xuất theo đơn hàng', @userId, SYSDATETIME()
          )
        `)
    }

    await tx()
      .input('orderId', sql.BigInt, orderId)
      .query(`
        UPDATE dbo.SalesOrder
        SET OrderStatusId = (SELECT OrderStatusId FROM dbo.OrderStatus WHERE StatusCode = 'Shipping'),
            UpdatedAt = SYSDATETIME()
        WHERE OrderId = @orderId
      `)

    await tx()
      .input('orderId', sql.BigInt, orderId)
      .input('fromStatusId', sql.TinyInt, order.OrderStatusId)
      .input('changedByUserId', sql.BigInt, userId)
      .query(`
        INSERT INTO dbo.OrderStatusHistory (
          OrderId, FromStatusId, ToStatusId, ChangedByUserId, Note, ChangedAt
        )
        VALUES (
          @orderId,
          @fromStatusId,
          (SELECT OrderStatusId FROM dbo.OrderStatus WHERE StatusCode = 'Shipping'),
          @changedByUserId,
          N'Kho xác nhận xuất hàng',
          SYSDATETIME()
        )
      `)

    await transaction.commit()
    return { orderId, orderCode: order.OrderCode, receiptIds: [...receiptIds.values()] }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function createStockIn(input: StockInInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)
    const receiptCode = makeReceiptCode('IN')

    const receipt = await tx()
      .input('receiptCode', sql.VarChar(50), receiptCode)
      .input('warehouseId', sql.BigInt, input.warehouseId)
      .input('userId', sql.BigInt, input.userId)
      .input('note', sql.NVarChar(500), input.note)
      .query(`
        INSERT INTO dbo.StockInReceipt (ReceiptCode, WarehouseId, SupplierId, CreatedByUserId, ReceiptDate, Status, Note)
        OUTPUT INSERTED.StockInReceiptId
        VALUES (@receiptCode, @warehouseId, NULL, @userId, SYSDATETIME(), 'Confirmed', @note)
      `)

    const receiptId = receipt.recordset[0].StockInReceiptId as number

    await tx()
      .input('receiptId', sql.BigInt, receiptId)
      .input('skuId', sql.BigInt, input.skuId)
      .input('quantity', sql.Int, input.quantity)
      .input('unitCost', sql.Decimal(18, 2), input.unitCost)
      .query(`
        INSERT INTO dbo.StockInReceiptDetail (StockInReceiptId, SkuId, Quantity, UnitCost)
        VALUES (@receiptId, @skuId, @quantity, @unitCost)
      `)

    const currentInventory = await tx()
      .input('warehouseId', sql.BigInt, input.warehouseId)
      .input('skuId', sql.BigInt, input.skuId)
      .query(`
        SELECT TOP (1) InventoryId, QuantityOnHand, AverageUnitCost
        FROM dbo.Inventory WITH (UPDLOCK, HOLDLOCK)
        WHERE WarehouseId = @warehouseId AND SkuId = @skuId
      `)

    const current = currentInventory.recordset[0]
    let averageUnitCost = input.unitCost

    if (current) {
      const oldQuantity = Number(current.QuantityOnHand)
      const oldAverage = Number(current.AverageUnitCost)
      averageUnitCost = ((oldQuantity * oldAverage) + (input.quantity * input.unitCost)) / (oldQuantity + input.quantity)
      await tx()
        .input('inventoryId', sql.BigInt, current.InventoryId)
        .input('quantity', sql.Int, input.quantity)
        .input('averageUnitCost', sql.Decimal(18, 2), averageUnitCost)
        .query(`UPDATE dbo.Inventory SET QuantityOnHand = QuantityOnHand + @quantity, AverageUnitCost = @averageUnitCost, UpdatedAt = SYSDATETIME() WHERE InventoryId = @inventoryId`)
    } else {
      await tx()
        .input('warehouseId', sql.BigInt, input.warehouseId)
        .input('skuId', sql.BigInt, input.skuId)
        .input('quantity', sql.Int, input.quantity)
        .input('averageUnitCost', sql.Decimal(18, 2), averageUnitCost)
        .query(`INSERT INTO dbo.Inventory (WarehouseId, SkuId, QuantityOnHand, QuantityReserved, ReorderLevel, AverageUnitCost, UpdatedAt) VALUES (@warehouseId, @skuId, @quantity, 0, 3, @averageUnitCost, SYSDATETIME())`)
    }

    await tx()
      .input('warehouseId', sql.BigInt, input.warehouseId)
      .input('skuId', sql.BigInt, input.skuId)
      .input('quantity', sql.Int, input.quantity)
      .input('unitCost', sql.Decimal(18, 2), input.unitCost)
      .input('receiptId', sql.BigInt, receiptId)
      .input('note', sql.NVarChar(500), input.note)
      .input('userId', sql.BigInt, input.userId)
      .query(`
        INSERT INTO dbo.StockMovement (
          WarehouseId, SkuId, MovementType, QuantityChange, SourceType,
          StockInReceiptId, UnitCost, AdjustmentNote, CreatedByUserId, CreatedAt
        )
        VALUES (@warehouseId, @skuId, 'IN', @quantity, 'StockIn', @receiptId, @unitCost, @note, @userId, SYSDATETIME())
      `)

    await transaction.commit()
    return { stockInReceiptId: receiptId, receiptCode }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function createStockOut(input: StockOutInput) {
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)

  try {
    await transaction.begin()
    const tx = () => new sql.Request(transaction)

    const inventory = await tx()
      .input('warehouseId', sql.BigInt, input.warehouseId)
      .input('skuId', sql.BigInt, input.skuId)
      .query(`
        SELECT TOP (1) InventoryId, QuantityOnHand, QuantityReserved, AverageUnitCost
        FROM dbo.Inventory WITH (UPDLOCK, ROWLOCK)
        WHERE WarehouseId = @warehouseId AND SkuId = @skuId
      `)

    const current = inventory.recordset[0]
    if (!current || Number(current.QuantityOnHand) - Number(current.QuantityReserved) < input.quantity) {
      throw new Error('Không đủ tồn khả dụng để xuất kho.')
    }

    const receiptCode = makeReceiptCode('OUT')
    const unitCost = Number(current.AverageUnitCost)
    const receipt = await tx()
      .input('receiptCode', sql.VarChar(50), receiptCode)
      .input('warehouseId', sql.BigInt, input.warehouseId)
      .input('userId', sql.BigInt, input.userId)
      .input('reason', sql.VarChar(50), input.reason)
      .input('note', sql.NVarChar(500), input.note)
      .query(`
        INSERT INTO dbo.StockOutReceipt (ReceiptCode, WarehouseId, OrderId, CreatedByUserId, Reason, ReceiptDate, Status, Note)
        OUTPUT INSERTED.StockOutReceiptId
        VALUES (@receiptCode, @warehouseId, NULL, @userId, @reason, SYSDATETIME(), 'Confirmed', @note)
      `)

    const receiptId = receipt.recordset[0].StockOutReceiptId as number

    await tx()
      .input('receiptId', sql.BigInt, receiptId)
      .input('skuId', sql.BigInt, input.skuId)
      .input('quantity', sql.Int, input.quantity)
      .input('unitCost', sql.Decimal(18, 2), unitCost)
      .query(`
        INSERT INTO dbo.StockOutReceiptDetail (StockOutReceiptId, OrderDetailId, SkuId, Quantity, UnitCost)
        VALUES (@receiptId, NULL, @skuId, @quantity, @unitCost)
      `)

    await tx()
      .input('inventoryId', sql.BigInt, current.InventoryId)
      .input('quantity', sql.Int, input.quantity)
      .query(`
        UPDATE dbo.Inventory
        SET QuantityOnHand = QuantityOnHand - @quantity,
            UpdatedAt = SYSDATETIME()
        WHERE InventoryId = @inventoryId
      `)

    await tx()
      .input('warehouseId', sql.BigInt, input.warehouseId)
      .input('skuId', sql.BigInt, input.skuId)
      .input('quantity', sql.Int, -input.quantity)
      .input('unitCost', sql.Decimal(18, 2), unitCost)
      .input('receiptId', sql.BigInt, receiptId)
      .input('note', sql.NVarChar(500), input.note)
      .input('userId', sql.BigInt, input.userId)
      .query(`
        INSERT INTO dbo.StockMovement (
          WarehouseId, SkuId, MovementType, QuantityChange, SourceType,
          StockOutReceiptId, UnitCost, AdjustmentNote, CreatedByUserId, CreatedAt
        )
        VALUES (@warehouseId, @skuId, 'OUT', @quantity, 'StockOut', @receiptId, @unitCost, @note, @userId, SYSDATETIME())
      `)

    await transaction.commit()
    return { stockOutReceiptId: receiptId, receiptCode }
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}
