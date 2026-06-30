import type { CartItem, Product } from './types'

const CART_STORAGE_KEY = 'aa-smart-cart'

export function loadCart(): CartItem[] {
  try {
    const rawCart = localStorage.getItem(CART_STORAGE_KEY)
    if (!rawCart) return []

    const parsedCart = JSON.parse(rawCart)
    if (!Array.isArray(parsedCart)) return []

    const items = parsedCart
      .map((item) => ({
        ...item,
        skuId: Number(item?.skuId),
        price: Number(item?.price),
        availableQuantity: Number(item?.availableQuantity ?? 0),
        quantity: Number(item?.quantity),
      }))
      .filter((item) => Number.isInteger(item.skuId) && item.skuId > 0)
      .filter((item) => Number.isFinite(item.price) && item.price >= 0)
      .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0)
      .map((item) => ({
        ...item,
        quantity: item.availableQuantity > 0 ? Math.min(item.quantity, item.availableQuantity) : item.quantity,
      })) as CartItem[]

    if (items.length !== parsedCart.length) saveCart(items)
    return items
  } catch {
    return []
  }
}

export function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
}

export function makeCartItem(product: Product): CartItem | null {
  if (!product.skuId || !product.skuCode) return null
  const finalPrice = product.finalPrice ?? product.price ?? product.basePrice

  return {
    skuId: product.skuId,
    skuCode: product.skuCode,
    productSlug: product.slug,
    productName: product.name,
    brandName: product.brandName,
    categoryName: product.categoryName,
    imageUrl: product.imageUrl,
    price: finalPrice,
    originalPrice: product.originalPrice ?? product.price ?? product.basePrice,
    promotionName: product.promotionName,
    availableQuantity: product.availableQuantity,
    quantity: 1,
  }
}

export function addProductToCart(items: CartItem[], product: Product): CartItem[] {
  const newItem = makeCartItem(product)
  if (!newItem) return items

  const existedItem = items.find((item) => item.skuId === newItem.skuId)
  if (!existedItem) return [...items, newItem]

  return items.map((item) => {
    if (item.skuId !== newItem.skuId) return item

    return {
      ...item,
      availableQuantity: newItem.availableQuantity,
      price: newItem.price,
      originalPrice: newItem.originalPrice,
      promotionName: newItem.promotionName,
      quantity: Math.min(item.quantity + 1, newItem.availableQuantity),
    }
  })
}

export function countCartItems(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0)
}

export function sumCartTotal(items: CartItem[]) {
  return items.reduce((total, item) => total + item.price * item.quantity, 0)
}
