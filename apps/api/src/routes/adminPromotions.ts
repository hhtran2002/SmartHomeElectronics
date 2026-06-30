import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  changePromotionStatus,
  createPromotion,
  listPromotions,
  listPromotionSkuOptions,
  updatePromotion,
} from '../controllers/adminPromotionController.js'

export const adminPromotionsRouter = Router()

adminPromotionsRouter.use(requireAuth, requireRoles(['SystemAdmin']))

adminPromotionsRouter.get('/sku-options', listPromotionSkuOptions)
adminPromotionsRouter.get('/', listPromotions)
adminPromotionsRouter.post('/', createPromotion)
adminPromotionsRouter.put('/:promotionId', updatePromotion)
adminPromotionsRouter.patch('/:promotionId/status', changePromotionStatus)
