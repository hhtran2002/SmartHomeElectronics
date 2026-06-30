import type { CartItem } from '../types'
import { formatPrice } from '../utils'

type Props = {
  items: CartItem[]
  onBackToProducts: () => void
  onClearCart: () => void
  onGoToCheckout: () => void
  onRemoveItem: (skuId: number) => void
  onUpdateQuantity: (skuId: number, quantity: number) => void
}

export function CartPage({
  items,
  onBackToProducts,
  onClearCart,
  onGoToCheckout,
  onRemoveItem,
  onUpdateQuantity,
}: Props) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shippingFee = subtotal >= 5_000_000 || subtotal === 0 ? 0 : 40_000
  const total = subtotal + shippingFee

  return (
    <main className="cart-page">
      <section className="section-heading">
        <div>
          <span className="eyebrow">Giỏ hàng</span>
          <h2>Kiểm tra SKU trước khi đặt hàng</h2>
          <p>Trang này chỉ quản lý sản phẩm trong giỏ. Thông tin nhận hàng được tách sang trang Checkout riêng.</p>
        </div>
        {items.length > 0 && <button onClick={onClearCart}>Xóa giỏ hàng</button>}
      </section>

      {items.length === 0 ? (
        <div className="status-card cart-empty">
          <span className="empty-icon">🛒</span>
          <h3>Giỏ hàng đang trống</h3>
          <p>Quay lại trang sản phẩm và thêm vài món trước nhé.</p>
          <button onClick={onBackToProducts}>Xem sản phẩm</button>
        </div>
      ) : (
        <section className="cart-layout">
          <div className="cart-list">
            {items.map((item) => (
              <article className="cart-item" key={item.skuId}>
                <div className="cart-item-image">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.productName} /> : <span>⌂</span>}
                </div>
                <div className="cart-item-info">
                  <span>{item.categoryName} · {item.brandName}</span>
                  <h3>{item.productName}</h3>
                  <small>SKU {item.skuCode} · còn {item.availableQuantity}</small>
                  <button onClick={() => onRemoveItem(item.skuId)}>Xóa</button>
                </div>
                <div className="cart-item-actions">
                  {item.originalPrice && item.originalPrice > item.price && (
                    <small className="old-price">{formatPrice(item.originalPrice)}</small>
                  )}
                  <strong>{formatPrice(item.price)}</strong>
                  {item.promotionName && <small className="promotion-label">{item.promotionName}</small>}
                  <div className="quantity-box">
                    <button onClick={() => onUpdateQuantity(item.skuId, item.quantity - 1)}>-</button>
                    <span>{item.quantity}</span>
                    <button
                      disabled={item.quantity >= item.availableQuantity}
                      onClick={() => onUpdateQuantity(item.skuId, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <small>Tạm tính {formatPrice(item.price * item.quantity)}</small>
                </div>
              </article>
            ))}
          </div>

          <aside className="cart-summary">
            <h3>Tóm tắt giỏ hàng</h3>
            <div><span>Số dòng SKU</span><strong>{items.length}</strong></div>
            <div><span>Tổng số lượng</span><strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong></div>
            <div><span>Tạm tính</span><strong>{formatPrice(subtotal)}</strong></div>
            <div><span>Phí giao hàng dự kiến</span><strong>{formatPrice(shippingFee)}</strong></div>
            <div><span>Tổng dự kiến</span><strong>{formatPrice(total)}</strong></div>
            <button onClick={onGoToCheckout}>Tiến tới checkout</button>
          </aside>
        </section>
      )}
    </main>
  )
}
