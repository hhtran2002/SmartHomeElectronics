import { Router } from 'express'
import { requireAuth } from '../auth.js'
import {
  createAddress,
  deleteAddress,
  getCustomerOrder,
  getProfile,
  listAddresses,
  listCustomerOrders,
  listMyReturnRequests,
  listMyReviews,
  submitReturnRequest,
  submitReview,
  updateAddress,
  updatePassword,
  updateProfile,
} from '../controllers/customerProfileController.js'

export const customerProfileRouter = Router()

customerProfileRouter.use(requireAuth)

customerProfileRouter.get('/orders', listCustomerOrders)
customerProfileRouter.get('/orders/:orderId', getCustomerOrder)
customerProfileRouter.get('/', getProfile)
customerProfileRouter.put('/', updateProfile)
customerProfileRouter.put('/password', updatePassword)
customerProfileRouter.get('/addresses', listAddresses)
customerProfileRouter.post('/addresses', createAddress)
customerProfileRouter.put('/addresses/:addressId', updateAddress)
customerProfileRouter.delete('/addresses/:addressId', deleteAddress)
customerProfileRouter.post('/reviews', submitReview)
customerProfileRouter.get('/reviews/my', listMyReviews)
customerProfileRouter.post('/returns', submitReturnRequest)
customerProfileRouter.get('/returns', listMyReturnRequests)

