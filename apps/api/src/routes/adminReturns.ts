import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { listReturnRequests, processReturnRequest } from '../controllers/adminReturnController.js'

export const adminReturnsRouter = Router()

adminReturnsRouter.use(requireAuth, requireRoles(['SystemAdmin', 'OrderAdmin', 'CustomerSupport']))

adminReturnsRouter.get('/', listReturnRequests)
adminReturnsRouter.patch('/:returnRequestId/status', processReturnRequest)
