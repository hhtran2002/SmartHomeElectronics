import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { getCatalogIndexStatus, reindexCatalog } from '../controllers/adminAiController.js'

export const adminAiRouter = Router()

adminAiRouter.use(requireAuth, requireRoles(['SystemAdmin']))
adminAiRouter.get('/catalog-index', getCatalogIndexStatus)
adminAiRouter.post('/catalog-index', reindexCatalog)
