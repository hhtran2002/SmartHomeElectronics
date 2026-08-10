import { Router } from 'express'
import { requireAuth } from '../auth.js'
import { clearCart, deleteCartItem, getCart, mergeCart, putCartItem } from '../controllers/cartController.js'

export const cartRouter = Router()
cartRouter.use(requireAuth)
cartRouter.get('/', getCart)
cartRouter.post('/merge', mergeCart)
cartRouter.put('/items/:skuId', putCartItem)
cartRouter.delete('/items/:skuId', deleteCartItem)
cartRouter.delete('/', clearCart)
