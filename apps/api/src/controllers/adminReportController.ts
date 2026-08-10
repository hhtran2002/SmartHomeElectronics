import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../auth.js'
import { getAdminReports, getCustomerReport, searchReportCustomers } from '../services/adminReportService.js'

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

function readRange(request: AuthRequest) {
  const fallback = defaultRange()
  return {
    fromDate: toDateInput(request.query.fromDate) || fallback.fromDate,
    toDate: toDateInput(request.query.toDate) || fallback.toDate,
  }
}

export async function searchCustomers(request: AuthRequest, response: Response, next: NextFunction) {
  const range = readRange(request)
  if (range.fromDate > range.toDate) { response.status(400).json({ message: 'Khoảng ngày báo cáo không hợp lệ.' }); return }
  try {
    response.json({ data: await searchReportCustomers(range, String(request.query.search ?? '').trim()) })
  } catch (error) { next(error) }
}

export async function getCustomerDetails(request: AuthRequest, response: Response, next: NextFunction) {
  const customerId = Number(request.params.customerId)
  const range = readRange(request)
  if (!Number.isInteger(customerId) || customerId < 1) { response.status(400).json({ message: 'Khách hàng không hợp lệ.' }); return }
  if (range.fromDate > range.toDate) { response.status(400).json({ message: 'Khoảng ngày báo cáo không hợp lệ.' }); return }
  try {
    const data = await getCustomerReport(range, customerId)
    if (!data.customer) { response.status(404).json({ message: 'Không tìm thấy khách hàng.' }); return }
    response.json({ data })
  } catch (error) { next(error) }
}
