import { useEffect, useState } from 'react'
import { deleteCart, deleteCartItem, getCart, mergeCart, setCartItem } from '../api'
import { addProductToCart, countCartItems, loadCart, saveCart } from '../cart'
import type { CartItem, Product } from '../types'

export function useCart(token: string) {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadCart())

  useEffect(() => {
    if (!token) {
      setCartItems(loadCart())
      return
    }

    const guestItems = loadCart()
    const request = guestItems.length > 0
      ? mergeCart(guestItems.map(({ skuId, quantity }) => ({ skuId, quantity })), token)
      : getCart(token)
    void request.then(({ data }) => {
      setCartItems(data)
      saveCart([])
    }).catch(() => undefined)
  }, [token])

  useEffect(() => {
    if (!token) saveCart(cartItems)
  }, [cartItems, token])

  function addToCart(product: Product) {
    setCartItems((currentItems) => {
      const next = addProductToCart(currentItems, product)
      const changed = next.find((item) => item.skuId === product.skuId)
      if (token && changed) void setCartItem(changed.skuId, changed.quantity, token).catch(() => void refreshCart())
      return next
    })
  }

  function clearCart() {
    setCartItems([])
    if (token) void deleteCart(token).catch(() => void refreshCart())
  }

  function removeItem(skuId: number) {
    setCartItems((items) => items.filter((item) => item.skuId !== skuId))
    if (token) void deleteCartItem(skuId, token).catch(() => void refreshCart())
  }

  function removeItems(skuIds: number[]) {
    const selected = new Set(skuIds)
    setCartItems((items) => items.filter((item) => !selected.has(item.skuId)))
    if (token) void refreshCart()
  }

  function updateQuantity(skuId: number, quantity: number) {
    if (quantity <= 0) {
      removeItem(skuId)
      return
    }
    let nextQuantity = quantity
    setCartItems((currentItems) => currentItems.map((item) => {
      if (item.skuId !== skuId) return item
      nextQuantity = Math.min(quantity, item.availableQuantity)
      return { ...item, quantity: nextQuantity }
    }))
    if (token) void setCartItem(skuId, nextQuantity, token).catch(() => void refreshCart())
  }

  async function refreshCart() {
    if (!token) return
    const { data } = await getCart(token)
    setCartItems(data)
  }

  return {
    cartCount: countCartItems(cartItems), cartItems, addToCart, clearCart,
    removeItem, removeItems, setCartItems, updateQuantity, refreshCart,
  }
}
