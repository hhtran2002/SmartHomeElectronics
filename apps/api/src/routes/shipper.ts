import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  cancelCodRemittance,
  completeDelivery,
  confirmReturnPickup,
  failDelivery,
  getMyCodSummary,
  listMyReturnPickups,
  listMyShipments,
  requestReturn,
  rescheduleDelivery,
  retryDelivery,
  submitCodRemittance,
} from '../controllers/shipperController.js'

export const shipperRouter = Router()

shipperRouter.use(requireAuth, requireRoles(['DeliveryStaff', 'SystemAdmin']))

shipperRouter.get('/shipments', listMyShipments)
shipperRouter.get('/returns', listMyReturnPickups)
shipperRouter.post('/returns/:returnRequestId/confirm', confirmReturnPickup)
shipperRouter.get('/cod', getMyCodSummary)
shipperRouter.post('/cod/remittances', submitCodRemittance)
shipperRouter.post('/cod/remittances/:codRemittanceId/cancel', cancelCodRemittance)
shipperRouter.post('/shipments/:shipmentId/delivered', completeDelivery)
shipperRouter.post('/shipments/:shipmentId/failed', failDelivery)
shipperRouter.post('/shipments/:shipmentId/reschedule', rescheduleDelivery)
shipperRouter.post('/shipments/:shipmentId/retry', retryDelivery)
shipperRouter.post('/shipments/:shipmentId/request-return', requestReturn)
