import { useEffect, useState } from 'react'
import {
  confirmWarehouseReturnStockIn,
  getAdminReturnRequests,
  getWarehouseDeliveryOptions,
  updateAdminReturnRequestStatus,
} from '../api'
import type { AdminReturnRequest, DeliveryStaffOption } from '../types'
import { formatPrice } from '../utils'

type Props = {
  roles: string[]
  token: string
}

export function AdminReturnsPage({ roles, token }: Props) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState<AdminReturnRequest[]>([])
  const [deliveryStaffOptions, setDeliveryStaffOptions] = useState<DeliveryStaffOption[]>([])
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [actionStatus, setActionStatus] = useState<'Approved' | 'Rejected' | null>(null)
  const [refundStatus, setRefundStatus] = useState<'Pending' | 'Processing' | 'Refunded' | 'Failed'>('Processing')
  const [refundAmount, setRefundAmount] = useState<number>(0)
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const canModerate = roles.some((r) => ['SystemAdmin', 'OrderAdmin', 'CustomerSupport', 'WarehouseStaff'].includes(r))
  const isWarehouse = roles.some((r) => ['WarehouseStaff', 'SystemAdmin'].includes(r))

  async function loadData() {
    if (!token || !canModerate) return
    setLoading(true)
    setError('')
    try {
      const [resRequests, resOptions] = await Promise.all([
        getAdminReturnRequests(token),
        getWarehouseDeliveryOptions(token).catch(() => ({ data: { deliveryStaff: [] } })),
      ])
      setRequests(resRequests.data)
      setDeliveryStaffOptions(resOptions.data.deliveryStaff || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách khiếu nại hoàn hàng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canModerate])

  async function handleConfirmStatus() {
    if (!processingId || !actionStatus) return
    setSaving(true)
    setError('')
    try {
      await updateAdminReturnRequestStatus(
        processingId,
        {
          status: actionStatus,
          refundStatus: actionStatus === 'Approved' ? refundStatus : 'Pending',
          refundAmount: refundAmount > 0 ? refundAmount : undefined,
          deliveryStaffId: selectedStaffId,
          adminNote: adminNote.trim(),
        },
        token
      )
      setProcessingId(null)
      setActionStatus(null)
      setAdminNote('')
      setSelectedStaffId(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái hoàn hàng.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmStockIn(returnRequestId: number) {
    setSaving(true)
    setError('')
    try {
      await confirmWarehouseReturnStockIn(returnRequestId, token)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xác nhận nhập kho được.')
    } finally {
      setSaving(false)
    }
  }

  if (!canModerate) {
    return <div className="status-card error">Bạn không có quyền quản lý yêu cầu hoàn hàng.</div>
  }

  return (
    <section>
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Quản trị CSKH, Giao nhận & Kho hàng</span>
          <h2>Duyệt khiếu nại hoàn hàng & Thu hồi sản phẩm</h2>
          <p>Phân công Shipper thu hồi sản phẩm lỗi, Thủ kho xác nhận nhập kho và Kế toán hoàn tiền cho khách.</p>
        </div>
      </div>

      {error && <div className="status-card error">{error}</div>}

      <div className="admin-panel-card">
        <div className="admin-detail-items">
          {loading ? (
            <p>Đang tải danh sách khiếu nại...</p>
          ) : requests.length === 0 ? (
            <p className="empty-hint">Chưa có yêu cầu hoàn hàng nào.</p>
          ) : requests.map((item) => (
            <article className="review-moderation-row" key={item.returnRequestId} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>
                    Đơn hàng #{item.orderCode}{' '}
                    <a
                      href={`/#/admin/orders`}
                      style={{ fontSize: '12px', color: '#0284c7', textDecoration: 'none', marginLeft: '8px', fontWeight: 'normal' }}
                    >
                      🔗 Xem chi tiết đơn
                    </a>
                  </strong>
                  <small style={{ display: 'block', marginTop: '4px', color: '#64748b' }}>
                    Khách hàng: <strong>{item.customerName}</strong> ({item.phone || item.email || 'N/A'}) · Giá trị đơn: <strong>{formatPrice(item.totalAmount)}</strong>
                  </small>
                  <p style={{ marginTop: '8px', fontSize: '14px', margin: '8px 0 4px' }}>
                    <strong>Lý do:</strong> {item.reason}
                  </p>
                  {item.note && (
                    <p style={{ fontSize: '13px', color: '#475569', margin: '2px 0' }}>
                      <strong>Mô tả lỗi:</strong> {item.note}
                    </p>
                  )}
                  {item.evidenceUrl && (
                    <div style={{ marginTop: '6px' }}>
                      <a
                        href={item.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '12px', fontWeight: '700', color: '#0284c7',
                          background: '#e0f2fe', padding: '4px 10px', borderRadius: '6px',
                          textDecoration: 'none', border: '1px solid #bae6fd',
                        }}
                      >
                        📷 Xem clip / ảnh minh chứng lỗi 🔗
                      </a>
                    </div>
                  )}

                  {/* 3-Stage Progress Box */}
                  <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    <div>
                      <strong>1. Shipper thu hồi:</strong>{' '}
                      {item.deliveryStaffName ? (
                        <span style={{ color: '#0284c7', fontWeight: '700' }}>
                          🚚 Shipper {item.deliveryStaffName} ({item.deliveryStaffPhone || 'N/A'})
                        </span>
                      ) : (
                        <span style={{ color: '#ea580c', fontWeight: '600' }}>⏳ Chưa phân công Shipper lấy hàng</span>
                      )}
                    </div>

                    <div>
                      <strong>2. Nhập kho hàng hoàn:</strong>{' '}
                      {item.warehouseConfirmedAt ? (
                        <span style={{ color: '#16a34a', fontWeight: '700' }}>
                          ✅ Thủ kho {item.warehouseConfirmedByName || ''} đã xác nhận nhập kho ({new Date(item.warehouseConfirmedAt).toLocaleString('vi-VN')})
                        </span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: '600' }}>
                          ⏳ Chưa nhập kho (Đang chờ thu hồi)
                        </span>
                      )}
                    </div>

                    <div>
                      <strong>3. Chuyển khoản hoàn tiền:</strong>{' '}
                      <span style={{ fontWeight: '700', color: item.refundStatus === 'Refunded' ? '#16a34a' : '#ca8a04' }}>
                        {item.refundStatus === 'Refunded' ? '✅ Đã chuyển khoản hoàn tiền thành công' : '⏳ Chờ hoàn tiền'}
                      </span>
                    </div>

                    <div style={{ marginTop: '4px', color: '#334155', background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      🏦 STK nhận tiền: <strong>{item.bankName || 'N/A'}</strong> | STK: <strong>{item.bankAccountNumber || 'N/A'}</strong> | Chủ TK: <strong>{item.bankAccountName || 'N/A'}</strong>
                    </div>
                  </div>

                  {item.adminNote && (
                    <p style={{ marginTop: '8px', fontSize: '12px', color: '#0284c7', background: '#f0f9ff', padding: '6px 10px', borderRadius: '6px' }}>
                      <strong>Ghi chú CSKH/Kho:</strong> {item.adminNote}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span className={`status-pill ${item.status.toLowerCase()}`}>
                    {item.status === 'Approved' ? '✅ Đã chấp nhận' : item.status === 'Rejected' ? '❌ Từ chối' : '⏳ Chờ duyệt'}
                  </span>
                  <small style={{ color: '#94a3b8', fontSize: '11px' }}>
                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </small>
                  
                  <div className="row-actions" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', alignItems: 'flex-end' }}>
                    {item.status === 'Approved' && !item.warehouseConfirmedAt && isWarehouse && (
                      <button
                        style={{ background: '#0284c7', color: '#fff', border: 0, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        disabled={saving}
                        onClick={() => void handleConfirmStockIn(item.returnRequestId)}
                      >
                        📦 Thủ kho: Xác nhận đã nhập kho
                      </button>
                    )}

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        style={{ background: '#16a34a', color: '#fff', border: 0, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                        onClick={() => {
                          setProcessingId(item.returnRequestId)
                          setActionStatus('Approved')
                          setRefundStatus(item.refundStatus || 'Processing')
                          setRefundAmount(item.refundAmount || item.totalAmount)
                          setSelectedStaffId(item.deliveryStaffId || null)
                          setAdminNote(item.adminNote || '')
                        }}
                      >
                        {item.status === 'Approved' ? '⚙️ Cập nhật xử lý' : 'Đồng ý thu hồi'}
                      </button>
                      <button
                        style={{ background: '#dc2626', color: '#fff', border: 0, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                        onClick={() => {
                          setProcessingId(item.returnRequestId)
                          setActionStatus('Rejected')
                          setAdminNote(item.adminNote || '')
                        }}
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action input box */}
              {processingId === item.returnRequestId && (
                <div style={{ background: actionStatus === 'Approved' ? '#f0fdf4' : '#fef2f2', padding: '14px 16px', borderRadius: '12px', border: `1px solid ${actionStatus === 'Approved' ? '#bbf7d0' : '#fecaca'}` }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: actionStatus === 'Approved' ? '#15803d' : '#991b1b' }}>
                    Xác nhận {actionStatus === 'Approved' ? 'ĐỒNG Ý THU HỒI' : 'TỪ CHỐI'} yêu cầu hoàn hàng #{item.orderCode}:
                  </span>

                  {actionStatus === 'Approved' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '10px 0' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>1. Chọn Shipper đến nhà khách lấy sản phẩm lỗi</label>
                        <select
                          value={selectedStaffId || ''}
                          onChange={(e) => setSelectedStaffId(e.target.value ? Number(e.target.value) : null)}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px' }}
                        >
                          <option value="">-- Chọn Shipper thu hồi --</option>
                          {deliveryStaffOptions.map((staff) => (
                            <option key={staff.userId} value={staff.userId}>
                              🚚 Shipper: {staff.fullName} ({staff.phone})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>2. Trạng thái chuyển khoản hoàn tiền</label>
                          <select
                            value={refundStatus}
                            onChange={(e) => setRefundStatus(e.target.value as any)}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px' }}
                          >
                            <option value="Processing">🔄 Đang thu hồi sản phẩm</option>
                            <option value="Refunded" disabled={!item.warehouseConfirmedAt}>
                              {!item.warehouseConfirmedAt ? '❌ [Chưa thể chọn] Chờ Thủ kho nhận hàng về kho' : '✅ Đã chuyển khoản hoàn tiền xong'}
                            </option>
                            <option value="Pending">⏳ Chờ xử lý</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>Số tiền hoàn (VNĐ)</label>
                          <input
                            type="number"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(Number(e.target.value))}
                            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <textarea
                    rows={2}
                    placeholder="Nhập lời nhắn gửi cho khách hàng (lý do từ chối hoặc hướng dẫn trả hàng)..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    style={{ width: '100%', marginTop: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      disabled={saving}
                      onClick={() => void handleConfirmStatus()}
                      style={{
                        padding: '8px 20px', border: 0, borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: '#fff',
                        background: actionStatus === 'Approved' ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {saving ? 'Đang lưu...' : 'Xác nhận xử lý'}
                    </button>
                    <button
                      onClick={() => { setProcessingId(null); setActionStatus(null) }}
                      style={{ padding: '8px 14px', background: '#e2e8f0', color: '#475569', border: 0, borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
