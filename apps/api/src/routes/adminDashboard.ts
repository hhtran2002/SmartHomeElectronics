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
        (SELECT COUNT(*) FROM dbo.SalesOrder) AS totalOrders,
        (SELECT COUNT(*) FROM dbo.SalesOrder WHERE OrderStatusId IN (1, 2, 4)) AS pendingOrders,
        (SELECT ISNULL(SUM(TotalAmount), 0) FROM dbo.SalesOrder WHERE CAST(CreatedAt AS date) = CAST(SYSDATETIME() AS date)) AS todayRevenue,
        (SELECT ISNULL(SUM(TotalAmount), 0)
         FROM dbo.SalesOrder
         WHERE YEAR(CreatedAt) = YEAR(SYSDATETIME())
           AND MONTH(CreatedAt) = MONTH(SYSDATETIME())) AS monthRevenue,
        (SELECT COUNT(*)
         FROM dbo.Inventory
         WHERE QuantityOnHand - QuantityReserved <= ReorderLevel) AS lowStockCount;

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
