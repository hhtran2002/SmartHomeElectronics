import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import {
  confirmWarehouseReturnStockIn,
  getAdminReturnRequests,
  updateReturnWorkflow,
  updateReturnRequestStatus,
  type RefundStatus,
  type ReturnRequestStatus,
  type ReturnWorkflowStatus,
} from '../services/adminReturnService.js'

export async function listReturnRequests(_request: AuthRequest, response: Response, next: NextFunction) {
  try {
    const requests = await getAdminReturnRequests()
    response.json({ data: requests })
  } catch (error) {
    next(error)
  }
}

export async function changeReturnWorkflow(request: AuthRequest, response: Response, next: NextFunction) {
  const returnRequestId = Number(request.params.returnRequestId)
  const workflowStatus = String(request.body.workflowStatus ?? '').trim() as ReturnWorkflowStatus
  if (!Number.isInteger(returnRequestId) || returnRequestId <= 0) {
    response.status(400).json({ message: 'Yêu cầu hoàn hàng không hợp lệ.' })
    return
  }
  try {
    response.json({ data: await updateReturnWorkflow({
      returnRequestId, workflowStatus, adminUserId: request.user!.userId,
    }) })
  } catch (error) {
    if (error instanceof Error) { response.status(400).json({ message: error.message }); return }
    next(error)
  }
}

export async function processReturnRequest(request: AuthRequest, response: Response, next: NextFunction) {
  const returnRequestId = Number(request.params.returnRequestId)
  const status = String(request.body.status ?? '').trim() as ReturnRequestStatus
  const refundStatus = request.body.refundStatus ? String(request.body.refundStatus).trim() as RefundStatus : undefined
  const refundAmount = request.body.refundAmount !== undefined ? Number(request.body.refundAmount) : null
  const deliveryStaffId = request.body.deliveryStaffId ? Number(request.body.deliveryStaffId) : null
  const adminNote = String(request.body.adminNote ?? '').trim()

  if (!Number.isInteger(returnRequestId) || returnRequestId <= 0) {
    response.status(400).json({ message: 'ReturnRequestId không hợp lệ.' })
    return
  }

  try {
    const result = await updateReturnRequestStatus({
      returnRequestId,
      status,
      refundStatus,
      refundAmount: Number.isNaN(refundAmount) ? null : refundAmount,
      deliveryStaffId: deliveryStaffId && deliveryStaffId > 0 ? deliveryStaffId : null,
      adminNote,
      moderatorId: request.user!.userId,
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

export async function confirmWarehouseStockIn(request: AuthRequest, response: Response, next: NextFunction) {
  const returnRequestId = Number(request.params.returnRequestId)
  if (!Number.isInteger(returnRequestId) || returnRequestId <= 0) {
    response.status(400).json({ message: 'ReturnRequestId không hợp lệ.' })
    return
  }

  try {
    const result = await confirmWarehouseReturnStockIn(returnRequestId, request.user!.userId)
    response.json({ data: result })
  } catch (error) {
    if (error instanceof Error) {
      response.status(400).json({ message: error.message })
      return
    }
    next(error)
  }
}
