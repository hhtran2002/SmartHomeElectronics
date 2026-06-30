import { Router } from 'express'
import { listPaymentMethods } from '../controllers/paymentMethodController.js'

export const paymentMethodsRouter = Router()

paymentMethodsRouter.get('/', listPaymentMethods)
