import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { getReports } from '../controllers/adminReportController.js'

export const adminReportsRouter = Router()

adminReportsRouter.use(requireAuth, requireRoles(['OrderAdmin', 'SystemAdmin']))

adminReportsRouter.get('/', getReports)
