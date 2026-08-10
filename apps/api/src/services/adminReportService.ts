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
      ISNULL(SUM(CASE WHEN os.StatusCode = 'Cancelled' THEN 1 ELSE 0 END), 0) AS cancelledOrders,
      ISNULL(SUM(CASE
        WHEN os.StatusCode IN ('Shipping', 'Completed') THEN so.SubtotalAmount - so.DiscountAmount
        ELSE 0
      END), 0) AS fulfilledRevenue,
      ISNULL(SUM(CASE
        WHEN os.StatusCode IN ('Shipping', 'Completed') THEN ISNULL(orderCost.costOfGoodsSold, 0)
        ELSE 0
      END), 0) AS costOfGoodsSold,
      ISNULL(SUM(CASE
        WHEN os.StatusCode IN ('Shipping', 'Completed')
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderCost.costOfGoodsSold, 0)
        ELSE 0
      END), 0) AS grossProfit,
      CAST(CASE
        WHEN SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed') THEN so.SubtotalAmount - so.DiscountAmount
          ELSE 0
        END) > 0
        THEN SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
            THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderCost.costOfGoodsSold, 0)
          ELSE 0
        END) * 100.0 / SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed') THEN so.SubtotalAmount - so.DiscountAmount
          ELSE 0
        END)
        ELSE 0
      END AS DECIMAL(9,2)) AS grossMarginPercentage
    FROM dbo.SalesOrder so
    INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
    INNER JOIN dbo.PaymentStatus ps ON ps.PaymentStatusId = so.PaymentStatusId
    OUTER APPLY (
      SELECT SUM(sod.CostOfGoodsSold) AS costOfGoodsSold
      FROM dbo.SalesOrderDetail sod
      WHERE sod.OrderId = so.OrderId
    ) orderCost
    WHERE so.CreatedAt >= @fromDate
      AND so.CreatedAt < DATEADD(day, 1, @toDate);

    SELECT
      CONVERT(varchar(10), so.CreatedAt, 23) AS reportDate,
      COUNT(*) AS orderCount,
      ISNULL(SUM(CASE WHEN os.StatusCode <> 'Cancelled' THEN so.TotalAmount ELSE 0 END), 0) AS revenue,
      ISNULL(SUM(CASE
        WHEN os.StatusCode IN ('Shipping', 'Completed') THEN so.SubtotalAmount - so.DiscountAmount
        ELSE 0
      END), 0) AS fulfilledRevenue,
      ISNULL(SUM(CASE
        WHEN os.StatusCode IN ('Shipping', 'Completed') THEN ISNULL(orderCost.costOfGoodsSold, 0)
        ELSE 0
      END), 0) AS costOfGoodsSold,
      ISNULL(SUM(CASE
        WHEN os.StatusCode IN ('Shipping', 'Completed')
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderCost.costOfGoodsSold, 0)
        ELSE 0
      END), 0) AS grossProfit
    FROM dbo.SalesOrder so
    INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
    OUTER APPLY (
      SELECT SUM(sod.CostOfGoodsSold) AS costOfGoodsSold
      FROM dbo.SalesOrderDetail sod
      WHERE sod.OrderId = so.OrderId
    ) orderCost
    WHERE so.CreatedAt >= @fromDate
      AND so.CreatedAt < DATEADD(day, 1, @toDate)
    GROUP BY CONVERT(varchar(10), so.CreatedAt, 23)
    ORDER BY reportDate;

    SELECT
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

export async function searchReportCustomers(range: ReportRange, search: string) {
  const pool = await getPool()
  const result = await addRangeInputs(pool.request(), range)
    .input('search', sql.NVarChar(255), `%${search}%`)
    .query(`
      SELECT TOP (30)
        cp.CustomerId AS customerId, ua.FullName AS customerName, ua.Phone AS phone, ua.Email AS email,
        COUNT(so.OrderId) AS orderCount,
        ISNULL(SUM(CASE WHEN os.StatusCode <> 'Cancelled' THEN so.TotalAmount ELSE 0 END), 0) AS totalSpent
      FROM dbo.CustomerProfile cp
      INNER JOIN dbo.UserAccount ua ON ua.UserId = cp.UserId
      LEFT JOIN dbo.SalesOrder so ON so.CustomerId = cp.CustomerId
        AND so.CreatedAt >= @fromDate AND so.CreatedAt < DATEADD(day, 1, @toDate)
      LEFT JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      WHERE @search = N'%%' OR ua.FullName LIKE @search OR ua.Phone LIKE @search OR ua.Email LIKE @search
      GROUP BY cp.CustomerId, ua.FullName, ua.Phone, ua.Email
      ORDER BY totalSpent DESC, orderCount DESC, ua.FullName
    `)
  return result.recordset
}

export async function getCustomerReport(range: ReportRange, customerId: number) {
  const pool = await getPool()
  const result = await addRangeInputs(pool.request(), range)
    .input('customerId', sql.BigInt, customerId)
    .query(`
      SELECT TOP (1)
        cp.CustomerId AS customerId, ua.FullName AS customerName, ua.Phone AS phone, ua.Email AS email,
        COUNT(so.OrderId) AS orderCount,
        ISNULL(SUM(CASE WHEN os.StatusCode <> 'Cancelled' THEN so.TotalAmount ELSE 0 END), 0) AS totalSpent,
        ISNULL(SUM(CASE WHEN ps.StatusCode = 'Success' THEN so.TotalAmount ELSE 0 END), 0) AS paidAmount,
        ISNULL(AVG(CASE WHEN os.StatusCode <> 'Cancelled' THEN so.TotalAmount END), 0) AS averageOrderValue
      FROM dbo.CustomerProfile cp
      INNER JOIN dbo.UserAccount ua ON ua.UserId = cp.UserId
      LEFT JOIN dbo.SalesOrder so ON so.CustomerId = cp.CustomerId
        AND so.CreatedAt >= @fromDate AND so.CreatedAt < DATEADD(day, 1, @toDate)
      LEFT JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      LEFT JOIN dbo.PaymentStatus ps ON ps.PaymentStatusId = so.PaymentStatusId
      WHERE cp.CustomerId = @customerId
      GROUP BY cp.CustomerId, ua.FullName, ua.Phone, ua.Email;

      SELECT
        so.OrderId AS orderId, so.OrderCode AS orderCode, so.CreatedAt AS createdAt,
        so.TotalAmount AS totalAmount, os.StatusName AS orderStatusName, ps.StatusName AS paymentStatusName,
        ISNULL(items.itemCount, 0) AS itemCount, ISNULL(items.totalQuantity, 0) AS totalQuantity
      FROM dbo.SalesOrder so
      INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      INNER JOIN dbo.PaymentStatus ps ON ps.PaymentStatusId = so.PaymentStatusId
      OUTER APPLY (SELECT COUNT(*) AS itemCount, SUM(Quantity) AS totalQuantity FROM dbo.SalesOrderDetail WHERE OrderId = so.OrderId) items
      WHERE so.CustomerId = @customerId
        AND so.CreatedAt >= @fromDate AND so.CreatedAt < DATEADD(day, 1, @toDate)
      ORDER BY so.CreatedAt DESC;
    `)
  const recordsets = result.recordsets as unknown as [Array<Record<string, unknown>>, Array<Record<string, unknown>>]
  return { range, customer: recordsets[0][0] ?? null, orders: recordsets[1] }
}
