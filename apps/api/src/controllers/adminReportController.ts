import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../auth.js'
import { getAdminReports } from '../services/adminReportService.js'

function toDateInput(value: unknown) {
  const text = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function defaultRange() {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const fromDate = new Date(now)
  fromDate.setDate(fromDate.getDate() - 29)
  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: to,
  }
}

export async function getReports(request: AuthRequest, response: Response, next: NextFunction) {
  const fallback = defaultRange()
  const fromDate = toDateInput(request.query.fromDate) || fallback.fromDate
  const toDate = toDateInput(request.query.toDate) || fallback.toDate

  if (fromDate > toDate) {
    response.status(400).json({ message: 'Khoảng ngày báo cáo không hợp lệ.' })
    return
  }

  try {
    response.json({ data: await getAdminReports({ fromDate, toDate }) })
  } catch (error) {
    next(error)
  }
}
