import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  getReviewSettings,
  listReviews,
  moderateReview,
  updateReviewSettings,
} from '../controllers/adminReviewController.js'

export const adminReviewsRouter = Router()

adminReviewsRouter.use(requireAuth, requireRoles(['SystemAdmin', 'CustomerSupport']))

adminReviewsRouter.get('/', listReviews)
adminReviewsRouter.get('/settings', getReviewSettings)
adminReviewsRouter.patch('/settings', updateReviewSettings)
adminReviewsRouter.patch('/:reviewId/status', moderateReview)
