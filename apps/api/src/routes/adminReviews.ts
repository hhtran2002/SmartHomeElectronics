import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { listReviews, moderateReview } from '../controllers/adminReviewController.js'

export const adminReviewsRouter = Router()

adminReviewsRouter.use(requireAuth, requireRoles(['SystemAdmin', 'CustomerSupport']))

adminReviewsRouter.get('/', listReviews)
adminReviewsRouter.patch('/:reviewId/status', moderateReview)
