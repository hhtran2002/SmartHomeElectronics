import type { CartItem } from '../types'
import { formatPrice } from '../utils'
import '../pages/CommerceFlow.css'

type Props = {
  items: CartItem[]
  selectedSkuIds: number[]
  onBackToProducts: () => void
  onClearCart: () => void
  onGoToCheckout: () => void
  onRemoveItem: (skuId: number) => void
  onSelectionChange: (skuIds: number[]) => void
  onUpdateQuantity: (skuId: number, quantity: number) => void
}

export function CartPage({
  items, selectedSkuIds, onBackToProducts, onClearCart, onGoToCheckout,
  onRemoveItem, onSelectionChange, onUpdateQuantity,
}: Props) {
  const selectedSet = new Set(selectedSkuIds)
  const selectedItems = items.filter((item) => selectedSet.has(item.skuId))
  const subtotal = selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shippingFee = subtotal >= 5_000_000 || subtotal === 0 ? 0 : 40_000
  const total = subtotal + shippingFee

  return (
    <main className="cart-page commerce-flow-page">
      <section className="section-heading flow-intro">
        <div>
          <span className="eyebrow">01 — Giỏ hàng</span>
          <h1>Những món<br />bạn đã chọn.</h1>
          <p>Chọn riêng những sản phẩm bạn muốn mua trong lần đặt hàng này.</p>
        </div>
        {items.length > 0 && <button className="flow-text-button" onClick={onClearCart}>Xóa tất cả</button>}
      </section>

      {items.length === 0 ? (
        <div className="status-card cart-empty">
          <h3>Giỏ hàng đang trống</h3>
          <p>Hãy khám phá catalog và chọn những thiết bị phù hợp với ngôi nhà của bạn.</p>
          <button onClick={onBackToProducts}>Khám phá sản phẩm</button>
        </div>
      ) : (
        <section className="cart-layout">
          <div className="cart-list">
            <label className="cart-select-all">
              <input
                type="checkbox"
                checked={selectedItems.length === items.length}
                onChange={(event) => onSelectionChange(event.target.checked ? items.map((item) => item.skuId) : [])}
              />
              Chọn tất cả ({items.length} mặt hàng)
            </label>
            {items.map((item) => (
              <article className={`cart-item ${selectedSet.has(item.skuId) ? 'selected' : ''}`} key={item.skuId}>
                <label className="cart-item-selector" aria-label={`Chọn ${item.productName}`}>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.skuId)}
                    onChange={(event) => onSelectionChange(event.target.checked
                      ? [...selectedSkuIds, item.skuId]
                      : selectedSkuIds.filter((skuId) => skuId !== item.skuId))}
                  />
                </label>
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
                  {item.originalPrice && item.originalPrice > item.price && <small className="old-price">{formatPrice(item.originalPrice)}</small>}
                  <strong>{formatPrice(item.price)}</strong>
                  {item.promotionName && <small className="promotion-label">{item.promotionName}</small>}
                  <div className="quantity-box">
                    <button onClick={() => onUpdateQuantity(item.skuId, item.quantity - 1)}>-</button>
                    <span>{item.quantity}</span>
                    <button disabled={item.quantity >= item.availableQuantity} onClick={() => onUpdateQuantity(item.skuId, item.quantity + 1)}>+</button>
                  </div>
                  <small>Tạm tính {formatPrice(item.price * item.quantity)}</small>
                </div>
              </article>
            ))}
          </div>

          <aside className="cart-summary">
            <span className="summary-kicker">Đơn hàng của bạn</span>
            <h3>Tóm tắt</h3>
            <div><span>Mặt hàng đã chọn</span><strong>{selectedItems.length} / {items.length}</strong></div>
            <div><span>Số lượng đã chọn</span><strong>{selectedItems.reduce((sum, item) => sum + item.quantity, 0)}</strong></div>
            <div><span>Tạm tính</span><strong>{formatPrice(subtotal)}</strong></div>
            <div><span>Phí giao hàng dự kiến</span><strong>{formatPrice(shippingFee)}</strong></div>
            <div><span>Tổng dự kiến</span><strong>{formatPrice(total)}</strong></div>
            <button disabled={selectedItems.length === 0} onClick={onGoToCheckout}>
              {selectedItems.length === 0 ? 'Chọn sản phẩm để mua' : 'Thanh toán sản phẩm đã chọn'}
            </button>
            <p className="form-hint">Các sản phẩm chưa chọn vẫn được giữ trong giỏ hàng.</p>
          </aside>
        </section>
      )}
    </main>
  )
}
