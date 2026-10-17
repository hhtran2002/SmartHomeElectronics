import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { getSerialProfitReportHandler, listSerials } from '../controllers/productSerialController.js'

export const adminSerialsRouter = Router()

adminSerialsRouter.use(requireAuth, requireRoles(['SystemAdmin', 'WarehouseStaff', 'OrderAdmin']))

adminSerialsRouter.get('/', listSerials)
adminSerialsRouter.get('/profit-report', getSerialProfitReportHandler)
