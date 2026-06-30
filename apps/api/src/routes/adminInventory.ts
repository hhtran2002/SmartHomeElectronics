import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  confirmReadyOrderExport,
  createStockInReceipt,
  createStockOutReceipt,
  listInventoryItems,
  listReadyOrdersForExport,
  listStockMovements,
  listWarehouses,
} from '../controllers/adminInventoryController.js'

export const adminInventoryRouter = Router()

adminInventoryRouter.use(requireAuth, requireRoles(['WarehouseStaff', 'SystemAdmin']))

adminInventoryRouter.get('/warehouses', listWarehouses)
adminInventoryRouter.get('/', listInventoryItems)
adminInventoryRouter.get('/movements', listStockMovements)
adminInventoryRouter.get('/ready-orders', listReadyOrdersForExport)
adminInventoryRouter.post('/ready-orders/:orderId/confirm-export', confirmReadyOrderExport)
adminInventoryRouter.post('/stock-in', createStockInReceipt)
adminInventoryRouter.post('/stock-out', createStockOutReceipt)
