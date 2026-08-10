import type { NextFunction, Response } from 'express'
import type { AuthRequest } from '../auth.js'
import { getUserCart, mergeUserCart, removeUserCartItem, setUserCartItem } from '../services/cartService.js'

function validItem(value: any) {
  const skuId = Number(value?.skuId)
  const quantity = Number(value?.quantity)
  return Number.isInteger(skuId) && skuId > 0 && Number.isInteger(quantity) && quantity > 0 ? { skuId, quantity } : null
}

export async function getCart(request: AuthRequest, response: Response, next: NextFunction) {
  try { response.json({ data: await getUserCart(request.user!.userId) }) } catch (error) { next(error) }
}

export async function putCartItem(request: AuthRequest, response: Response, next: NextFunction) {
  const item = validItem({ skuId: request.params.skuId, quantity: request.body.quantity })
  if (!item) { response.status(400).json({ message: 'Sản phẩm hoặc số lượng không hợp lệ.' }); return }
  try { response.json({ data: await setUserCartItem(request.user!.userId, item) }) }
  catch (error) { response.status(400).json({ message: error instanceof Error ? error.message : 'Không cập nhật được giỏ hàng.' }) }
}

export async function mergeCart(request: AuthRequest, response: Response, next: NextFunction) {
  const items = Array.isArray(request.body.items) ? request.body.items.map(validItem) : []
  if (items.some((item: unknown) => !item)) { response.status(400).json({ message: 'Dữ liệu giỏ hàng không hợp lệ.' }); return }
  try { response.json({ data: await mergeUserCart(request.user!.userId, items) }) } catch (error) { next(error) }
}

export async function deleteCartItem(request: AuthRequest, response: Response, next: NextFunction) {
  const skuId = Number(request.params.skuId)
  if (!Number.isInteger(skuId) || skuId < 1) { response.status(400).json({ message: 'Sản phẩm không hợp lệ.' }); return }
  try { response.json({ data: await removeUserCartItem(request.user!.userId, skuId) }) } catch (error) { next(error) }
}

export async function clearCart(request: AuthRequest, response: Response, next: NextFunction) {
  try { response.json({ data: await removeUserCartItem(request.user!.userId) }) } catch (error) { next(error) }
}
