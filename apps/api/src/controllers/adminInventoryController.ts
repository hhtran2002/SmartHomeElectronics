import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  confirmOrderExport,
  createStockIn,
  createStockOut,
  getInventoryItems,
  getStockableSkus,
  getReadyOrdersForExport,
  getStockMovements,
  getWarehouses,
} from '../services/adminInventoryService.js'

function toPositiveInt(value: unknown) {
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null
}

function readText(value: unknown) {
  return String(value ?? '').trim()
}

export async function listWarehouses(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getWarehouses() })
  } catch (error) {
    next(error)
  }
}

export async function listInventoryItems(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getInventoryItems() })
  } catch (error) {
    next(error)
  }
}

export async function listStockableSkus(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getStockableSkus() })
  } catch (error) { next(error) }
}

export async function listStockMovements(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getStockMovements() })
  } catch (error) {
    next(error)
  }
}

export async function listReadyOrdersForExport(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getReadyOrdersForExport() })
  } catch (error) {
    next(error)
  }
}

export async function confirmReadyOrderExport(request: AuthRequest, response: Response, next: NextFunction) {
  const orderId = toPositiveInt(request.params.orderId)
  if (!orderId) {
    response.status(400).json({ message: 'Đơn hàng không hợp lệ.' })
    return
  }

  try {
    response.json({ data: await confirmOrderExport(orderId, request.user!.userId) })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}

export async function createStockInReceipt(request: AuthRequest, response: Response, next: NextFunction) {
  const warehouseId = toPositiveInt(request.body.warehouseId)
  const skuId = toPositiveInt(request.body.skuId)
  const quantity = toPositiveInt(request.body.quantity)
  const unitCost = Number(request.body.unitCost ?? 0)
  const note = readText(request.body.note) || null

  if (!warehouseId || !skuId || !quantity || !Number.isFinite(unitCost) || unitCost < 0) {
    response.status(400).json({ message: 'Dữ liệu nhập kho không hợp lệ.' })
    return
  }

  try {
    const result = await createStockIn({
      warehouseId,
      skuId,
      quantity,
      unitCost,
      note,
      userId: request.user!.userId,
    })
    response.status(201).json({ data: result })
  } catch (error) {
    next(error)
  }
}

export async function createStockOutReceipt(request: AuthRequest, response: Response, next: NextFunction) {
  const warehouseId = toPositiveInt(request.body.warehouseId)
  const skuId = toPositiveInt(request.body.skuId)
  const quantity = toPositiveInt(request.body.quantity)
  const reason = readText(request.body.reason) || 'Adjustment'
  const note = readText(request.body.note) || null

  if (!warehouseId || !skuId || !quantity) {
    response.status(400).json({ message: 'Dữ liệu xuất kho không hợp lệ.' })
    return
  }

  const allowedReasons = new Set(['Order', 'Transfer', 'Warranty', 'Damage', 'ReturnHandling', 'Adjustment'])
  if (!allowedReasons.has(reason)) {
    response.status(400).json({ message: 'Lý do xuất kho không hợp lệ.' })
    return
  }

  try {
    const result = await createStockOut({
      warehouseId,
      skuId,
      quantity,
      reason,
      note,
      userId: request.user!.userId,
    })
    response.status(201).json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}
