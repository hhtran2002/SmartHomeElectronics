import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { listBrands, createBrand } from '../controllers/brandController.js'

export const brandsRouter = Router()

brandsRouter.get('/', listBrands)
brandsRouter.post('/', requireAuth, requireRoles(['SystemAdmin']), createBrand)
