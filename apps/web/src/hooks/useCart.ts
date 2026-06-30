import { useEffect, useState } from 'react'
import { addProductToCart, countCartItems, loadCart, saveCart } from '../cart'
import type { CartItem, Product } from '../types'

export function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadCart())

  useEffect(() => {
    saveCart(cartItems)
  }, [cartItems])

  function addToCart(product: Product) {
    setCartItems((currentItems) => addProductToCart(currentItems, product))
  }

  function clearCart() {
    setCartItems([])
  }

  function removeItem(skuId: number) {
    setCartItems((items) => items.filter((item) => item.skuId !== skuId))
  }

  function updateQuantity(skuId: number, quantity: number) {
    setCartItems((currentItems) => {
      if (quantity <= 0) return currentItems.filter((item) => item.skuId !== skuId)

      return currentItems.map((item) => {
        if (item.skuId !== skuId) return item
        return { ...item, quantity: Math.min(quantity, item.availableQuantity) }
      })
    })
  }

  return {
    cartCount: countCartItems(cartItems),
    cartItems,
    addToCart,
    clearCart,
    removeItem,
    setCartItems,
    updateQuantity,
  }
}
