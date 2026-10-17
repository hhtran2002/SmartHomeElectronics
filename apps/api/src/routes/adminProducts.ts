import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  addCategoryAttribute,
  addProductImage,
  changeProductStatus,
  createProduct,
  deleteProductImage,
  listAdminProducts,
  listCategoryAttributes,
  listProductAttributes,
  listProductImages,
  setPrimaryImage,
  updateProduct,
} from '../controllers/adminProductController.js'

export const adminProductsRouter = Router()

adminProductsRouter.use(requireAuth, requireRoles(['SystemAdmin']))

adminProductsRouter.get('/', listAdminProducts)
adminProductsRouter.get('/category-attributes/:categoryId', listCategoryAttributes)
adminProductsRouter.post('/category-attributes', addCategoryAttribute)
adminProductsRouter.get('/:id/attributes', listProductAttributes)
adminProductsRouter.post('/', createProduct)
adminProductsRouter.put('/:productId', updateProduct)
adminProductsRouter.get('/:productId/images', listProductImages)
adminProductsRouter.post('/:productId/images', addProductImage)
adminProductsRouter.patch('/:productId/images/:imageId/primary', setPrimaryImage)
adminProductsRouter.delete('/:productId/images/:imageId', deleteProductImage)
adminProductsRouter.patch('/:productId/status', changeProductStatus)
