import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  completeDelivery,
  failDelivery,
  listMyShipments,
  requestReturn,
  rescheduleDelivery,
  retryDelivery,
} from '../controllers/shipperController.js'

export const shipperRouter = Router()

shipperRouter.use(requireAuth, requireRoles(['DeliveryStaff', 'SystemAdmin']))

shipperRouter.get('/shipments', listMyShipments)
shipperRouter.post('/shipments/:shipmentId/delivered', completeDelivery)
shipperRouter.post('/shipments/:shipmentId/failed', failDelivery)
shipperRouter.post('/shipments/:shipmentId/reschedule', rescheduleDelivery)
shipperRouter.post('/shipments/:shipmentId/retry', retryDelivery)
shipperRouter.post('/shipments/:shipmentId/request-return', requestReturn)
