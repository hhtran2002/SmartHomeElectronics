import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import { confirmOrderExport } from '../services/adminInventoryService.js'
import {
  assignOrderShipment,
  confirmShipmentReturn,
  createDeliveryVehicle,
  getReturnPendingShipments,
  getWarehouseDeliveryOptions,
  updateDeliveryVehicleStatus,
} from '../services/warehouseDeliveryService.js'

function positiveInt(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function handleBusinessError(error: unknown, response: Response, next: NextFunction) {
  if (error instanceof Error) {
    response.status(400).json({ message: error.message })
    return
  }
  next(error)
}

export async function listDeliveryOptions(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getWarehouseDeliveryOptions() })
  } catch (error) {
    next(error)
  }
}

export async function createVehicle(request: AuthRequest, response: Response, next: NextFunction) {
  const vehicleCode = text(request.body.vehicleCode)
  const licensePlate = text(request.body.licensePlate) || null
  const vehicleType = text(request.body.vehicleType)
  const note = text(request.body.note) || null
  if (!vehicleCode || !vehicleType) {
    response.status(400).json({ message: 'Vui lòng nhập mã xe và loại phương tiện.' })
    return
  }

  try {
    response.status(201).json({ data: await createDeliveryVehicle({ vehicleCode, licensePlate, vehicleType, note }) })
  } catch (error) {
    handleBusinessError(error, response, next)
  }
}

export async function changeVehicleStatus(request: AuthRequest, response: Response, next: NextFunction) {
  const vehicleId = positiveInt(request.params.vehicleId)
  const status = text(request.body.status)
  if (!vehicleId || !['Active', 'Maintenance', 'Inactive'].includes(status)) {
    response.status(400).json({ message: 'Phương tiện hoặc trạng thái không hợp lệ.' })
    return
  }

  try {
    response.json({ data: await updateDeliveryVehicleStatus(vehicleId, status) })
  } catch (error) {
    handleBusinessError(error, response, next)
  }
}

export async function assignDelivery(request: AuthRequest, response: Response, next: NextFunction) {
  const orderId = positiveInt(request.params.orderId)
  const deliveryStaffId = positiveInt(request.body.deliveryStaffId)
  const vehicleId = positiveInt(request.body.vehicleId)
  const estimatedDeliveryAt = text(request.body.estimatedDeliveryAt) || null
  const note = text(request.body.note) || null
  if (!orderId || !deliveryStaffId || !vehicleId) {
    response.status(400).json({ message: 'Vui lòng chọn shipper và phương tiện giao hàng.' })
    return
  }

  try {
    response.json({
      data: await assignOrderShipment({
        orderId,
        deliveryStaffId,
        vehicleId,
        estimatedDeliveryAt,
        note,
        assignedByUserId: request.user!.userId,
      }),
    })
  } catch (error) {
    handleBusinessError(error, response, next)
  }
}

export async function handOverDelivery(request: AuthRequest, response: Response, next: NextFunction) {
  const orderId = positiveInt(request.params.orderId)
  if (!orderId) {
    response.status(400).json({ message: 'Đơn hàng không hợp lệ.' })
    return
  }

  try {
    response.json({ data: await confirmOrderExport(orderId, request.user!.userId) })
  } catch (error) {
    handleBusinessError(error, response, next)
  }
}

export async function listPendingReturns(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getReturnPendingShipments() })
  } catch (error) {
    next(error)
  }
}

export async function confirmReturnedDelivery(request: AuthRequest, response: Response, next: NextFunction) {
  const shipmentId = positiveInt(request.params.shipmentId)
  if (!shipmentId) {
    response.status(400).json({ message: 'Chuyến giao hàng không hợp lệ.' })
    return
  }

  try {
    response.json({ data: await confirmShipmentReturn(shipmentId, request.user!.userId) })
  } catch (error) {
    handleBusinessError(error, response, next)
  }
}
