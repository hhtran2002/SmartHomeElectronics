import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  completeShipperDelivery,
  confirmShipperReturnPickup,
  failShipperDelivery,
  getShipperReturnPickups,
  getShipperShipments,
  requestShipperReturn,
  rescheduleShipperDelivery,
  retryShipperDelivery,
} from '../api'
import type { ShipperReturnPickup, ShipperShipment, ShipperShipmentStatus } from '../types'
import { formatPrice } from '../utils'

type Props = { roles: string[]; token: string }
type ActionForm = { reason: string; estimatedDeliveryAt: string; note: string }
type ShipperTab = 'waiting' | 'active' | 'returns' | 'history'

const statusLabels: Record<ShipperShipmentStatus, string> = {
  Pending: 'Chờ phân công', Picking: 'Chờ nhận tại kho', Shipping: 'Đang giao', Delivered: 'Đã giao',
  Failed: 'Giao thất bại', Rescheduled: 'Đã hẹn giao lại', ReturnPending: 'Chờ trả kho', Cancelled: 'Đã trả/hủy',
}

export function ShipperPage({ roles, token }: Props) {
  const [shipments, setShipments] = useState<ShipperShipment[]>([])
  const [returnPickups, setReturnPickups] = useState<ShipperReturnPickup[]>([])
  const [forms, setForms] = useState<Record<number, ActionForm>>({})
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<ShipperTab>('active')
  
  const allowed = roles.includes('DeliveryStaff') || roles.includes('SystemAdmin')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [resShipments, resReturns] = await Promise.all([
        getShipperShipments(token),
        getShipperReturnPickups(token).catch(() => ({ data: [] })),
      ])
      setShipments(resShipments.data)
      setReturnPickups(resReturns.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được chuyến giao hàng.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { if (token && allowed) void loadData() }, [allowed, loadData, token])

  const groups = useMemo(() => ({
    waiting: shipments.filter((item) => item.shippingStatus === 'Picking'),
    active: shipments.filter((item) => ['Shipping', 'Failed', 'Rescheduled', 'ReturnPending'].includes(item.shippingStatus)),
    returns: returnPickups,
    history: shipments.filter((item) => ['Delivered', 'Cancelled'].includes(item.shippingStatus)),
  }), [shipments, returnPickups])

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
      await loadData()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không cập nhật được chuyến giao.')
    } finally {
      setWorkingId(null)
    }
  }

  async function handleConfirmReturnPickup(returnRequestId: number) {
    setWorkingId(returnRequestId)
    setError('')
    setMessage('')
    try {
      await confirmShipperReturnPickup(returnRequestId, token)
      setMessage('✅ Đã xác nhận thu hồi sản phẩm từ khách & giao về kho thành công!')
      await loadData()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Không xác nhận được thu hồi.')
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
            
            <div className="shipper-meta">
              <span>Phương thức: <strong>{shipment.paymentMethodName} ({shipment.paymentMethodCode})</strong></span>
              <span>Cần thu COD: <strong>{formatPrice(shipment.codAmount)}</strong></span>
              <span>Kho lấy: <strong>{shipment.warehouseName}</strong></span>
              {shipment.vehicleCode && <span>Xe: <strong>{shipment.vehicleCode} {shipment.licensePlate ? `(${shipment.licensePlate})` : ''}</strong></span>}
            </div>

            <div className="shipper-items">
              <strong>Danh sách sản phẩm ({shipment.items.length}):</strong>
              <ul>
                {shipment.items.map((it) => (
                  <li key={it.orderDetailId}>{it.productName} ({it.skuCode}) × {it.quantity}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Cột phải: Actions */}
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {shipment.shippingStatus === 'Picking' && (
              <button
                className="shipper-btn primary"
                disabled={workingId === shipment.shipmentId}
                onClick={() => void run(shipment.shipmentId, () => completeShipperDelivery(shipment.shipmentId, token), 'Đã nhận đơn giao tại kho.')}
                type="button"
              >
                🚚 Nhận đơn xuất kho & Bắt đầu giao
              </button>
            )}

            {shipment.shippingStatus === 'Shipping' && (
              <>
                <button
                  className="shipper-btn success"
                  disabled={workingId === shipment.shipmentId}
                  onClick={() => void run(shipment.shipmentId, () => completeShipperDelivery(shipment.shipmentId, token), 'Giao hàng thành công!')}
                  type="button"
                >
                  ✅ Xác nhận đã giao thành công
                </button>

                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    placeholder="Lý do không giao được (bắt buộc)..."
                    value={form.reason}
                    onChange={(e) => patchForm(shipment.shipmentId, { reason: e.target.value })}
                    style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                  <button
                    className="shipper-btn danger"
                    disabled={workingId === shipment.shipmentId || !form.reason.trim()}
                    onClick={() => void run(shipment.shipmentId, () => failShipperDelivery(shipment.shipmentId, form.reason, token), 'Đã báo giao thất bại.')}
                    type="button"
                  >
                    ❌ Giao thất bại
                  </button>
                </div>
              </>
            )}

            {shipment.shippingStatus === 'Failed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  className="shipper-btn primary"
                  disabled={workingId === shipment.shipmentId}
                  onClick={() => void run(shipment.shipmentId, () => retryShipperDelivery(shipment.shipmentId, token), 'Bắt đầu giao lại.')}
                  type="button"
                >
                  🔄 Giao lại lần nữa
                </button>

                <input
                  type="datetime-local"
                  value={form.estimatedDeliveryAt}
                  onChange={(e) => patchForm(shipment.shipmentId, { estimatedDeliveryAt: e.target.value })}
                  style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
                <input
                  placeholder="Ghi chú hẹn giao lại..."
                  value={form.note}
                  onChange={(e) => patchForm(shipment.shipmentId, { note: e.target.value })}
                  style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                />
                <button
                  className="shipper-btn secondary"
                  disabled={workingId === shipment.shipmentId || !form.estimatedDeliveryAt || !form.note.trim()}
                  onClick={() => void run(shipment.shipmentId, () => rescheduleShipperDelivery(shipment.shipmentId, { estimatedDeliveryAt: form.estimatedDeliveryAt, note: form.note }, token), 'Đã hẹn lại lịch giao.')}
                  type="button"
                >
                  📅 Hẹn lịch giao lại
                </button>

                <button
                  className="shipper-btn warning"
                  disabled={workingId === shipment.shipmentId}
                  onClick={() => void run(shipment.shipmentId, () => requestShipperReturn(shipment.shipmentId, 'Shipper yêu cầu trả hàng về kho.', token), 'Đã yêu cầu trả kho.')}
                  type="button"
                >
                  📦 Đề nghị trả hàng về kho
                </button>
              </div>
            )}

            {shipment.shippingStatus === 'Rescheduled' && (
              <button
                className="shipper-btn primary"
                disabled={workingId === shipment.shipmentId}
                onClick={() => void run(shipment.shipmentId, () => retryShipperDelivery(shipment.shipmentId, token), 'Bắt đầu giao đơn hẹn lại.')}
                type="button"
              >
                🚚 Bắt đầu giao đơn hẹn
              </button>
            )}

            {shipment.shippingStatus === 'ReturnPending' && (
              <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '6px', fontSize: '13px' }}>
                Đang chờ Thủ kho nhận lại hàng hoàn.
              </div>
            )}
          </div>
        </div>
      </article>
    )
  }

  if (!allowed) {
    return <div className="status-card error">Bạn không có quyền truy cập màn hình Giao hàng.</div>
  }

  return (
    <>
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Trang Nhân viên Giao vận (Shipper)</span>
          <h2>Nhiệm vụ Giao hàng & Thu hồi sản phẩm</h2>
          <p>Xem danh sách kiện hàng cần giao, hẹn lịch giao lại và các đơn cần thu hồi từ khách hàng.</p>
        </div>
      </div>

      {error && <div className="status-card error" style={{ marginBottom: '14px' }}>{error}</div>}
      {message && <div className="status-card success" style={{ marginBottom: '14px' }}>{message}</div>}

      {loading ? <div className="status-card">Đang tải chuyến giao...</div> : (
        <>
          {/* Tab Selector Buttons */}
          <div className="mode-tabs" style={{ marginBottom: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button 
              className={activeTab === 'waiting' ? 'active' : ''} 
              type="button" 
              onClick={() => setActiveTab('waiting')}
              style={{ fontSize: '14px', fontWeight: '800', padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              📥 Chờ nhận tại kho ({groups.waiting.length})
            </button>
            <button 
              className={activeTab === 'active' ? 'active' : ''} 
              type="button" 
              onClick={() => setActiveTab('active')}
              style={{ fontSize: '14px', fontWeight: '800', padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              🚚 Đang giao ({groups.active.length})
            </button>
            <button 
              className={activeTab === 'returns' ? 'active' : ''} 
              type="button" 
              onClick={() => setActiveTab('returns')}
              style={{ fontSize: '14px', fontWeight: '800', padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: activeTab === 'returns' ? '#e0f2fe' : undefined, color: '#0284c7' }}
            >
              🔄 Thu hồi hàng hoàn ({groups.returns.length})
            </button>
            <button 
              className={activeTab === 'history' ? 'active' : ''} 
              type="button" 
              onClick={() => setActiveTab('history')}
              style={{ fontSize: '14px', fontWeight: '800', padding: '10px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
                <div className="shipper-group-title"><h2>Đang giao</h2><span>{groups.active.length}</span></div>
                {groups.active.length ? groups.active.map(shipmentCard) : <div className="status-card">Không có chuyến đang giao hoặc cần xử lý.</div>}
              </section>
            )}

            {activeTab === 'returns' && (
              <section className="shipper-group" style={{ marginTop: 0 }}>
                <div className="shipper-group-title"><h2>Lệnh Thu Hồi Sản Phẩm Lỗi từ Khách</h2><span>{groups.returns.length}</span></div>
                {!groups.returns.length ? (
                  <div className="status-card">Hiện tại bạn chưa được phân công đơn thu hồi hàng nào.</div>
                ) : (
                  groups.returns.map((ret) => (
                    <article className="shipper-card" key={ret.returnRequestId} style={{ marginBottom: '20px', border: '1px solid #bae6fd', background: '#f0f9ff' }}>
                      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', background: '#e0f2fe' }}>
                        <div>
                          <span className="delivery-status shipping">🔄 Nhiệm vụ thu hồi</span>
                          <h3 style={{ margin: '8px 0 2px', fontSize: '20px', color: '#0369a1' }}>
                            Đơn hàng #{ret.orderCode}
                          </h3>
                          <small style={{ color: '#64748b' }}>Ngày tạo khiếu nại: {new Date(ret.createdAt).toLocaleString('vi-VN')}</small>
                        </div>
                        <strong style={{ color: '#0369a1', fontSize: '18px' }}>{formatPrice(ret.totalAmount)}</strong>
                      </header>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '16px 18px' }}>
                        <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div className="shipper-destination" style={{ padding: 0 }}>
                            <strong style={{ fontSize: '16px' }}>👤 Khách hàng: {ret.customerName}</strong>
                            <a href={`tel:${ret.phone}`} style={{ color: '#0284c7', fontWeight: '800', marginTop: '4px', display: 'block', fontSize: '15px' }}>
                              📞 Gọi điện: {ret.phone}
                            </a>
                            <p style={{ color: '#334155', margin: '7px 0 0', fontSize: '14px', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                              📍 <strong>Địa chỉ đến lấy hàng:</strong> {ret.shippingAddress}
                            </p>
                          </div>

                          <div style={{ background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                            <div><strong>Lý do lỗi:</strong> <span style={{ color: '#dc2626', fontWeight: '700' }}>{ret.reason}</span></div>
                            {ret.note && <div style={{ marginTop: '4px', color: '#475569' }}><strong>Mô tả lỗi:</strong> {ret.note}</div>}
                            {ret.evidenceUrl && (
                              <div style={{ marginTop: '6px' }}>
                                <a href={ret.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: '#0284c7', fontWeight: '700' }}>
                                  📷 Xem clip / ảnh minh chứng lỗi 🔗
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
                          {ret.warehouseConfirmedAt ? (
                            <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: '10px', fontWeight: '700', fontSize: '14px' }}>
                              ✅ Đã lấy hàng & bàn giao cho kho thành công ({new Date(ret.warehouseConfirmedAt).toLocaleTimeString('vi-VN')})
                            </div>
                          ) : (
                            <button
                              className="shipper-btn success"
                              style={{ padding: '14px', fontSize: '14px', fontWeight: '800' }}
                              disabled={workingId === ret.returnRequestId}
                              onClick={() => void handleConfirmReturnPickup(ret.returnRequestId)}
                              type="button"
                            >
                              📦 Bấm xác nhận đã lấy hàng lỗi từ khách & giao về kho
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                )}
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
