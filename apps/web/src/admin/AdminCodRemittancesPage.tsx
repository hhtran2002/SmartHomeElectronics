import { useCallback, useEffect, useState } from 'react'
import {
  confirmAdminCodRemittance,
  getAdminCodOverview,
  rejectAdminCodRemittance,
} from '../api'
import type { AdminCodOverview, CodRemittanceStatus } from '../types'
import { formatPrice } from '../utils'

type Props = { roles: string[]; token: string }

const statusLabels: Record<CodRemittanceStatus, string> = {
  Submitted: 'Chờ xác nhận',
  Confirmed: 'Đã xác nhận',
  Rejected: 'Bị từ chối',
  Cancelled: 'Đã hủy',
}

function defaultFilters() {
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 29)
  return {
    deliveryStaffId: '',
    status: '',
    fromDate: from.toISOString().slice(0, 10),
    toDate: today.toISOString().slice(0, 10),
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function AdminCodRemittancesPage({ roles, token }: Props) {
  const [overview, setOverview] = useState<AdminCodOverview | null>(null)
  const [filters, setFilters] = useState(defaultFilters)
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const allowed = roles.includes('SystemAdmin')

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await getAdminCodOverview(token, filters)
      setOverview(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được dữ liệu đối soát COD.')
    } finally {
      setLoading(false)
    }
  }, [filters, token])

  useEffect(() => { if (token && allowed) void loadOverview() }, [allowed, loadOverview, token])

  async function review(codRemittanceId: number, target: 'Confirmed' | 'Rejected', amount: number) {
    const reviewNote = reviewNotes[codRemittanceId] ?? ''
    if (target === 'Rejected' && !reviewNote.trim()) {
      setError('Vui lòng nhập lý do từ chối phiếu.')
      return
    }
    const prompt = target === 'Confirmed'
      ? `Xác nhận shop đã thực nhận đủ ${formatPrice(amount)}?`
      : 'Từ chối phiếu nộp tiền này?'
    if (!window.confirm(prompt)) return
    setWorkingId(codRemittanceId)
    setError('')
    setMessage('')
    try {
      if (target === 'Confirmed') {
        await confirmAdminCodRemittance(codRemittanceId, reviewNote, token)
        setMessage('Đã xác nhận shop nhận đủ tiền. Công nợ COD đã được cập nhật.')
      } else {
        await rejectAdminCodRemittance(codRemittanceId, reviewNote, token)
        setMessage('Đã từ chối phiếu. Khoản tiền vẫn thuộc công nợ của shipper.')
      }
      setReviewNotes((current) => ({ ...current, [codRemittanceId]: '' }))
      await loadOverview()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Không xử lý được phiếu COD.')
    } finally {
      setWorkingId(null)
    }
  }

  if (!token) return <div className="status-card error">Bạn cần đăng nhập trước khi đối soát COD.</div>
  if (!allowed) return <div className="status-card error">Chỉ SystemAdmin được xác nhận tiền COD đã về shop.</div>

  return (
    <>
      <section className="section-heading">
        <div>
          <span className="eyebrow">Kiểm soát tiền thu hộ</span>
          <h2>Đối soát COD</h2>
          <p>Theo dõi tiền khách đã trả cho từng shipper và chỉ tất toán khi shop thực sự nhận tiền.</p>
        </div>
      </section>

      <section className="cod-admin-filters">
        <label>Shipper
          <select value={filters.deliveryStaffId} onChange={(event) => setFilters((current) => ({ ...current, deliveryStaffId: event.target.value }))}>
            <option value="">Tất cả shipper</option>
            {overview?.deliveryStaff.map((staff) => <option key={staff.userId} value={staff.userId}>{staff.fullName}</option>)}
          </select>
        </label>
        <label>Trạng thái phiếu
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Tất cả trạng thái</option>
            <option value="Submitted">Chờ xác nhận</option>
            <option value="Confirmed">Đã xác nhận</option>
            <option value="Rejected">Bị từ chối</option>
            <option value="Cancelled">Đã hủy</option>
          </select>
        </label>
        <label>Từ ngày<input type="date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} /></label>
        <label>Đến ngày<input type="date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} /></label>
        <button disabled={loading} type="button" onClick={() => void loadOverview()}>{loading ? 'Đang tải...' : 'Xem đối soát'}</button>
      </section>

      {error && <div className="status-card error cod-alert">{error}</div>}
      {message && <div className="status-card success-card cod-alert">{message}</div>}
      {loading && !overview && <div className="status-card">Đang tải đối soát COD...</div>}

      {overview && <>
        <section className="cod-metrics admin-cod-metrics">
          <div><span>Khách đã trả shipper</span><strong>{formatPrice(overview.summary.totalCollected)}</strong></div>
          <div><span>Phiếu chờ xác nhận</span><strong>{formatPrice(overview.summary.pendingConfirmation)}</strong></div>
          <div><span>Shop đã nhận</span><strong>{formatPrice(overview.summary.totalRemitted)}</strong></div>
          <div className="cod-debt"><span>Shipper còn phải nộp</span><strong>{formatPrice(overview.summary.outstandingAmount)}</strong></div>
        </section>

        <section className="admin-panel-card">
          <div className="section-heading compact"><div><span className="eyebrow">Theo nhân viên</span><h3>Công nợ từng shipper</h3></div></div>
          <div className="cod-shipper-balances">
            {overview.shipperBalances.length === 0 ? <p className="form-hint">Chưa có công nợ COD trong khoảng ngày.</p> : overview.shipperBalances.map((staff) => (
              <article key={staff.deliveryStaffId}>
                <div><strong>{staff.deliveryStaffName}</strong><small>{staff.phone || 'Chưa có số điện thoại'} · {staff.collectionCount} đơn</small></div>
                <span><small>Đã thu</small><strong>{formatPrice(staff.collectedAmount)}</strong></span>
                <span><small>Chờ xác nhận</small><strong>{formatPrice(staff.pendingAmount)}</strong></span>
                <span><small>Shop đã nhận</small><strong>{formatPrice(staff.remittedAmount)}</strong></span>
                <span className="balance-debt"><small>Còn phải nộp</small><strong>{formatPrice(staff.outstandingAmount)}</strong></span>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel-card">
          <div className="section-heading compact"><div><span className="eyebrow">Cần kiểm tra</span><h3>Phiếu nộp tiền</h3></div></div>
          <div className="admin-cod-remittances">
            {overview.remittances.length === 0 ? <p className="form-hint">Không có phiếu nộp tiền phù hợp bộ lọc.</p> : overview.remittances.map((item) => (
              <article key={item.codRemittanceId}>
                <header>
                  <div><span className={`cod-status ${item.status.toLowerCase()}`}>{statusLabels[item.status]}</span><h4>{item.remittanceCode}</h4><small>{item.deliveryStaffName} · {formatDate(item.submittedAt)}</small></div>
                  <strong>{formatPrice(item.declaredAmount)}</strong>
                </header>
                <div className="cod-remittance-detail">
                  <span><small>Đơn COD</small><strong>{item.orderCodes || '—'}</strong></span>
                  <span><small>Phương thức</small><strong>{item.method === 'Cash' ? 'Tiền mặt' : 'Chuyển khoản'}</strong></span>
                  <span><small>Mã tham chiếu</small><strong>{item.referenceCode || '—'}</strong></span>
                  <span><small>Người xác nhận</small><strong>{item.reviewedByName || '—'}</strong></span>
                </div>
                {item.note && <p className="cod-note">Shipper: {item.note}</p>}
                {item.reviewNote && <p className="cod-note">Đối soát: {item.reviewNote}</p>}
                {item.status === 'Submitted' && <div className="cod-review-actions">
                  <label>Ghi chú đối soát<input value={reviewNotes[item.codRemittanceId] ?? ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [item.codRemittanceId]: event.target.value }))} placeholder="Đã kiểm đếm tiền mặt..." /></label>
                  <button className="success-action" disabled={workingId === item.codRemittanceId} type="button" onClick={() => void review(item.codRemittanceId, 'Confirmed', item.declaredAmount)}>Xác nhận đã nhận đủ</button>
                  <button className="danger-action" disabled={workingId === item.codRemittanceId} type="button" onClick={() => void review(item.codRemittanceId, 'Rejected', item.declaredAmount)}>Từ chối phiếu</button>
                </div>}
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel-card">
          <div className="section-heading compact"><div><span className="eyebrow">Theo đơn hàng</span><h3>Tiền COD đã thu</h3></div></div>
          <div className="admin-cod-collections">
            {overview.collections.length === 0 ? <p className="form-hint">Chưa có đơn COD giao thành công trong khoảng ngày.</p> : overview.collections.map((item) => (
              <article key={item.codCollectionId}>
                <div><strong>{item.orderCode}</strong><small>{item.deliveryStaffName} · {formatDate(item.collectedAt)}</small></div>
                <span><small>Khách đã trả</small><strong>{formatPrice(item.collectedAmount)}</strong></span>
                <span><small>Shop đã nhận</small><strong>{formatPrice(item.remittedAmount)}</strong></span>
                <span><small>Đang chờ xác nhận</small><strong>{formatPrice(item.pendingAmount)}</strong></span>
                <span className="balance-debt"><small>Còn công nợ</small><strong>{formatPrice(item.outstandingAmount)}</strong></span>
              </article>
            ))}
          </div>
        </section>
      </>}
    </>
  )
}
