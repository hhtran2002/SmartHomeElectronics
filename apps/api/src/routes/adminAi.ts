import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  getCatalogImageIndexStatus,
  getCatalogIndexStatus,
  reindexCatalog,
  reindexCatalogImages,
} from '../controllers/adminAiController.js'

export const adminAiRouter = Router()

adminAiRouter.use(requireAuth, requireRoles(['SystemAdmin']))
adminAiRouter.get('/catalog-index', getCatalogIndexStatus)
adminAiRouter.post('/catalog-index', reindexCatalog)
adminAiRouter.get('/catalog-image-index', getCatalogImageIndexStatus)
adminAiRouter.post('/catalog-image-index', reindexCatalogImages)
