import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { getProductDetail, listProducts } from '../controllers/productController.js'
import {
  getReviewEligibility,
  submitProductQuestion,
  submitProductReview,
} from '../controllers/reviewController.js'

export const productsRouter = Router()

productsRouter.get('/', listProducts)
productsRouter.get('/:slug', getProductDetail)
productsRouter.get('/:slug/review-eligibility', requireAuth, getReviewEligibility)
productsRouter.post('/:slug/reviews', requireAuth, submitProductReview)
productsRouter.post('/:slug/questions', requireAuth, submitProductQuestion)
