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
      await updateAdminReturnRequestStatus(processingId, actionStatus, adminNote, token)
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
          <h2>Duyệt khiếu nại hoàn hàng / Đổi trả</h2>
          <p>Tiếp nhận và xử lý khiếu nại của khách hàng đối với các đơn hàng đã mua.</p>
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
                  {item.imageUrl && (
                    <div style={{ marginTop: '6px' }}>
                      <a href={item.imageUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0284c7' }}>
                        📷 Xem ảnh minh họa
                      </a>
                    </div>
                  )}
                  {item.adminNote && (
                    <p style={{ marginTop: '6px', fontSize: '12px', color: '#0284c7', background: '#f0f9ff', padding: '6px 10px', borderRadius: '6px' }}>
                      <strong>Ghi chú xử lý:</strong> {item.adminNote}
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
                <div style={{ background: actionStatus === 'Approved' ? '#f0fdf4' : '#fef2f2', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${actionStatus === 'Approved' ? '#bbf7d0' : '#fecaca'}` }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: actionStatus === 'Approved' ? '#15803d' : '#991b1b' }}>
                    Xác nhận {actionStatus === 'Approved' ? 'ĐỒNG Ý' : 'TỪ CHỐI'} yêu cầu hoàn hàng:
                  </span>
                  <textarea
                    rows={2}
                    placeholder="Nhập ghi chú / lời nhắn gửi cho khách hàng..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    style={{ width: '100%', marginTop: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      disabled={saving}
                      onClick={() => void handleConfirmStatus()}
                      style={{
                        padding: '6px 16px', border: 0, borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: '#fff',
                        background: actionStatus === 'Approved' ? '#16a34a' : '#dc2626',
                      }}
                    >
                      {saving ? 'Đang cập nhật...' : 'Xác nhận'}
                    </button>
                    <button
                      onClick={() => { setProcessingId(null); setActionStatus(null) }}
                      style={{ padding: '6px 12px', background: '#e2e8f0', color: '#475569', border: 0, borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
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
