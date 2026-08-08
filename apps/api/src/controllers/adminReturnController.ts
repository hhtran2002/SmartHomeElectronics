import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import { getAdminReturnRequests, updateReturnRequestStatus, type ReturnRequestStatus } from '../services/adminReturnService.js'

export async function listReturnRequests(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    const requests = await getAdminReturnRequests()
    response.json({ data: requests })
  } catch (error) {
    next(error)
  }
}

export async function processReturnRequest(request: AuthRequest, response: Response, next: NextFunction) {
  const returnRequestId = Number(request.params.returnRequestId)
  const status = String(request.body.status ?? '').trim() as ReturnRequestStatus
  const adminNote = String(request.body.adminNote ?? '').trim()

  if (!Number.isInteger(returnRequestId) || returnRequestId <= 0) {
    response.status(400).json({ message: 'ReturnRequestId không hợp lệ.' })
    return
  }

  try {
    const result = await updateReturnRequestStatus(returnRequestId, status, adminNote, request.user!.userId)
    response.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}
