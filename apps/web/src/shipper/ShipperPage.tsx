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
type ShipperTab = 'waiting' | 'active' | 'history'

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
  const [activeTab, setActiveTab] = useState<ShipperTab>('active')
  
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
      <article className="shipper-card" key={shipment.shipmentId} style={{ marginBottom: '20px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', background: 'var(--blue-50)' }}>
          <div>
            <span className={`delivery-status ${shipment.shippingStatus.toLowerCase()}`}>{statusLabels[shipment.shippingStatus]}</span>
            <h3 style={{ margin: '8px 0 2px', fontSize: '21px' }}>{shipment.orderCode}</h3>
            <small style={{ color: 'var(--muted)' }}>{shipment.trackingCode}</small>
          </div>
          <strong style={{ color: 'var(--blue-900)', fontSize: '20px' }}>{formatPrice(shipment.totalAmount)}</strong>
        </header>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '16px 18px' }}>
          {/* Cột trái: Destination & Meta */}
          <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="shipper-destination" style={{ padding: 0 }}>
              <strong>{shipment.receiverName}</strong>
              <a href={`tel:${shipment.receiverPhone}`} style={{ color: 'var(--blue-700)', fontWeight: '850', marginTop: '4px', display: 'block' }}>
                {shipment.receiverPhone}
              </a>
              <p style={{ color: 'var(--muted)', margin: '7px 0 0' }}>{shipment.shippingAddress}</p>
            </div>
            
            <div className="shipper-meta" style={{ padding: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <span style={{ background: '#f8fafc', borderRadius: '12px', padding: '10px', display: 'block' }}>
                <small style={{ color: 'var(--muted)', display: 'block' }}>Phương tiện</small>
                <strong style={{ display: 'block', marginTop: '4px' }}>
                  {shipment.vehicleCode || 'Chưa gán'}{shipment.licensePlate ? ` · ${shipment.licensePlate}` : ''}
                </strong>
              </span>
              <span style={{ background: '#f8fafc', borderRadius: '12px', padding: '10px', display: 'block' }}>
                <small style={{ color: 'var(--muted)', display: 'block' }}>Thanh toán</small>
                <strong style={{ display: 'block', marginTop: '4px' }}>{shipment.paymentMethodName}</strong>
              </span>
              <span style={{ background: '#f8fafc', borderRadius: '12px', padding: '10px', display: 'block' }}>
                <small style={{ color: 'var(--muted)', display: 'block' }}>COD cần thu</small>
                <strong style={{ display: 'block', marginTop: '4px', color: shipment.codAmount > 0 ? '#b91c1c' : 'inherit' }}>
                  {formatPrice(shipment.codAmount)}
                </strong>
              </span>
            </div>
          </div>

          {/* Cột phải: Kiện hàng & Ghi chú */}
          <div style={{ flex: '1 1 300px', borderLeft: '1px solid #f1f5f9', paddingLeft: '16px', minWidth: '280px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#475569' }}>Sản phẩm cần giao ({shipment.items.length})</h4>
            <div className="shipper-items" style={{ padding: 0 }}>
              {shipment.items.map((item) => (
                <div key={item.orderDetailId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--blue-50)' }}>
                  <span>
                     <strong style={{ display: 'block', color: '#0f172a' }}>{item.productName}</strong>
                     <small style={{ color: 'var(--muted)', marginTop: '2px', display: 'block' }}>SKU: {item.skuCode}</small>
                  </span>
                  <strong style={{ color: '#0f172a' }}>× {item.quantity}</strong>
                </div>
              ))}
            </div>
            {shipment.note && (
              <p className="shipment-note" style={{ borderRadius: '12px', margin: '12px 0 0', padding: '10px 14px', background: '#fffbeb', color: '#92400e', fontSize: '13px' }}>
                <strong>Lưu ý:</strong> {shipment.note}
              </p>
            )}
          </div>
        </div>

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
      
      {loading ? <div className="status-card">Đang tải chuyến giao...</div> : (
        <>
          {/* Tab Selector Buttons */}
          <div className="mode-tabs" style={{ marginBottom: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', display: 'flex', gap: '8px' }}>
            <button 
              className={activeTab === 'waiting' ? 'active' : ''} 
              type="button" 
              onClick={() => setActiveTab('waiting')}
              style={{ fontSize: '15px', fontWeight: '800', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              📥 Chờ nhận tại kho ({groups.waiting.length})
            </button>
            <button 
              className={activeTab === 'active' ? 'active' : ''} 
              type="button" 
              onClick={() => setActiveTab('active')}
              style={{ fontSize: '15px', fontWeight: '800', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              🚚 Đang xử lý ({groups.active.length})
            </button>
            <button 
              className={activeTab === 'history' ? 'active' : ''} 
              type="button" 
              onClick={() => setActiveTab('history')}
              style={{ fontSize: '15px', fontWeight: '800', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              📜 Lịch sử ({groups.history.length})
            </button>
          </div>

          <div style={{ marginTop: '16px' }}>
            {activeTab === 'waiting' && (
              <section className="shipper-group" style={{ marginTop: 0 }}>
                <div className="shipper-group-title"><h2>Chờ nhận tại kho</h2><span>{groups.waiting.length}</span></div>
                {groups.waiting.length ? groups.waiting.map(shipmentCard) : <div className="status-card">Không có kiện đang chờ nhận.</div>}
              </section>
            )}
            {activeTab === 'active' && (
              <section className="shipper-group" style={{ marginTop: 0 }}>
                <div className="shipper-group-title"><h2>Đang xử lý</h2><span>{groups.active.length}</span></div>
                {groups.active.length ? groups.active.map(shipmentCard) : <div className="status-card">Không có chuyến đang giao hoặc cần xử lý.</div>}
              </section>
            )}
            {activeTab === 'history' && (
              <section className="shipper-group" style={{ marginTop: 0 }}>
                <div className="shipper-group-title"><h2>Lịch sử</h2><span>{groups.history.length}</span></div>
                {groups.history.length ? groups.history.map(shipmentCard) : <div className="status-card">Chưa có lịch sử giao hàng.</div>}
              </section>
            )}
          </div>
        </>
      )}
    </>
  )
}
