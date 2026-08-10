import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { getCustomerDetails, getReports, searchCustomers } from '../controllers/adminReportController.js'

export const adminReportsRouter = Router()

adminReportsRouter.use(requireAuth, requireRoles(['OrderAdmin', 'SystemAdmin']))

adminReportsRouter.get('/', getReports)
adminReportsRouter.get('/customers', searchCustomers)
adminReportsRouter.get('/customers/:customerId', getCustomerDetails)
