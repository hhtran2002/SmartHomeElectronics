import { Router } from 'express'
import { optionalAuth } from '../auth.js'
import { createOrder } from '../controllers/orderController.js'

export const ordersRouter = Router()

ordersRouter.post('/', optionalAuth, createOrder)
