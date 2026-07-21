import { Router } from 'express'
import { chatAboutProducts, findProductsByMeaning } from '../controllers/aiAssistantController.js'
import { aiRateLimit } from '../middleware/aiRateLimit.js'
import { requireAuth } from '../auth.js'

export const aiAssistantRouter = Router()

aiAssistantRouter.post('/search', aiRateLimit, findProductsByMeaning)
aiAssistantRouter.post('/chat', aiRateLimit, requireAuth, chatAboutProducts)
