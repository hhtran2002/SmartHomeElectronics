import { getPool, sql } from '../config/database.js'

export type ReportRange = {
  fromDate: string
  toDate: string
}

function addRangeInputs(request: sql.Request, range: ReportRange) {
  return request
    .input('fromDate', sql.Date, range.fromDate)
    .input('toDate', sql.Date, range.toDate)
}

export async function getAdminReports(range: ReportRange) {
  const pool = await getPool()
  const request = addRangeInputs(pool.request(), range)

  const result = await request.query(`
    SELECT
      COUNT(*) AS totalOrders,
      ISNULL(SUM(CASE WHEN os.StatusCode <> 'Cancelled' THEN so.TotalAmount ELSE 0 END), 0) AS grossRevenue,
      ISNULL(SUM(CASE WHEN ps.StatusCode = 'Success' THEN so.TotalAmount ELSE 0 END), 0) AS paidRevenue,
      ISNULL(SUM(CASE WHEN os.StatusCode <> 'Cancelled' THEN so.ShippingFee ELSE 0 END), 0) AS shippingFee,
      ISNULL(AVG(CASE WHEN os.StatusCode <> 'Cancelled' THEN so.TotalAmount END), 0) AS averageOrderValue,
      SUM(CASE WHEN os.StatusCode = 'Cancelled' THEN 1 ELSE 0 END) AS cancelledOrders
    FROM dbo.SalesOrder so
    INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
    INNER JOIN dbo.PaymentStatus ps ON ps.PaymentStatusId = so.PaymentStatusId
    WHERE so.CreatedAt >= @fromDate
      AND so.CreatedAt < DATEADD(day, 1, @toDate);

    SELECT
      CONVERT(varchar(10), so.CreatedAt, 23) AS reportDate,
      COUNT(*) AS orderCount,
      ISNULL(SUM(CASE WHEN os.StatusCode <> 'Cancelled' THEN so.TotalAmount ELSE 0 END), 0) AS revenue
    FROM dbo.SalesOrder so
    INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
    WHERE so.CreatedAt >= @fromDate
      AND so.CreatedAt < DATEADD(day, 1, @toDate)
    GROUP BY CONVERT(varchar(10), so.CreatedAt, 23)
    ORDER BY reportDate;

    SELECT TOP (10)
      sod.SkuId AS skuId,
      sod.SkuCodeSnapshot AS skuCode,
      sod.ProductNameSnapshot AS productName,
      SUM(sod.Quantity) AS quantitySold,
      ISNULL(SUM(sod.LineTotal), 0) AS revenue
    FROM dbo.SalesOrderDetail sod
    INNER JOIN dbo.SalesOrder so ON so.OrderId = sod.OrderId
    INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
    WHERE so.CreatedAt >= @fromDate
      AND so.CreatedAt < DATEADD(day, 1, @toDate)
      AND os.StatusCode <> 'Cancelled'
    GROUP BY sod.SkuId, sod.SkuCodeSnapshot, sod.ProductNameSnapshot
    ORDER BY revenue DESC, quantitySold DESC;

    SELECT TOP (10)
      cp.CustomerId AS customerId,
      ua.FullName AS customerName,
      ua.Phone AS phone,
      ua.Email AS email,
      COUNT(*) AS orderCount,
      ISNULL(SUM(CASE WHEN os.StatusCode <> 'Cancelled' THEN so.TotalAmount ELSE 0 END), 0) AS totalSpent
    FROM dbo.SalesOrder so
    INNER JOIN dbo.CustomerProfile cp ON cp.CustomerId = so.CustomerId
    INNER JOIN dbo.UserAccount ua ON ua.UserId = cp.UserId
    INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
    WHERE so.CreatedAt >= @fromDate
      AND so.CreatedAt < DATEADD(day, 1, @toDate)
    GROUP BY cp.CustomerId, ua.FullName, ua.Phone, ua.Email
    ORDER BY totalSpent DESC, orderCount DESC;

    SELECT
      os.StatusCode AS statusCode,
      os.StatusName AS statusName,
      COUNT(*) AS orderCount
    FROM dbo.SalesOrder so
    INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
    WHERE so.CreatedAt >= @fromDate
      AND so.CreatedAt < DATEADD(day, 1, @toDate)
    GROUP BY os.StatusCode, os.StatusName, os.SortOrder
    ORDER BY os.SortOrder;

    SELECT TOP (10)
      i.InventoryId AS inventoryId,
      ps.SkuId AS skuId,
      ps.SkuCode AS skuCode,
      p.ProductName AS productName,
      i.QuantityOnHand AS quantityOnHand,
      i.QuantityReserved AS quantityReserved,
      i.QuantityOnHand - i.QuantityReserved AS availableQuantity,
      i.ReorderLevel AS reorderLevel
    FROM dbo.Inventory i
    INNER JOIN dbo.ProductSku ps ON ps.SkuId = i.SkuId
    INNER JOIN dbo.Product p ON p.ProductId = ps.ProductId
    WHERE i.QuantityOnHand - i.QuantityReserved <= i.ReorderLevel
    ORDER BY availableQuantity ASC, i.InventoryId;
  `)

  const recordsets = result.recordsets as unknown as [
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
  ]

  return {
    range,
    summary: recordsets[0][0],
    salesByDay: recordsets[1],
    topProducts: recordsets[2],
    topCustomers: recordsets[3],
    orderStatuses: recordsets[4],
    lowStock: recordsets[5],
  }
}
