import { Router } from 'express'
import { listBrands } from '../controllers/brandController.js'

export const brandsRouter = Router()

brandsRouter.get('/', listBrands)
