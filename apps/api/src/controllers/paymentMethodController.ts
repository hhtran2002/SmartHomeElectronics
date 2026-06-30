import type { NextFunction, Request, Response } from 'express'
import { getActivePaymentMethods } from '../services/paymentMethodService.js'

export async function listPaymentMethods(_request: Request, response: Response, next: NextFunction) {
  try {
    const paymentMethods = await getActivePaymentMethods()
    response.json({ data: paymentMethods })
  } catch (error) {
    next(error)
  }
}
