import type { Product } from '../types'
import { formatPrice } from '../utils'

type Props = {
  product: Product
  onAddToCart: (product: Product) => void
  onViewDetail: (slug: string) => void
}

export function ProductCard({ product, onAddToCart, onViewDetail }: Props) {
  const canBuy = Boolean(product.skuId) && product.availableQuantity > 0
  const displayPrice = product.finalPrice ?? product.price ?? product.basePrice
  const originalPrice = product.originalPrice ?? product.price ?? product.basePrice
  const hasPromotion = Boolean(product.promotionId) && displayPrice < originalPrice

  return (
    <article className="product-card">
      <button className="product-card-link" onClick={() => onViewDetail(product.slug)}>
        <div className="product-image">
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span>⌂</span>}
        </div>
        <div className="product-meta">{product.categoryName} · {product.brandName}</div>
        <h3>{product.name}</h3>
        <p>{product.description ?? 'Thiết bị gia dụng thông minh dành cho ngôi nhà hiện đại.'}</p>
      </button>
      <div className="product-bottom">
        <div>
          {hasPromotion && <small className="old-price">{formatPrice(originalPrice)}</small>}
          <strong>{formatPrice(displayPrice)}</strong>
          {hasPromotion && <small className="promotion-label">{product.promotionName}</small>}
          <small>SKU {product.skuCode ?? 'đang cập nhật'} · còn {product.availableQuantity}</small>
        </div>
        <button disabled={!canBuy} onClick={() => onAddToCart(product)}>
          Thêm
        </button>
      </div>
    </article>
  )
}
