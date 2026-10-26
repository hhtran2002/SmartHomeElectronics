import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  getCatalogImageIndexStatus,
  getCatalogIndexStatus,
  getAiEvaluationReport,
  reindexCatalog,
  reindexCatalogImages,
  runAiEvaluationBenchmark,
} from '../controllers/adminAiController.js'

export const adminAiRouter = Router()

adminAiRouter.use(requireAuth, requireRoles(['SystemAdmin', 'OrderAdmin']))
adminAiRouter.get('/catalog-index', getCatalogIndexStatus)
adminAiRouter.post('/catalog-index', reindexCatalog)
adminAiRouter.get('/catalog-image-index', getCatalogImageIndexStatus)
adminAiRouter.post('/catalog-image-index', reindexCatalogImages)
adminAiRouter.get('/evaluation', getAiEvaluationReport)
adminAiRouter.post('/evaluation/run', runAiEvaluationBenchmark)

