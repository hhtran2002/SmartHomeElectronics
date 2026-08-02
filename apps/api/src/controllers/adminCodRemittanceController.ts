import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  confirmCodRemittance,
  getAdminCodOverview,
  rejectCodRemittance,
} from '../services/codRemittanceService.js'

function positiveInt(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function dateValue(value: unknown) {
  const raw = text(value)
  if (!raw) return null
  const date = new Date(`${raw}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function businessError(error: unknown, response: Response, next: NextFunction) {
  if (error instanceof Error) {
    response.status(400).json({ message: error.message })
    return
  }
  next(error)
}

export async function getCodOverview(request: AuthRequest, response: Response, next: NextFunction) {
  const deliveryStaffId = request.query.deliveryStaffId ? positiveInt(request.query.deliveryStaffId) : null
  const status = text(request.query.status) || null
  const fromDate = dateValue(request.query.from)
  const toDate = dateValue(request.query.to)
  const validStatuses = ['Submitted', 'Confirmed', 'Rejected', 'Cancelled']
  if (request.query.deliveryStaffId && !deliveryStaffId) {
    response.status(400).json({ message: 'Shipper cần lọc không hợp lệ.' })
    return
  }
  if (status && !validStatuses.includes(status)) {
    response.status(400).json({ message: 'Trạng thái phiếu không hợp lệ.' })
    return
  }
  if (fromDate === undefined || toDate === undefined) {
    response.status(400).json({ message: 'Khoảng ngày đối soát không hợp lệ.' })
    return
  }
  try {
    response.json({
      data: await getAdminCodOverview({ deliveryStaffId, status, fromDate, toDate }),
    })
  } catch (error) {
    next(error)
  }
}

export async function confirmRemittance(request: AuthRequest, response: Response, next: NextFunction) {
  const codRemittanceId = positiveInt(request.params.codRemittanceId)
  const reviewNote = text(request.body.reviewNote)
  if (!codRemittanceId) {
    response.status(400).json({ message: 'Phiếu nộp tiền COD không hợp lệ.' })
    return
  }
  try {
    response.json({
      data: await confirmCodRemittance(codRemittanceId, request.user!.userId, reviewNote),
    })
  } catch (error) {
    businessError(error, response, next)
  }
}

export async function rejectRemittance(request: AuthRequest, response: Response, next: NextFunction) {
  const codRemittanceId = positiveInt(request.params.codRemittanceId)
  const reviewNote = text(request.body.reviewNote)
  if (!codRemittanceId || !reviewNote) {
    response.status(400).json({ message: 'Vui lòng nhập lý do từ chối phiếu COD.' })
    return
  }
  try {
    response.json({
      data: await rejectCodRemittance(codRemittanceId, request.user!.userId, reviewNote),
    })
  } catch (error) {
    businessError(error, response, next)
  }
}
