import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  getAdminOrderDetail,
  getAdminOrders,
  updateAdminOrderStatus,
} from '../services/adminOrderService.js'

export async function listAdminOrders(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    const orders = await getAdminOrders()
    response.json({ data: orders })
  } catch (error) {
    next(error)
  }
}

export async function getAdminOrder(request: AuthRequest, response: Response, next: NextFunction) {
  const orderId = Number(request.params.orderId)

  if (!Number.isInteger(orderId) || orderId < 1) {
    response.status(400).json({ message: 'Đơn hàng không hợp lệ.' })
    return
  }

  try {
    const detail = await getAdminOrderDetail(orderId)
    if (!detail) {
      response.status(404).json({ message: 'Không tìm thấy đơn hàng.' })
      return
    }

    response.json({ data: detail })
  } catch (error) {
    next(error)
  }
}

export async function changeAdminOrderStatus(request: AuthRequest, response: Response, next: NextFunction) {
  const orderId = Number(request.params.orderId)
  const orderStatusId = Number(request.body.orderStatusId)

  if (!Number.isInteger(orderId) || orderId < 1 || !Number.isInteger(orderStatusId) || orderStatusId < 1) {
    response.status(400).json({ message: 'Đơn hàng hoặc trạng thái không hợp lệ.' })
    return
  }

  try {
    const result = await updateAdminOrderStatus({
      orderId,
      orderStatusId,
      currentUserId: request.user!.userId,
    })
    response.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }

    next(error)
  }
}
