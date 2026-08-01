import { Router } from 'express'
import { requireAuth, requireRoles } from '../auth.js'
import {
  assignDelivery,
  changeVehicleStatus,
  confirmReturnedDelivery,
  createVehicle,
  handOverDelivery,
  listDeliveryOptions,
  listPendingReturns,
} from '../controllers/warehouseDeliveryController.js'

export const warehouseDeliveriesRouter = Router()

warehouseDeliveriesRouter.use(requireAuth, requireRoles(['WarehouseStaff', 'SystemAdmin']))

warehouseDeliveriesRouter.get('/options', listDeliveryOptions)
warehouseDeliveriesRouter.post('/vehicles', createVehicle)
warehouseDeliveriesRouter.patch('/vehicles/:vehicleId/status', changeVehicleStatus)
warehouseDeliveriesRouter.post('/orders/:orderId/assign', assignDelivery)
warehouseDeliveriesRouter.post('/orders/:orderId/handover', handOverDelivery)
warehouseDeliveriesRouter.get('/returns', listPendingReturns)
warehouseDeliveriesRouter.post('/shipments/:shipmentId/confirm-return', confirmReturnedDelivery)
