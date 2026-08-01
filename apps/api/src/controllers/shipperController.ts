import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  completeShipmentDelivery,
  failShipmentDelivery,
  getShipperShipments,
  requestShipmentReturn,
  rescheduleShipmentDelivery,
  retryShipmentDelivery,
} from '../services/shipperService.js'

function shipmentIdFrom(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function isAdmin(request: AuthRequest) {
  return request.user?.roles.includes('SystemAdmin') ?? false
}

function businessError(error: unknown, response: Response, next: NextFunction) {
  if (error instanceof Error) {
    response.status(400).json({ message: error.message })
    return
  }
  next(error)
}

export async function listMyShipments(request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getShipperShipments(request.user!.userId, isAdmin(request)) })
  } catch (error) {
    next(error)
  }
}

export async function completeDelivery(request: AuthRequest, response: Response, next: NextFunction) {
  const shipmentId = shipmentIdFrom(request.params.shipmentId)
  if (!shipmentId) return void response.status(400).json({ message: 'Chuyến giao hàng không hợp lệ.' })
  try {
    response.json({ data: await completeShipmentDelivery(shipmentId, request.user!.userId, isAdmin(request)) })
  } catch (error) {
    businessError(error, response, next)
  }
}

export async function failDelivery(request: AuthRequest, response: Response, next: NextFunction) {
  const shipmentId = shipmentIdFrom(request.params.shipmentId)
  const reason = text(request.body.reason)
  if (!shipmentId || !reason) return void response.status(400).json({ message: 'Vui lòng nhập lý do giao không thành công.' })
  try {
    response.json({ data: await failShipmentDelivery(shipmentId, request.user!.userId, isAdmin(request), reason) })
  } catch (error) {
    businessError(error, response, next)
  }
}

export async function rescheduleDelivery(request: AuthRequest, response: Response, next: NextFunction) {
  const shipmentId = shipmentIdFrom(request.params.shipmentId)
  const estimatedDeliveryAt = text(request.body.estimatedDeliveryAt)
  const note = text(request.body.note)
  if (!shipmentId || !estimatedDeliveryAt || !note) return void response.status(400).json({ message: 'Vui lòng nhập thời gian và ghi chú hẹn giao lại.' })
  try {
    response.json({ data: await rescheduleShipmentDelivery(shipmentId, request.user!.userId, isAdmin(request), estimatedDeliveryAt, note) })
  } catch (error) {
    businessError(error, response, next)
  }
}

export async function retryDelivery(request: AuthRequest, response: Response, next: NextFunction) {
  const shipmentId = shipmentIdFrom(request.params.shipmentId)
  if (!shipmentId) return void response.status(400).json({ message: 'Chuyến giao hàng không hợp lệ.' })
  try {
    response.json({ data: await retryShipmentDelivery(shipmentId, request.user!.userId, isAdmin(request)) })
  } catch (error) {
    businessError(error, response, next)
  }
}

export async function requestReturn(request: AuthRequest, response: Response, next: NextFunction) {
  const shipmentId = shipmentIdFrom(request.params.shipmentId)
  const reason = text(request.body.reason)
  if (!shipmentId || !reason) return void response.status(400).json({ message: 'Vui lòng nhập lý do trả hàng về kho.' })
  try {
    response.json({ data: await requestShipmentReturn(shipmentId, request.user!.userId, isAdmin(request), reason) })
  } catch (error) {
    businessError(error, response, next)
  }
}
