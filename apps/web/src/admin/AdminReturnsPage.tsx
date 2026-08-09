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
    <section style={{ width: '100%', boxSizing: 'border-box' }}>
      <div className="section-heading compact" style={{ marginBottom: '20px' }}>
        <div>
          <span className="eyebrow">Quản trị CSKH, Giao nhận & Kho hàng</span>
          <h2>Duyệt khiếu nại hoàn hàng & Thu hồi sản phẩm</h2>
          <p>Phân công Shipper thu hồi sản phẩm lỗi, Thủ kho xác nhận nhập kho và Kế toán hoàn tiền cho khách.</p>
        </div>
      </div>

      {error && <div className="status-card error" style={{ marginBottom: '16px' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
        {loading ? (
          <div className="admin-panel-card"><p>Đang tải danh sách khiếu nại...</p></div>
        ) : requests.length === 0 ? (
          <div className="admin-panel-card"><p className="empty-hint">Chưa có yêu cầu hoàn hàng nào.</p></div>
        ) : requests.map((item) => (
          <div
            key={item.returnRequestId}
            style={{
              background: '#fff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Header row: Order info & Status Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Đơn hàng #{item.orderCode}
                </span>
                <a
                  href="/#/admin/orders"
                  style={{ fontSize: '13px', color: '#0284c7', textDecoration: 'none', fontWeight: '600', background: '#e0f2fe', padding: '4px 10px', borderRadius: '6px' }}
                >
                  🔗 Xem chi tiết đơn
                </a>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Tạo lúc: {new Date(item.createdAt).toLocaleString('vi-VN')}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '700',
                    background: item.status === 'Approved' ? '#f0fdf4' : item.status === 'Rejected' ? '#fef2f2' : '#fefce8',
                    color: item.status === 'Approved' ? '#16a34a' : item.status === 'Rejected' ? '#dc2626' : '#ca8a04',
                    border: `1px solid ${item.status === 'Approved' ? '#bbf7d0' : item.status === 'Rejected' ? '#fecaca' : '#fef08a'}`,
                  }}
                >
                  {item.status === 'Approved' ? '✅ CSKH Đã chấp nhận' : item.status === 'Rejected' ? '❌ CSKH Từ chối' : '⏳ Chờ CSKH duyệt'}
                </span>
              </div>
            </div>

            {/* Grid 2 Columns Layout for Widescreen */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
              
              {/* LEFT COLUMN: Customer Info, Error Details & Proof, Bank Transfer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Khách hàng khiếu nại:</span>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>{item.customerName} ({item.phone || item.email || 'N/A'})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Giá trị đơn hàng:</span>
                    <strong style={{ fontSize: '15px', color: '#0284c7' }}>{formatPrice(item.totalAmount)}</strong>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', display: 'block' }}>Lý do hoàn hàng:</span>
                    <strong style={{ fontSize: '14px', color: '#dc2626' }}>{item.reason}</strong>
                  </div>
                  {item.note && (
                    <div>
                      <span style={{ fontSize: '13px', color: '#64748b', display: 'block' }}>Mô tả sự cố từ khách:</span>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#334155', background: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        {item.note}
                      </p>
                    </div>
                  )}
                  {item.evidenceUrl && (
                    <div style={{ marginTop: '12px' }}>
                      <a
                        href={item.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          fontSize: '13px', fontWeight: '700', color: '#0284c7',
                          background: '#e0f2fe', padding: '8px 14px', borderRadius: '8px',
                          textDecoration: 'none', border: '1px solid #bae6fd',
                        }}
                      >
                        📷 Xem ảnh / Video minh chứng đính kèm 🔗
                      </a>
                    </div>
                  )}
                </div>

                {/* Bank Account Info */}
                <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0369a1', display: 'block', marginBottom: '8px' }}>
                    🏦 Tài khoản Ngân hàng nhận tiền chuyển khoản hoàn:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '13px', color: '#0f172a' }}>
                    <div>
                      <small style={{ color: '#64748b', display: 'block' }}>Tên Ngân Hàng</small>
                      <strong>{item.bankName || 'N/A'}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#64748b', display: 'block' }}>Số Tài Khoản</small>
                      <strong style={{ fontFamily: 'monospace', fontSize: '14px', color: '#0284c7' }}>{item.bankAccountNumber || 'N/A'}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#64748b', display: 'block' }}>Chủ Tài Khoản</small>
                      <strong style={{ textTransform: 'uppercase' }}>{item.bankAccountName || 'N/A'}</strong>
                    </div>
                  </div>
                </div>

                {item.adminNote && (
                  <div style={{ background: '#fefce8', padding: '12px 16px', borderRadius: '10px', border: '1px solid #fef08a', fontSize: '13px', color: '#854d0e' }}>
                    <strong>Ghi chú phản hồi CSKH/Kho:</strong> {item.adminNote}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: 3-Stage Progress Box & Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Tiến trình thu hồi & hoàn tiền (3 Bước)
                  </span>

                  {/* Stage 1: Shipper Assignment */}
                  <div style={{ background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>1. Thu hồi hàng:</strong></span>
                      {item.deliveryStaffName ? (
                        <span style={{ color: '#0284c7', fontWeight: '700' }}>🚚 Shipper {item.deliveryStaffName} ({item.deliveryStaffPhone || 'N/A'})</span>
                      ) : (
                        <span style={{ color: '#ea580c', fontWeight: '600' }}>⏳ Chưa phân công Shipper</span>
                      )}
                    </div>
                  </div>

                  {/* Stage 2: Warehouse Stock-In */}
                  <div style={{ background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>2. Thủ kho nhập kho:</strong></span>
                      {item.warehouseConfirmedAt ? (
                        <span style={{ color: '#16a34a', fontWeight: '700' }}>✅ Đã nhập kho ({new Date(item.warehouseConfirmedAt).toLocaleTimeString('vi-VN')})</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: '600' }}>⏳ Chưa nhập kho</span>
                      )}
                    </div>
                    {item.status === 'Approved' && !item.warehouseConfirmedAt && isWarehouse && (
                      <button
                        style={{ marginTop: '8px', width: '100%', background: '#0284c7', color: '#fff', border: 0, borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        disabled={saving}
                        onClick={() => void handleConfirmStockIn(item.returnRequestId)}
                      >
                        📦 Thủ kho: Bấm xác nhận đã nhận hàng hoàn về kho
                      </button>
                    )}
                  </div>

                  {/* Stage 3: Refund Status */}
                  <div style={{ background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>3. Chuyển khoản hoàn tiền:</strong></span>
                      <span style={{ fontWeight: '700', color: item.refundStatus === 'Refunded' ? '#16a34a' : '#ca8a04' }}>
                        {item.refundStatus === 'Refunded' ? '✅ Đã hoàn tiền' : '⏳ Chờ hoàn tiền'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    style={{
                      flex: 1, padding: '12px 16px', background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: '#fff', border: 0, borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                    }}
                    onClick={() => {
                      setProcessingId(item.returnRequestId)
                      setActionStatus('Approved')
                      setRefundStatus(item.refundStatus || 'Processing')
                      setRefundAmount(item.refundAmount || item.totalAmount)
                      setSelectedStaffId(item.deliveryStaffId || null)
                      setAdminNote(item.adminNote || '')
                    }}
                  >
                    {item.status === 'Approved' ? '⚙️ Cập nhật phân công & Hoàn tiền' : '✅ Chấp nhận thu hồi hàng'}
                  </button>
                  <button
                    style={{
                      padding: '12px 16px', background: '#dc2626',
                      color: '#fff', border: 0, borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                    }}
                    onClick={() => {
                      setProcessingId(item.returnRequestId)
                      setActionStatus('Rejected')
                      setAdminNote(item.adminNote || '')
                    }}
                  >
                    ❌ Từ chối
                  </button>
                </div>

                {/* Action form modal / expansion */}
                {processingId === item.returnRequestId && (
                  <div style={{ background: actionStatus === 'Approved' ? '#f0fdf4' : '#fef2f2', padding: '16px', borderRadius: '12px', border: `1px solid ${actionStatus === 'Approved' ? '#bbf7d0' : '#fecaca'}` }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: actionStatus === 'Approved' ? '#15803d' : '#991b1b', display: 'block', marginBottom: '10px' }}>
                      Xác nhận {actionStatus === 'Approved' ? 'ĐỒNG Ý THU HỒI' : 'TỪ CHỐI'} yêu cầu hoàn hàng #{item.orderCode}:
                    </span>

                    {actionStatus === 'Approved' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#166534', display: 'block', marginBottom: '4px' }}>
                            1. Phân công Shipper thu hồi sản phẩm
                          </label>
                          <select
                            value={selectedStaffId || ''}
                            onChange={(e) => setSelectedStaffId(e.target.value ? Number(e.target.value) : null)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                          >
                            <option value="">-- Chọn Shipper thu hồi hàng --</option>
                            {deliveryStaffOptions.map((staff) => (
                              <option key={staff.userId} value={staff.userId}>
                                🚚 Shipper: {staff.fullName} ({staff.phone})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#166534', display: 'block', marginBottom: '4px' }}>
                              2. Trạng thái chuyển khoản
                            </label>
                            <select
                              value={refundStatus}
                              onChange={(e) => setRefundStatus(e.target.value as any)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                            >
                              <option value="Processing">🔄 Đang thu hồi sản phẩm</option>
                              <option value="Refunded" disabled={!item.warehouseConfirmedAt}>
                                {!item.warehouseConfirmedAt ? '❌ [Khóa] Chờ Thủ kho nhận hàng về kho' : '✅ Đã chuyển khoản hoàn tiền xong'}
                              </option>
                              <option value="Pending">⏳ Chờ xử lý</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#166534', display: 'block', marginBottom: '4px' }}>
                              Số tiền hoàn (VNĐ)
                            </label>
                            <input
                              type="number"
                              value={refundAmount}
                              onChange={(e) => setRefundAmount(Number(e.target.value))}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <textarea
                      rows={2}
                      placeholder="Nhập lời nhắn gửi cho khách hàng (hướng dẫn hẹn thời gian Shipper lấy hàng hoặc lý do từ chối)..."
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
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
              </div>

            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
