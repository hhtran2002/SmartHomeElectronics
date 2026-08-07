import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import { listCategories, createCategory } from '../controllers/categoryController.js'

export const categoriesRouter = Router()

categoriesRouter.get('/', listCategories)
categoriesRouter.post('/', requireAuth, requireRoles(['SystemAdmin']), createCategory)
