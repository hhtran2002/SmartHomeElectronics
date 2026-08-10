import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import { createCheckoutOrder, type CheckoutItem } from '../services/orderService.js'

function readText(value: unknown) {
  return String(value ?? '').trim()
}

function isPositiveInteger(value: unknown) {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue > 0
}

export async function createOrder(request: AuthRequest, response: Response, next: NextFunction) {
  const customerName = readText(request.body.customerName)
  const phone = readText(request.body.phone)
  const email = readText(request.body.email)
  const province = readText(request.body.province)
  const district = readText(request.body.district)
  const ward = readText(request.body.ward)
  const streetAddress = readText(request.body.streetAddress)
  const note = readText(request.body.note)
  const couponCode = readText(request.body.couponCode)
  const paymentMethodId = Number(request.body.paymentMethodId || 1)
  const items = Array.isArray(request.body.items)
    ? (request.body.items as CheckoutItem[]).map((item) => ({
        skuId: Number(item.skuId),
        quantity: Number(item.quantity),
      }))
    : []

  if (!customerName || !phone || !province || !ward || !streetAddress) {
    response.status(400).json({ message: 'Vui lòng nhập đủ thông tin nhận hàng.' })
    return
  }

  if (!items.length || items.some((item) => !isPositiveInteger(item.skuId) || !isPositiveInteger(item.quantity))) {
    response.status(400).json({ message: 'Giỏ hàng không hợp lệ.' })
    return
  }

  try {
    const order = await createCheckoutOrder({
      userId: request.user?.userId,
      customerName,
      phone,
      email,
      province,
      district,
      ward,
      streetAddress,
      note,
      paymentMethodId,
      couponCode,
      items,
    })

    response.status(201).json({ data: order })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}
