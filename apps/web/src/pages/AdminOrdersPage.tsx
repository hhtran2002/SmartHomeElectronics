import { useEffect, useMemo, useState } from 'react'
import {
  confirmAdminBankPayment,
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

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

export function AdminOrdersPage({ roles, token }: Props) {
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [updating, setUpdating] = useState(false)
  const [page, setPage] = useState(1)
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('All')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const pageSize = 10

  const orderStatusOptions = useMemo(() => [...new Map(
    orders.map((order) => [order.orderStatusCode, order.orderStatusName]),
  ).entries()], [orders])
  const paymentStatusOptions = useMemo(() => [...new Map(
    orders.map((order) => [order.paymentStatusCode, order.paymentStatusName]),
  ).entries()], [orders])

  const filteredOrders = useMemo(() => {
    const query = normalizeSearchText(orderSearch.trim())
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const to = toDate ? new Date(`${toDate}T23:59:59.999`) : null
    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt)
      const matchesSearch = !query || normalizeSearchText([
        order.orderCode,
        order.receiverName,
        order.receiverPhone,
        order.receiverEmail ?? '',
      ].join(' ')).includes(query)
      return matchesSearch
        && (orderStatusFilter === 'All' || order.orderStatusCode === orderStatusFilter)
        && (paymentStatusFilter === 'All' || order.paymentStatusCode === paymentStatusFilter)
        && (!from || createdAt >= from)
        && (!to || createdAt <= to)
    })
  }, [fromDate, orderSearch, orderStatusFilter, orders, paymentStatusFilter, toDate])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredOrders.slice(start, start + pageSize)
  }, [filteredOrders, page])

  useEffect(() => {
    setPage(1)
  }, [fromDate, orderSearch, orderStatusFilter, paymentStatusFilter, toDate])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

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

  async function confirmBankPayment(transactionCode: string) {
    if (!detail || !transactionCode.trim()) return
    setUpdating(true)
    setError('')
    try {
      await confirmAdminBankPayment(detail.order.orderId, transactionCode.trim(), token)
      const [ordersPayload, detailPayload] = await Promise.all([
        getAdminOrders(token), getAdminOrder(detail.order.orderId, token),
      ])
      setOrders(ordersPayload.data)
      setDetail(detailPayload.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không xác nhận được thanh toán.')
    } finally { setUpdating(false) }
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

      <section className="admin-product-filters admin-order-filters" aria-label="Tìm kiếm và lọc đơn hàng">
        <label className="admin-product-search">
          <span>Tìm kiếm</span>
          <input
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder="Mã đơn, tên, SĐT hoặc email..."
            type="search"
            value={orderSearch}
          />
        </label>
        <label>
          <span>Trạng thái đơn</span>
          <select onChange={(event) => setOrderStatusFilter(event.target.value)} value={orderStatusFilter}>
            <option value="All">Tất cả trạng thái</option>
            {orderStatusOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label>
          <span>Thanh toán</span>
          <select onChange={(event) => setPaymentStatusFilter(event.target.value)} value={paymentStatusFilter}>
            <option value="All">Tất cả thanh toán</option>
            {paymentStatusOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label>
          <span>Từ ngày</span>
          <input max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} type="date" value={fromDate} />
        </label>
        <label>
          <span>Đến ngày</span>
          <input min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} type="date" value={toDate} />
        </label>
        <div className="admin-product-filter-result">
          <strong>{filteredOrders.length}</strong>
          <span>/ {orders.length} đơn</span>
          {(orderSearch || orderStatusFilter !== 'All' || paymentStatusFilter !== 'All' || fromDate || toDate) && (
            <button onClick={() => {
              setOrderSearch('')
              setOrderStatusFilter('All')
              setPaymentStatusFilter('All')
              setFromDate('')
              setToDate('')
            }} type="button">Xóa lọc</button>
          )}
        </div>
      </section>

      <section className="admin-orders-layout">
        <div className="admin-orders-list">
          {loading ? (
            <div className="status-card">Đang tải danh sách đơn...</div>
          ) : orders.length === 0 ? (
            <div className="status-card">Chưa có đơn hàng.</div>
          ) : filteredOrders.length === 0 ? (
            <div className="status-card">Không tìm thấy đơn hàng phù hợp với bộ lọc.</div>
          ) : (
            paginatedOrders.map((order) => (
              <button
                className={`admin-order-row ${detail?.order.orderId === order.orderId ? 'active' : ''}`}
                key={order.orderId}
                onClick={() => loadDetail(order.orderId)}
              >
                <span>
                  <strong>{order.orderCode}</strong>
                  <small>{order.receiverName} · {order.receiverPhone}{order.receiverEmail ? ` · ${order.receiverEmail}` : ''}</small>
                </span>
                <span>
                  <strong>{formatPrice(order.totalAmount)}</strong>
                  <small>{order.orderStatusName}</small>
                </span>
              </button>
            ))
          )}
          {!loading && filteredOrders.length > 0 && (
            <div className="admin-pagination" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '16px', alignItems: 'center' }}>
              <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} style={{ padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                Trang trước
              </button>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '750' }}>Trang {page} / {totalPages} · {filteredOrders.length} đơn</span>
              <button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} style={{ padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                Trang sau
              </button>
            </div>
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

              {detail.order.paymentMethodCode === 'BANK_TRANSFER' && detail.order.paymentStatusCode === 'Pending' && (
                <label className="status-select">
                  Trạng thái thanh toán
                  <select
                    disabled={updating}
                    value={detail.order.paymentStatusCode}
                    onChange={(event) => {
                      if (event.target.value !== 'Success') return
                      const transactionCode = window.prompt('Nhập mã giao dịch sau khi đã kiểm tra tiền về tài khoản ngân hàng:')?.trim()
                      if (transactionCode) void confirmBankPayment(transactionCode)
                    }}
                  >
                    <option value="Pending">{detail.order.paymentStatusName}</option>
                    <option value="Success">Đã nhận chuyển khoản</option>
                  </select>
                </label>
              )}

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
