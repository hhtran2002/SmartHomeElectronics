import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  createAdminPromotion,
  getAdminPromotions,
  getPromotionSkuOptions,
  updateAdminPromotion,
  updateAdminPromotionStatus,
  type AdminPromotionInput,
} from '../services/adminPromotionService.js'

function readText(value: unknown) {
  return String(value ?? '').trim()
}

function readInput(request: AuthRequest): AdminPromotionInput {
  const skuIds = Array.isArray(request.body.skuIds)
    ? request.body.skuIds.map((skuId: unknown) => Number(skuId))
    : []

  return {
    promotionName: readText(request.body.promotionName),
    discountType: readText(request.body.discountType),
    discountValue: Number(request.body.discountValue),
    startAt: readText(request.body.startAt),
    endAt: readText(request.body.endAt),
    status: readText(request.body.status) || 'Active',
    skuIds,
  }
}

function isValidInput(input: AdminPromotionInput) {
  const start = new Date(input.startAt).getTime()
  const end = new Date(input.endAt).getTime()
  return Boolean(
    input.promotionName
      && ['Percent', 'FixedAmount', 'FixedPrice'].includes(input.discountType)
      && Number.isFinite(input.discountValue)
      && input.discountValue > 0
      && Number.isFinite(start)
      && Number.isFinite(end)
      && start < end
      && ['Active', 'Inactive', 'Expired'].includes(input.status)
      && input.skuIds.length > 0,
  )
}

export async function listPromotions(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getAdminPromotions() })
  } catch (error) {
    next(error)
  }
}

export async function listPromotionSkuOptions(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    response.json({ data: await getPromotionSkuOptions() })
  } catch (error) {
    next(error)
  }
}

export async function createPromotion(request: AuthRequest, response: Response, next: NextFunction) {
  const input = readInput(request)
  if (!isValidInput(input)) {
    response.status(400).json({ message: 'Dữ liệu chương trình giảm giá không hợp lệ.' })
    return
  }

  try {
    response.status(201).json({ data: await createAdminPromotion(input) })
  } catch (error) {
    next(error)
  }
}

export async function updatePromotion(request: AuthRequest, response: Response, next: NextFunction) {
  const promotionId = Number(request.params.promotionId)
  const input = readInput(request)
  if (!promotionId || !isValidInput(input)) {
    response.status(400).json({ message: 'Dữ liệu chương trình giảm giá không hợp lệ.' })
    return
  }

  try {
    response.json({ data: await updateAdminPromotion(promotionId, input) })
  } catch (error) {
    next(error)
  }
}

export async function changePromotionStatus(request: AuthRequest, response: Response, next: NextFunction) {
  const promotionId = Number(request.params.promotionId)
  const status = readText(request.body.status)
  if (!promotionId || !['Active', 'Inactive', 'Expired'].includes(status)) {
    response.status(400).json({ message: 'Trạng thái giảm giá không hợp lệ.' })
    return
  }

  try {
    response.json({ data: await updateAdminPromotionStatus(promotionId, status) })
  } catch (error) {
    next(error)
  }
}
