import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  confirmRemittance,
  getCodOverview,
  rejectRemittance,
} from '../controllers/adminCodRemittanceController.js'

export const adminCodRemittancesRouter = Router()

adminCodRemittancesRouter.use(requireAuth, requireRoles(['SystemAdmin']))

adminCodRemittancesRouter.get('/', getCodOverview)
adminCodRemittancesRouter.post('/:codRemittanceId/confirm', confirmRemittance)
adminCodRemittancesRouter.post('/:codRemittanceId/reject', rejectRemittance)
