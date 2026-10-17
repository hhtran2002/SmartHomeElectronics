import type { NextFunction, Request, Response } from 'express'
import { getAdminSerials, getSerialProfitReport } from '../services/productSerialService.js'

export async function listSerials(request: Request, response: Response, next: NextFunction) {
  try {
    const filters = {
      search: request.query.search ? String(request.query.search) : undefined,
      status: request.query.status ? String(request.query.status) : undefined,
      skuId: request.query.skuId ? Number(request.query.skuId) : undefined,
      page: request.query.page ? Number(request.query.page) : 1,
      pageSize: request.query.pageSize ? Number(request.query.pageSize) : 20,
    }
    const result = await getAdminSerials(filters)
    response.json(result)
  } catch (error) {
    next(error)
  }
}

export async function getSerialProfitReportHandler(request: Request, response: Response, next: NextFunction) {
  try {
    const filters = {
      fromDate: request.query.fromDate ? String(request.query.fromDate) : undefined,
      toDate: request.query.toDate ? String(request.query.toDate) : undefined,
      skuId: request.query.skuId ? Number(request.query.skuId) : undefined,
      search: request.query.search ? String(request.query.search) : undefined,
    }
    const result = await getSerialProfitReport(filters)
    response.json({ data: result })
  } catch (error) {
    next(error)
  }
}
