import { useCallback, useEffect, useState } from 'react'
import { getCustomerOrder, getCustomerOrders } from '../api'
import type { CustomerOrder, CustomerOrderDetail } from '../types'
import { formatPrice } from '../utils'

export function CustomerOrdersPanel({ token }: { token: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [detail, setDetail] = useState<CustomerOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await getCustomerOrders(token)
      setOrders(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được đơn hàng.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void loadOrders() }, [loadOrders])

  async function viewOrder(orderId: number) {
    setError('')
    try {
      const payload = await getCustomerOrder(orderId, token)
      setDetail(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được chi tiết đơn.')
    }
  }

  if (loading) return <div className="status-card">Đang tải đơn hàng...</div>

  return (
    <section className="customer-orders-panel">
      {error && <div className="status-card error">{error}</div>}
      {!orders.length ? (
        <div className="status-card"><h3>Bạn chưa có đơn hàng</h3><a href="#/products">Bắt đầu mua sắm</a></div>
      ) : (
        <div className="customer-orders-layout">
          <div className="customer-order-list">
            {orders.map((order) => (
              <button className={detail?.order.orderId === order.orderId ? 'active' : ''} key={order.orderId} onClick={() => void viewOrder(order.orderId)} type="button">
                <span><strong>{order.orderCode}</strong><small>{new Date(order.createdAt).toLocaleString('vi-VN')}</small></span>
                <span><strong>{formatPrice(order.totalAmount)}</strong><small>{order.totalQuantity} sản phẩm</small></span>
                <span className={`order-status ${order.orderStatusCode.toLowerCase()}`}>{order.orderStatusName}</span>
              </button>
            ))}
          </div>
          <aside className="customer-order-detail">
            {!detail ? <div className="status-card">Chọn một đơn để xem sản phẩm đã mua.</div> : (
              <>
                <header><span className="eyebrow">Chi tiết đơn</span><h3>{detail.order.orderCode}</h3><p>{detail.order.orderStatusName} · {detail.order.paymentStatusName}</p></header>
                <p><strong>Nhận hàng:</strong> {detail.order.receiverName} · {detail.order.receiverPhone}</p>
                <p><strong>Địa chỉ:</strong> {detail.order.shippingAddress}</p>
                <div className="customer-order-items">
                  {detail.items.map((item) => (
                    <article key={item.orderDetailId}>
                      {item.imageUrl ? <img alt={item.productName} src={item.imageUrl} /> : <div className="order-image-placeholder">AA</div>}
                      <span><strong>{item.productName}</strong><small>SKU {item.skuCode} · SL {item.quantity}</small></span>
                      <strong>{formatPrice(item.lineTotal)}</strong>
                    </article>
                  ))}
                </div>
                <div className="customer-order-total">
                  <span>Tạm tính</span><strong>{formatPrice(detail.order.subtotalAmount)}</strong>
                  <span>Phí giao hàng</span><strong>{formatPrice(detail.order.shippingFee)}</strong>
                  <span>Tổng thanh toán</span><strong>{formatPrice(detail.order.totalAmount)}</strong>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
