import { useEffect, useState } from 'react'
import {
  getAdminOrder,
  getAdminOrders,
  updateAdminOrderStatus,
} from '../api'
import type { AdminOrder, AdminOrderDetail } from '../types'
import { formatPrice } from '../utils'

type Props = {
  roles: string[]
  token: string
}

function canManageOrders(roles: string[]) {
  return roles.includes('OrderAdmin') || roles.includes('SystemAdmin')
}

export function AdminOrdersPage({ roles, token }: Props) {
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!token || !canManageOrders(roles)) return

    setLoading(true)
    setError('')
    void getAdminOrders(token)
      .then((ordersPayload) => {
        setOrders(ordersPayload.data)
      })
      .catch((error) => setError(error instanceof Error ? error.message : 'Không tải được danh sách đơn.'))
      .finally(() => setLoading(false))
  }, [roles, token])

  function loadDetail(orderId: number) {
    setError('')
    void getAdminOrder(orderId, token)
      .then((payload) => setDetail(payload.data))
      .catch((error) => setError(error instanceof Error ? error.message : 'Không tải được chi tiết đơn.'))
  }

  async function changeStatus(orderStatusId: number) {
    if (!detail) return

    setUpdating(true)
    setError('')
    try {
      await updateAdminOrderStatus(detail.order.orderId, orderStatusId, token)
      const [ordersPayload, detailPayload] = await Promise.all([
        getAdminOrders(token),
        getAdminOrder(detail.order.orderId, token),
      ])
      setOrders(ordersPayload.data)
      setDetail(detailPayload.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không cập nhật được trạng thái đơn.')
    } finally {
      setUpdating(false)
    }
  }

  if (!token) {
    return <div className="status-card error">Bạn cần đăng nhập trước khi vào quản lý đơn hàng.</div>
  }

  if (!canManageOrders(roles)) {
    return <div className="status-card error">Tài khoản hiện tại chưa có quyền OrderAdmin hoặc SystemAdmin.</div>
  }

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Quản lý bán hàng</span>
          <h2>Xử lý đơn hàng</h2>
          <p>Xem danh sách đơn, kiểm tra chi tiết và cập nhật trạng thái xử lý.</p>
        </div>
      </section>

      {error && <div className="status-card error">{error}</div>}

      <section className="admin-orders-layout">
        <div className="admin-orders-list">
          {loading ? (
            <div className="status-card">Đang tải danh sách đơn...</div>
          ) : orders.length === 0 ? (
            <div className="status-card">Chưa có đơn hàng.</div>
          ) : (
            orders.map((order) => (
              <button
                className={`admin-order-row ${detail?.order.orderId === order.orderId ? 'active' : ''}`}
                key={order.orderId}
                onClick={() => loadDetail(order.orderId)}
              >
                <span>
                  <strong>{order.orderCode}</strong>
                  <small>{order.receiverName} · {order.receiverPhone}</small>
                </span>
                <span>
                  <strong>{formatPrice(order.totalAmount)}</strong>
                  <small>{order.orderStatusName}</small>
                </span>
              </button>
            ))
          )}
        </div>

        <aside className="admin-order-detail">
          {!detail ? (
            <div className="status-card">Chọn một đơn để xem chi tiết.</div>
          ) : (
            <>
              <div className="detail-header">
                <span className="eyebrow">Chi tiết đơn</span>
                <h3>{detail.order.orderCode}</h3>
                <p>{detail.order.receiverName} · {detail.order.receiverPhone}</p>
                <p>{detail.order.shippingAddress}</p>
                <p>{detail.order.paymentMethodName ?? 'Chưa có phương thức thanh toán'} · {detail.order.paymentStatusName}</p>
              </div>

              <label className="status-select">
                Trạng thái đơn
                <select
                  disabled={updating || detail.availableTransitions.length === 0}
                  value={detail.order.orderStatusId}
                  onChange={(event) => void changeStatus(Number(event.target.value))}
                >
                  <option disabled value={detail.order.orderStatusId}>{detail.order.orderStatusName}</option>
                  {detail.availableTransitions.map((status) => (
                    <option disabled={status.code === 'Shipping'} key={status.id} value={status.id}>
                      {status.name}{status.code === 'Shipping' ? ' — kho xác nhận' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <div className="admin-detail-items">
                {detail.items.map((item) => (
                  <div key={item.orderDetailId}>
                    <span>{item.productName}</span>
                    <small>SKU {item.skuCode} · SL {item.quantity}</small>
                    <strong>{formatPrice(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>

              <div className="admin-total">
                <span>Tạm tính</span><strong>{formatPrice(detail.order.subtotalAmount)}</strong>
                <span>Phí giao hàng</span><strong>{formatPrice(detail.order.shippingFee)}</strong>
                <span>Tổng</span><strong>{formatPrice(detail.order.totalAmount)}</strong>
              </div>
            </>
          )}
        </aside>
      </section>
    </>
  )
}
