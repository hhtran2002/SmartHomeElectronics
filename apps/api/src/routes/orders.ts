import { Router } from 'express'
import { optionalAuth } from '../auth.js'
import { createOrder, mockPaymentSuccess } from '../controllers/orderController.js'

export const ordersRouter = Router()

ordersRouter.post('/', optionalAuth, createOrder)
ordersRouter.post('/:orderCode/mock-payment-success', mockPaymentSuccess)
