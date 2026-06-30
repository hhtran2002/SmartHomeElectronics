import { useCallback, useEffect, useState } from 'react'
import { confirmWarehouseOrderExport, getWarehouseReadyOrders } from '../api'
import type { WarehouseReadyOrder } from '../types'

type Props = {
  token: string
  onExported: () => Promise<void>
}

export function WarehouseReadyOrders({ token, onExported }: Props) {
  const [orders, setOrders] = useState<WarehouseReadyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingId, setExportingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await getWarehouseReadyOrders(token)
      setOrders(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được đơn chờ xuất.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  async function confirmExport(order: WarehouseReadyOrder) {
    if (!window.confirm(`Xác nhận hàng của đơn ${order.orderCode} đã rời kho?`)) return

    setExportingId(order.orderId)
    setError('')
    setMessage('')
    try {
      const result = await confirmWarehouseOrderExport(order.orderId, token)
      setMessage(`Đã xuất đơn ${result.data.orderCode} và chuyển sang Đang giao hàng.`)
      await Promise.all([loadOrders(), onExported()])
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Không xác nhận được xuất kho.')
    } finally {
      setExportingId(null)
    }
  }

  return (
    <section className="admin-panel-card warehouse-orders">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Công việc cần xử lý</span>
          <h3>Đơn chờ xuất kho</h3>
          <p>Chỉ hiển thị đơn đã được bộ phận đơn hàng chuyển sang Sẵn sàng giao/xuất kho.</p>
        </div>
        <strong>{orders.length} đơn</strong>
      </div>

      {error && <div className="status-card error">{error}</div>}
      {message && <div className="status-card success">{message}</div>}

      {loading ? (
        <div className="status-card">Đang tải đơn chờ xuất...</div>
      ) : orders.length === 0 ? (
        <div className="status-card">Hiện không có đơn nào chờ kho xử lý.</div>
      ) : (
        <div className="warehouse-order-list">
          {orders.map((order) => (
            <article className="warehouse-order-card" key={order.orderId}>
              <header>
                <div>
                  <strong>{order.orderCode}</strong>
                  <small>{order.receiverName} · {order.receiverPhone}</small>
                  <small>{order.shippingAddress}</small>
                </div>
                <button
                  disabled={exportingId === order.orderId}
                  onClick={() => void confirmExport(order)}
                  type="button"
                >
                  {exportingId === order.orderId ? 'Đang xuất...' : 'Xác nhận xuất kho'}
                </button>
              </header>
              <div className="warehouse-pick-list">
                {order.items.map((item) => (
                  <div key={`${item.orderDetailId}-${item.warehouseId}`}>
                    <span>
                      <strong>{item.productName}</strong>
                      <small>SKU {item.skuCode}</small>
                    </span>
                    <span>
                      <strong>{item.quantityWaiting}</strong>
                      <small>Cần lấy</small>
                    </span>
                    <span>
                      <strong>{item.warehouseName}</strong>
                      <small>Kho lấy hàng</small>
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
