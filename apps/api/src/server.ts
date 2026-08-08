import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { getPool } from './config/database.js'
import { adminDashboardRouter } from './routes/adminDashboard.js'
import { adminAiRouter } from './routes/adminAi.js'
import { adminCodRemittancesRouter } from './routes/adminCodRemittances.js'
import { aiAssistantRouter } from './routes/aiAssistant.js'
import { adminInventoryRouter } from './routes/adminInventory.js'
import { adminOrdersRouter } from './routes/adminOrders.js'
import { adminProductsRouter } from './routes/adminProducts.js'
import { adminPromotionsRouter } from './routes/adminPromotions.js'
import { adminReportsRouter } from './routes/adminReports.js'
import { adminReturnsRouter } from './routes/adminReturns.js'
import { adminReviewsRouter } from './routes/adminReviews.js'
import { adminUsersRouter } from './routes/adminUsers.js'
import { authRouter } from './routes/auth.js'
import { brandsRouter } from './routes/brands.js'
import { categoriesRouter } from './routes/categories.js'
import { ordersRouter } from './routes/orders.js'
import { paymentMethodsRouter } from './routes/paymentMethods.js'
import { productsRouter } from './routes/products.js'
import { customerProfileRouter } from './routes/customerProfile.js'
import { locationsRouter } from './routes/locations.js'
import { shipperRouter } from './routes/shipper.js'
import { warehouseDeliveriesRouter } from './routes/warehouseDeliveries.js'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', async (_request, response, next) => {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT DB_NAME() AS databaseName, SYSDATETIME() AS serverTime
    `)
    response.json({
      status: 'ok',
      database: result.recordset[0].databaseName,
      serverTime: result.recordset[0].serverTime,
    })
  } catch (error) {
    next(error)
  }
})

app.use('/api/products', productsRouter)
app.use('/api/ai', aiAssistantRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/brands', brandsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/payment-methods', paymentMethodsRouter)
app.use('/api/auth', authRouter)
app.use('/api/profile', customerProfileRouter)
app.use('/api/locations', locationsRouter)
app.use('/api/shipper', shipperRouter)
app.use('/api/warehouse/deliveries', warehouseDeliveriesRouter)
app.use('/api/admin/dashboard', adminDashboardRouter)
app.use('/api/admin/ai', adminAiRouter)
app.use('/api/admin/cod-remittances', adminCodRemittancesRouter)
app.use('/api/admin/inventory', adminInventoryRouter)
app.use('/api/admin/orders', adminOrdersRouter)
app.use('/api/admin/products', adminProductsRouter)
app.use('/api/admin/promotions', adminPromotionsRouter)
app.use('/api/admin/reports', adminReportsRouter)
app.use('/api/admin/returns', adminReturnsRouter)
app.use('/api/admin/reviews', adminReviewsRouter)
app.use('/api/admin/users', adminUsersRouter)

app.use((
  error: unknown,
  _request: express.Request,
  response: express.Response,
  _next: express.NextFunction,
) => {
  console.error(error)
  response.status(500).json({
    message: 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.',
  })
})

app.listen(port, () => {
  console.log(`API đang chạy tại http://localhost:${port}`)
})
