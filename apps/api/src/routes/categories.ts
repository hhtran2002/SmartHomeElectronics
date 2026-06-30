import { Router } from 'express'
import { listCategories } from '../controllers/categoryController.js'

export const categoriesRouter = Router()

categoriesRouter.get('/', listCategories)
