import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { getProductDetail, listProducts } from '../controllers/productController.js'
import { submitProductReview } from '../controllers/reviewController.js'

export const productsRouter = Router()

productsRouter.get('/', listProducts)
productsRouter.get('/:slug', getProductDetail)
productsRouter.post('/:slug/reviews', requireAuth, submitProductReview)
