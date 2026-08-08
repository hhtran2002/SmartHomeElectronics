import { useEffect, useState } from 'react'
import { getAdminReturnRequests, updateAdminReturnRequestStatus } from '../api'
import type { AdminReturnRequest } from '../types'
import { formatPrice } from '../utils'

type Props = {
  roles: string[]
  token: string
}

export function AdminReturnsPage({ roles, token }: Props) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState<AdminReturnRequest[]>([])
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [actionStatus, setActionStatus] = useState<'Approved' | 'Rejected' | null>(null)
  const [refundStatus, setRefundStatus] = useState<'Pending' | 'Processing' | 'Refunded' | 'Failed'>('Processing')
  const [refundAmount, setRefundAmount] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  const canModerate = roles.some((r) => ['SystemAdmin', 'OrderAdmin', 'CustomerSupport'].includes(r))

  async function loadRequests() {
    if (!token || !canModerate) return
    setLoading(true)
    setError('')
    try {
      const payload = await getAdminReturnRequests(token)
      setRequests(payload.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách khiếu nại hoàn hàng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRequests()
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
          adminNote: adminNote.trim(),
        },
        token
      )
      setProcessingId(null)
      setActionStatus(null)
      setAdminNote('')
      await loadRequests()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái hoàn hàng.')
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
          <span className="eyebrow">Quản trị CSKH & Đổi trả</span>
          <h2>Duyệt khiếu nại hoàn hàng & Hoàn tiền</h2>
          <p>Tiếp nhận khiếu nại, xem minh chứng ảnh/video, kiểm tra STK ngân hàng và duyệt hoàn tiền cho khách.</p>
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

                  {/* Refund Bank info box */}
                  <div style={{ marginTop: '10px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <div>
                      <strong>Tài khoản chuyển khoản hoàn tiền:</strong>{' '}
                      <span style={{ fontWeight: '700', color: '#0369a1' }}>🏦 Chuyển khoản ngân hàng</span>
                    </div>
                    <div style={{ marginTop: '4px', color: '#334155' }}>
                      👉 Ngân hàng: <strong>{item.bankName || 'N/A'}</strong> | STK: <strong>{item.bankAccountNumber || 'N/A'}</strong> | Chủ TK: <strong>{item.bankAccountName || 'N/A'}</strong>
                    </div>
                    <div style={{ marginTop: '4px', color: '#475569' }}>
                      👉 Trạng thái hoàn tiền: <span style={{ fontWeight: '700', color: item.refundStatus === 'Refunded' ? '#16a34a' : '#ea580c' }}>
                        {item.refundStatus === 'Refunded' ? '✅ Đã hoàn tiền' : item.refundStatus === 'Processing' ? '🔄 Đang xử lý' : '⏳ Chờ hoàn tiền'}
                      </span>
                    </div>
                  </div>

                  {item.adminNote && (
                    <p style={{ marginTop: '8px', fontSize: '12px', color: '#0284c7', background: '#f0f9ff', padding: '6px 10px', borderRadius: '6px' }}>
                      <strong>Ghi chú Admin:</strong> {item.adminNote}
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
                  <div className="row-actions" style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button
                      style={{ background: '#16a34a', color: '#fff', border: 0, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                      onClick={() => {
                        setProcessingId(item.returnRequestId)
                        setActionStatus('Approved')
                        setRefundStatus(item.refundStatus || 'Processing')
                        setRefundAmount(item.refundAmount || item.totalAmount)
                        setAdminNote(item.adminNote || '')
                      }}
                    >
                      Đồng ý hoàn
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

              {/* Action input box */}
              {processingId === item.returnRequestId && (
                <div style={{ background: actionStatus === 'Approved' ? '#f0fdf4' : '#fef2f2', padding: '14px 16px', borderRadius: '12px', border: `1px solid ${actionStatus === 'Approved' ? '#bbf7d0' : '#fecaca'}` }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: actionStatus === 'Approved' ? '#15803d' : '#991b1b' }}>
                    Xác nhận {actionStatus === 'Approved' ? 'ĐỒNG Ý' : 'TỪ CHỐI'} yêu cầu hoàn hàng #{item.orderCode}:
                  </span>

                  {actionStatus === 'Approved' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '10px 0' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>Trạng thái hoàn tiền</label>
                        <select
                          value={refundStatus}
                          onChange={(e) => setRefundStatus(e.target.value as any)}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px' }}
                        >
                          <option value="Processing">🔄 Đang xử lý / Shipper thu hàng</option>
                          <option value="Refunded">✅ Đã chuyển khoản / Hoàn tiền xong</option>
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
