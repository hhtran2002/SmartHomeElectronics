import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  completeShipperDelivery,
  failShipperDelivery,
  getShipperShipments,
  requestShipperReturn,
  rescheduleShipperDelivery,
  retryShipperDelivery,
} from '../api'
import type { ShipperShipment, ShipperShipmentStatus } from '../types'
import { formatPrice } from '../utils'

type Props = { roles: string[]; token: string }
type ActionForm = { reason: string; estimatedDeliveryAt: string; note: string }

const statusLabels: Record<ShipperShipmentStatus, string> = {
  Pending: 'Chờ phân công', Picking: 'Chờ nhận tại kho', Shipping: 'Đang giao', Delivered: 'Đã giao',
  Failed: 'Giao thất bại', Rescheduled: 'Đã hẹn giao lại', ReturnPending: 'Chờ trả kho', Cancelled: 'Đã trả/hủy',
}

export function ShipperPage({ roles, token }: Props) {
  const [shipments, setShipments] = useState<ShipperShipment[]>([])
  const [forms, setForms] = useState<Record<number, ActionForm>>({})
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const allowed = roles.includes('DeliveryStaff') || roles.includes('SystemAdmin')

  const loadShipments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await getShipperShipments(token)
      setShipments(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được chuyến giao hàng.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { if (token && allowed) void loadShipments() }, [allowed, loadShipments, token])

  const groups = useMemo(() => ({
    waiting: shipments.filter((item) => item.shippingStatus === 'Picking'),
    active: shipments.filter((item) => ['Shipping', 'Failed', 'Rescheduled', 'ReturnPending'].includes(item.shippingStatus)),
    history: shipments.filter((item) => ['Delivered', 'Cancelled'].includes(item.shippingStatus)),
  }), [shipments])

  function formFor(shipmentId: number) {
    return forms[shipmentId] ?? { reason: '', estimatedDeliveryAt: '', note: '' }
  }

  function patchForm(shipmentId: number, patch: Partial<ActionForm>) {
    setForms((current) => ({ ...current, [shipmentId]: { ...formFor(shipmentId), ...patch } }))
  }

  async function run(shipmentId: number, action: () => Promise<unknown>, success: string) {
    setWorkingId(shipmentId)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
      await loadShipments()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không cập nhật được chuyến giao.')
    } finally {
      setWorkingId(null)
    }
  }

  function shipmentCard(shipment: ShipperShipment) {
    const form = formFor(shipment.shipmentId)
    return (
      <article className="shipper-card" key={shipment.shipmentId}>
        <header>
          <div><span className={`delivery-status ${shipment.shippingStatus.toLowerCase()}`}>{statusLabels[shipment.shippingStatus]}</span><h3>{shipment.orderCode}</h3><small>{shipment.trackingCode}</small></div>
          <strong>{formatPrice(shipment.totalAmount)}</strong>
        </header>
        <div className="shipper-destination">
          <strong>{shipment.receiverName}</strong>
          <a href={`tel:${shipment.receiverPhone}`}>{shipment.receiverPhone}</a>
          <p>{shipment.shippingAddress}</p>
        </div>
        <div className="shipper-meta">
          <span><small>Phương tiện</small><strong>{shipment.vehicleCode || 'Chưa gán'}{shipment.licensePlate ? ` · ${shipment.licensePlate}` : ''}</strong></span>
          <span><small>Thanh toán</small><strong>{shipment.paymentMethodName}</strong></span>
          <span><small>Cần thu COD</small><strong>{formatPrice(shipment.codAmount)}</strong></span>
        </div>
        <div className="shipper-items">
          {shipment.items.map((item) => <div key={item.orderDetailId}><span><strong>{item.productName}</strong><small>SKU {item.skuCode}</small></span><strong>× {item.quantity}</strong></div>)}
        </div>
        {shipment.note && <p className="shipment-note">{shipment.note}</p>}

        {shipment.shippingStatus === 'Shipping' && (
          <div className="shipper-action-panel">
            <button className="success-action" disabled={workingId === shipment.shipmentId} onClick={() => {
              if (window.confirm(shipment.codAmount > 0 ? `Xác nhận đã giao và đã thu ${formatPrice(shipment.codAmount)}?` : 'Xác nhận khách đã nhận hàng?')) {
                void run(shipment.shipmentId, () => completeShipperDelivery(shipment.shipmentId, token), `Đã hoàn thành đơn ${shipment.orderCode}.`)
              }
            }} type="button">Đã giao thành công</button>
            <label>Lý do nếu giao thất bại<input value={form.reason} onChange={(event) => patchForm(shipment.shipmentId, { reason: event.target.value })} placeholder="Khách không nghe máy..." /></label>
            <button className="danger-action" disabled={workingId === shipment.shipmentId || !form.reason.trim()} onClick={() => void run(shipment.shipmentId, () => failShipperDelivery(shipment.shipmentId, form.reason, token), 'Đã ghi nhận giao không thành công.')} type="button">Giao không thành công</button>
          </div>
        )}

        {['Failed', 'Rescheduled'].includes(shipment.shippingStatus) && (
          <div className="shipper-action-panel retry-panel">
            <button disabled={workingId === shipment.shipmentId} onClick={() => void run(shipment.shipmentId, () => retryShipperDelivery(shipment.shipmentId, token), 'Đã bắt đầu giao lại.')} type="button">Bắt đầu giao lại</button>
            {shipment.shippingStatus === 'Failed' && <>
              <label>Thời gian hẹn lại<input type="datetime-local" value={form.estimatedDeliveryAt} onChange={(event) => patchForm(shipment.shipmentId, { estimatedDeliveryAt: event.target.value })} /></label>
              <label>Ghi chú hẹn lại<input value={form.note} onChange={(event) => patchForm(shipment.shipmentId, { note: event.target.value })} /></label>
              <button disabled={workingId === shipment.shipmentId || !form.estimatedDeliveryAt || !form.note.trim()} onClick={() => void run(shipment.shipmentId, () => rescheduleShipperDelivery(shipment.shipmentId, { estimatedDeliveryAt: form.estimatedDeliveryAt, note: form.note }, token), 'Đã lưu lịch giao lại.')} type="button">Lưu lịch giao lại</button>
            </>}
            <label>Lý do trả kho<input value={form.reason} onChange={(event) => patchForm(shipment.shipmentId, { reason: event.target.value })} placeholder="Khách từ chối nhận..." /></label>
            <button className="danger-action" disabled={workingId === shipment.shipmentId || !form.reason.trim()} onClick={() => void run(shipment.shipmentId, () => requestShipperReturn(shipment.shipmentId, form.reason, token), 'Đã gửi yêu cầu trả hàng về kho.')} type="button">Yêu cầu trả về kho</button>
          </div>
        )}
      </article>
    )
  }

  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi vào khu vực shipper.</div>
  if (!allowed) return <div className="status-card error">Tài khoản chưa có quyền DeliveryStaff.</div>

  return (
    <>
      <section className="shipper-heading"><span className="eyebrow">Công việc giao hàng</span><h1>Chuyến giao của tôi</h1><p>Nhận kiện đã được kho bàn giao, giao cho khách và cập nhật đúng kết quả thực tế.</p></section>
      {error && <div className="status-card error">{error}</div>}
      {message && <div className="status-card success">{message}</div>}
      {loading ? <div className="status-card">Đang tải chuyến giao...</div> : <>
        <section className="shipper-group"><div className="shipper-group-title"><h2>Chờ nhận tại kho</h2><span>{groups.waiting.length}</span></div>{groups.waiting.length ? groups.waiting.map(shipmentCard) : <div className="status-card">Không có kiện đang chờ nhận.</div>}</section>
        <section className="shipper-group"><div className="shipper-group-title"><h2>Đang xử lý</h2><span>{groups.active.length}</span></div>{groups.active.length ? groups.active.map(shipmentCard) : <div className="status-card">Không có chuyến đang giao hoặc cần xử lý.</div>}</section>
        <section className="shipper-group"><div className="shipper-group-title"><h2>Lịch sử</h2><span>{groups.history.length}</span></div>{groups.history.length ? groups.history.map(shipmentCard) : <div className="status-card">Chưa có lịch sử giao hàng.</div>}</section>
      </>}
    </>
  )
}
