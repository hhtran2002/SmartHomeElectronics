import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  addProductImage,
  changeProductStatus,
  createProduct,
  deleteProductImage,
  listAdminProducts,
  listProductImages,
  setPrimaryImage,
  updateProduct,
} from '../controllers/adminProductController.js'

export const adminProductsRouter = Router()

adminProductsRouter.use(requireAuth, requireRoles(['SystemAdmin']))

adminProductsRouter.get('/', listAdminProducts)
adminProductsRouter.post('/', createProduct)
adminProductsRouter.put('/:productId', updateProduct)
adminProductsRouter.get('/:productId/images', listProductImages)
adminProductsRouter.post('/:productId/images', addProductImage)
adminProductsRouter.patch('/:productId/images/:imageId/primary', setPrimaryImage)
adminProductsRouter.delete('/:productId/images/:imageId', deleteProductImage)
adminProductsRouter.patch('/:productId/status', changeProductStatus)
