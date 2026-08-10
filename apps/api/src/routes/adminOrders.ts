import { Router } from 'express'
import {
  changeAdminOrderStatus,
  getAdminOrder,
  listAdminOrders,
  confirmBankPayment,
} from '../controllers/adminOrderController.js'
import { requireAuth, requireRoles } from '../auth.js'

export const adminOrdersRouter = Router()

adminOrdersRouter.use(requireAuth, requireRoles(['OrderAdmin', 'SystemAdmin']))

adminOrdersRouter.get('/', listAdminOrders)
adminOrdersRouter.get('/:orderId', getAdminOrder)
adminOrdersRouter.patch('/:orderId/status', changeAdminOrderStatus)
adminOrdersRouter.post('/:orderId/confirm-bank-payment', confirmBankPayment)
