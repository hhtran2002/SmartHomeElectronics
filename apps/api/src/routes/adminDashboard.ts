import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { getPool } from '../config/database.js'

export const adminDashboardRouter = Router()

adminDashboardRouter.use(requireAuth, requireRoles(['OrderAdmin', 'WarehouseStaff', 'SystemAdmin']))

adminDashboardRouter.get('/', async (_request, response, next) => {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT
        COUNT(*) AS totalOrders,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('PendingConfirmation', 'PendingPayment', 'Confirmed', 'Processing', 'ReadyToShip') THEN 1
          ELSE 0
        END), 0) AS pendingOrders,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
            AND CAST(so.CreatedAt AS date) = CAST(SYSDATETIME() AS date)
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderRefund.refundedAmount, 0)
          ELSE 0
        END), 0) AS todayRevenue,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
            AND CAST(so.CreatedAt AS date) = CAST(SYSDATETIME() AS date)
          THEN ISNULL(orderCost.costOfGoodsSold, 0)
          ELSE 0
        END), 0) AS todayCostOfGoodsSold,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
            AND CAST(so.CreatedAt AS date) = CAST(SYSDATETIME() AS date)
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderRefund.refundedAmount, 0) - ISNULL(orderCost.costOfGoodsSold, 0)
          ELSE 0
        END), 0) AS todayGrossProfit,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
            AND YEAR(so.CreatedAt) = YEAR(SYSDATETIME())
            AND MONTH(so.CreatedAt) = MONTH(SYSDATETIME())
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderRefund.refundedAmount, 0)
          ELSE 0
        END), 0) AS monthRevenue,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
            AND YEAR(so.CreatedAt) = YEAR(SYSDATETIME())
            AND MONTH(so.CreatedAt) = MONTH(SYSDATETIME())
          THEN ISNULL(orderCost.costOfGoodsSold, 0)
          ELSE 0
        END), 0) AS monthCostOfGoodsSold,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
            AND YEAR(so.CreatedAt) = YEAR(SYSDATETIME())
            AND MONTH(so.CreatedAt) = MONTH(SYSDATETIME())
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderRefund.refundedAmount, 0) - ISNULL(orderCost.costOfGoodsSold, 0)
          ELSE 0
        END), 0) AS monthGrossProfit,
        (SELECT COUNT(*)
         FROM dbo.Inventory
         WHERE QuantityOnHand - QuantityReserved <= ReorderLevel) AS lowStockCount
      FROM dbo.SalesOrder so
      INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      OUTER APPLY (
        SELECT SUM(sod.CostOfGoodsSold) AS costOfGoodsSold
        FROM dbo.SalesOrderDetail sod
        WHERE sod.OrderId = so.OrderId
      ) orderCost
      OUTER APPLY (
        SELECT ISNULL(SUM(rr.RefundAmount), 0) AS refundedAmount
        FROM dbo.OrderReturnRequest rr
        WHERE rr.OrderId = so.OrderId AND rr.RefundStatus = 'Refunded'
      ) orderRefund;

      SELECT TOP (6)
        so.OrderId AS orderId,
        so.OrderCode AS orderCode,
        so.ReceiverName AS receiverName,
        so.TotalAmount AS totalAmount,
        so.CreatedAt AS createdAt,
        os.StatusName AS orderStatusName
      FROM dbo.SalesOrder so
      INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      ORDER BY so.OrderId DESC;

      SELECT
        CONVERT(varchar(10), d.dt, 23) AS reportDate,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderRefund.refundedAmount, 0) ELSE 0
        END), 0) AS revenue,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderRefund.refundedAmount, 0) - ISNULL(orderCost.costOfGoodsSold, 0) ELSE 0
        END), 0) AS grossProfit,
        COUNT(so.OrderId) AS orderCount
      FROM (
        SELECT DATEADD(day, -6, CAST(SYSDATETIME() AS date)) AS dt UNION ALL
        SELECT DATEADD(day, -5, CAST(SYSDATETIME() AS date)) UNION ALL
        SELECT DATEADD(day, -4, CAST(SYSDATETIME() AS date)) UNION ALL
        SELECT DATEADD(day, -3, CAST(SYSDATETIME() AS date)) UNION ALL
        SELECT DATEADD(day, -2, CAST(SYSDATETIME() AS date)) UNION ALL
        SELECT DATEADD(day, -1, CAST(SYSDATETIME() AS date)) UNION ALL
        SELECT CAST(SYSDATETIME() AS date)
      ) d
      LEFT JOIN dbo.SalesOrder so
        ON CAST(so.CreatedAt AS date) = d.dt
      LEFT JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      OUTER APPLY (
        SELECT SUM(sod.CostOfGoodsSold) AS costOfGoodsSold
        FROM dbo.SalesOrderDetail sod
        WHERE sod.OrderId = so.OrderId
      ) orderCost
      OUTER APPLY (
        SELECT ISNULL(SUM(rr.RefundAmount), 0) AS refundedAmount
        FROM dbo.OrderReturnRequest rr
        WHERE rr.OrderId = so.OrderId AND rr.RefundStatus = 'Refunded'
      ) orderRefund
      GROUP BY d.dt
      ORDER BY d.dt;

      SELECT TOP (5)
        sod.ProductNameSnapshot AS productName,
        SUM(sod.Quantity - ISNULL(returnedItem.returnedQuantity, 0)) AS quantitySold,
        ISNULL(SUM(sod.LineTotal - (sod.LineTotal * ISNULL(returnedItem.returnedQuantity, 0) / NULLIF(sod.Quantity, 0))), 0) AS revenue
      FROM dbo.SalesOrderDetail sod
      INNER JOIN dbo.SalesOrder so ON so.OrderId = sod.OrderId
      INNER JOIN dbo.OrderStatus os ON os.OrderStatusId = so.OrderStatusId
      OUTER APPLY (
        SELECT SUM(ri.Quantity) AS returnedQuantity
        FROM dbo.OrderReturnRequestItem ri
        INNER JOIN dbo.OrderReturnRequest rr ON rr.ReturnRequestId = ri.ReturnRequestId
        WHERE ri.OrderDetailId = sod.OrderDetailId AND rr.RefundStatus = 'Refunded'
      ) returnedItem
      WHERE YEAR(so.CreatedAt) = YEAR(SYSDATETIME())
        AND MONTH(so.CreatedAt) = MONTH(SYSDATETIME())
        AND os.StatusCode <> 'Cancelled'
      GROUP BY sod.ProductNameSnapshot
      ORDER BY revenue DESC;
    `)

    const recordsets = result.recordsets as unknown as [
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
      Array<Record<string, unknown>>,
    ]

    response.json({
      data: {
        summary: recordsets[0][0],
        recentOrders: recordsets[1],
        salesByDay: recordsets[2],
        topProducts: recordsets[3],
      },
    })
  } catch (error) {
    next(error)
  }
})


