import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { confirmWarehouseStockIn, listReturnRequests, processReturnRequest } from '../controllers/adminReturnController.js'

export const adminReturnsRouter = Router()

adminReturnsRouter.use(requireAuth)

adminReturnsRouter.get('/', requireRoles(['SystemAdmin', 'OrderAdmin', 'CustomerSupport', 'WarehouseStaff']), listReturnRequests)
adminReturnsRouter.patch('/:returnRequestId/status', requireRoles(['SystemAdmin', 'OrderAdmin', 'CustomerSupport']), processReturnRequest)
adminReturnsRouter.patch('/:returnRequestId/warehouse-confirm', requireRoles(['SystemAdmin', 'WarehouseStaff', 'OrderAdmin']), confirmWarehouseStockIn)
