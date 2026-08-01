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
          THEN so.SubtotalAmount - so.DiscountAmount
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
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderCost.costOfGoodsSold, 0)
          ELSE 0
        END), 0) AS todayGrossProfit,
        ISNULL(SUM(CASE
          WHEN os.StatusCode IN ('Shipping', 'Completed')
            AND YEAR(so.CreatedAt) = YEAR(SYSDATETIME())
            AND MONTH(so.CreatedAt) = MONTH(SYSDATETIME())
          THEN so.SubtotalAmount - so.DiscountAmount
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
          THEN so.SubtotalAmount - so.DiscountAmount - ISNULL(orderCost.costOfGoodsSold, 0)
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
      ) orderCost;

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
    `)

    const recordsets = result.recordsets as unknown as [Array<Record<string, unknown>>, Array<Record<string, unknown>>]

    response.json({
      data: {
        summary: recordsets[0][0],
        recentOrders: recordsets[1],
      },
    })
  } catch (error) {
    next(error)
  }
})
