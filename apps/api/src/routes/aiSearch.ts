import { Router } from 'express'
import { imageSearch, semanticSearch } from '../controllers/aiSearchController.js'

export const aiSearchRouter = Router()

aiSearchRouter.get('/semantic', semanticSearch)
aiSearchRouter.post('/image', imageSearch)