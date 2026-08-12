import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { createOrder } from '../controllers/orderController.js'

export const ordersRouter = Router()

ordersRouter.post('/', requireAuth, createOrder)
