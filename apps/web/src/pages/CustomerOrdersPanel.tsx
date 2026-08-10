import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { getCustomerOrder, getCustomerOrders, submitCustomerReturnRequest, submitCustomerReview } from '../api'
import type { CustomerOrder, CustomerOrderDetail } from '../types'
import { formatPrice } from '../utils'

type ReviewingItem = {
  orderDetailId: number
  productName: string
  imageUrl: string | null
  productSlug: string
}

const ORDERS_PER_PAGE = 9

export function CustomerOrdersPanel({ token }: { token: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [detail, setDetail] = useState<CustomerOrderDetail | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Review modal state
  const [reviewingItem, setReviewingItem] = useState<ReviewingItem | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewHoverRating, setReviewHoverRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  // Return request modal state
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('Sản phẩm lỗi/hỏng')
  const [returnNote, setReturnNote] = useState('')
  const [returnEvidenceUrl, setReturnEvidenceUrl] = useState('')
  const [returnBankName, setReturnBankName] = useState('')
  const [returnBankAccountNumber, setReturnBankAccountNumber] = useState('')
  const [returnBankAccountName, setReturnBankAccountName] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnError, setReturnError] = useState('')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await getCustomerOrders(token)
      setOrders(payload.data)
      setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil(payload.data.length / ORDERS_PER_PAGE))))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được đơn hàng.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void loadOrders() }, [loadOrders])

  async function viewOrder(orderId: number) {
    setError('')
    try {
      const payload = await getCustomerOrder(orderId, token)
      setDetail(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được chi tiết đơn.')
    }
  }

  function openReviewModal(item: ReviewingItem) {
    setReviewingItem(item)
    setReviewRating(5)
    setReviewHoverRating(0)
    setReviewComment('')
    setReviewError('')
    setReviewSuccess('')
  }

  function closeReviewModal() {
    setReviewingItem(null)
    setReviewError('')
    setReviewSuccess('')
  }

  async function handleReviewSubmit(event: FormEvent) {
    event.preventDefault()
    if (!reviewingItem) return
    if (!reviewComment.trim()) {
      setReviewError('Vui lòng nhập nội dung đánh giá.')
      return
    }
    setReviewSubmitting(true)
    setReviewError('')
    try {
      await submitCustomerReview({
        orderDetailId: reviewingItem.orderDetailId,
        rating: reviewRating,
        comment: reviewComment.trim(),
      }, token)
      setReviewSuccess('Đánh giá của bạn đã được gửi và đang chờ duyệt. Cảm ơn!')
      // Reload order detail so hasReview updates
      if (detail) {
        const refreshed = await getCustomerOrder(detail.order.orderId, token)
        setDetail(refreshed.data)
      }
      setTimeout(() => closeReviewModal(), 2000)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Không gửi được đánh giá.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  async function handleReturnSubmit(event: FormEvent) {
    event.preventDefault()
    if (!detail) return
    if (!returnEvidenceUrl.trim()) {
      setReturnError('Bạn bắt buộc phải nhập link ảnh hoặc video minh chứng lỗi sản phẩm.')
      return
    }
    if (!returnBankName.trim() || !returnBankAccountNumber.trim() || !returnBankAccountName.trim()) {
      setReturnError('Vui lòng nhập đầy đủ Tên ngân hàng, Số tài khoản và Tên chủ tài khoản để nhận tiền hoàn qua chuyển khoản.')
      return
    }

    setReturnSubmitting(true)
    setReturnError('')
    try {
      await submitCustomerReturnRequest({
        orderId: detail.order.orderId,
        reason: returnReason,
        note: returnNote.trim(),
        evidenceUrl: returnEvidenceUrl.trim(),
        bankName: returnBankName.trim(),
        bankAccountNumber: returnBankAccountNumber.trim(),
        bankAccountName: returnBankAccountName.trim(),
      }, token)
      setShowReturnModal(false)
      setReturnNote('')
      setReturnEvidenceUrl('')
      setReturnBankName('')
      setReturnBankAccountNumber('')
      setReturnBankAccountName('')
      const refreshed = await getCustomerOrder(detail.order.orderId, token)
      setDetail(refreshed.data)
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : 'Không gửi được yêu cầu hoàn hàng.')
    } finally {
      setReturnSubmitting(false)
    }
  }

  if (loading) return <div className="status-card">Đang tải đơn hàng...</div>

  const isCompleted = detail?.order.orderStatusCode === 'Completed'
  const pageCount = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE))
  const visibleOrders = orders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE)

  function changePage(page: number) {
    const nextPage = Math.min(Math.max(page, 1), pageCount)
    if (nextPage === currentPage) return
    setCurrentPage(nextPage)
    setDetail(null)
  }

  return (
    <section className="customer-orders-panel">
      {error && <div className="status-card error">{error}</div>}

      {/* Return Request Modal */}
      {showReturnModal && detail && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowReturnModal(false) }}
        >
          <div style={{
            background: '#fff', borderRadius: '20px',
            padding: '32px', maxWidth: '520px', width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#ca8a04', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Khiếu nại / Đổi trả
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '18px', color: '#0f172a' }}>
                  Yêu cầu hoàn hàng #{detail.order.orderCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                style={{ background: 'none', border: 0, fontSize: '22px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            {/* Warning Banner */}
            <div style={{
              background: '#fefce8', border: '1px solid #fef08a', color: '#854d0e',
              padding: '12px 14px', borderRadius: '10px', fontSize: '12px', lineHeight: '1.5',
              marginBottom: '20px', fontWeight: '600',
            }}>
              ⚠️ <strong>Lưu ý quan trọng:</strong> Shop sẽ từ chối xử lý tất cả các yêu cầu không có link ảnh hoặc video minh chứng đính kèm (link Google Drive hoặc link ảnh).
            </div>

            <form onSubmit={handleReturnSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Lý do hoàn hàng <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px solid #cbd5e1', fontSize: '14px', background: '#fff',
                  }}
                >
                  <option value="Sản phẩm lỗi/hỏng">Sản phẩm bị lỗi hoặc hỏng</option>
                  <option value="Giao sai sản phẩm">Giao sai sản phẩm đã đặt</option>
                  <option value="Thiếu phụ kiện/quà tặng">Thiếu phụ kiện hoặc quà tặng</option>
                  <option value="Hàng hư hỏng khi vận chuyển">Hàng bị hư hỏng khi vận chuyển</option>
                  <option value="Sản phẩm không như mô tả">Sản phẩm không đúng mô tả</option>
                  <option value="Lý do khác">Lý do khác</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Link minh chứng (Ảnh / Google Drive Video) <span style={{ color: '#dc2626' }}>* (Bắt buộc)</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/... hoặc link ảnh sản phẩm bị lỗi"
                  value={returnEvidenceUrl}
                  onChange={(e) => setReturnEvidenceUrl(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Mô tả chi tiết sự cố
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả cụ thể tình trạng sản phẩm hoặc lý do bạn muốn hoàn hàng..."
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1.5px solid #cbd5e1', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Bank Transfer Details Section */}
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  🏦 Thông tin ngân hàng nhận tiền hoàn (Chuyển khoản) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                  Sau khi sản phẩm được thu hồi về kho, shop sẽ chuyển khoản lại số tiền hoàn vào tài khoản này.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Tên Ngân hàng (VD: Vietcombank, Techcombank, MBBank...)</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Vietcombank - Chi nhánh Hà Nội"
                      value={returnBankName}
                      onChange={(e) => setReturnBankName(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Số tài khoản</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: 10123456789"
                        value={returnBankAccountNumber}
                        onChange={(e) => setReturnBankAccountNumber(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Tên chủ tài khoản</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: NGUYEN VAN A"
                        value={returnBankAccountName}
                        onChange={(e) => setReturnBankAccountName(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', marginTop: '4px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {returnError && (
                <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', color: '#dc2626', fontSize: '13px' }}>
                  {returnError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={returnSubmitting}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '12px', border: 0,
                    background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                    color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  {returnSubmitting ? 'Đang gửi...' : '🔄 Gửi yêu cầu hoàn hàng'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  style={{
                    padding: '12px 20px', borderRadius: '12px',
                    border: '1.5px solid #e2e8f0', background: '#fff',
                    color: '#64748b', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewingItem && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeReviewModal() }}
        >
          <div style={{
            background: '#fff', borderRadius: '20px',
            padding: '32px', maxWidth: '500px', width: '100%',
            boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.2s ease',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Đánh giá sản phẩm
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>
                  {reviewingItem.productName}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                style={{ background: 'none', border: 0, fontSize: '22px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {reviewingItem.imageUrl && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <img
                  src={reviewingItem.imageUrl}
                  alt={reviewingItem.productName}
                  style={{ height: '80px', objectFit: 'contain', borderRadius: '8px' }}
                />
              </div>
            )}

            {reviewSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#16a34a', fontWeight: '700', fontSize: '15px' }}>
                {reviewSuccess}
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit}>
                {/* Rating stars */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setReviewHoverRating(star)}
                        onMouseLeave={() => setReviewHoverRating(0)}
                        style={{
                          background: 'none', border: 0, cursor: 'pointer', padding: '4px',
                          fontSize: '36px', lineHeight: 1,
                          color: star <= (reviewHoverRating || reviewRating) ? '#f59e0b' : '#e2e8f0',
                          transition: 'color 0.15s, transform 0.15s',
                          transform: star <= (reviewHoverRating || reviewRating) ? 'scale(1.15)' : 'scale(1)',
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', marginTop: '6px' }}>
                    {['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Rất tuyệt!'][reviewHoverRating || reviewRating]}
                  </div>
                </div>

                {/* Comment textarea */}
                <div style={{ marginBottom: '20px' }}>
                  <textarea
                    rows={4}
                    placeholder="Chia sẻ nhận xét thực tế về sản phẩm..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: '12px',
                      border: '1.5px solid #e2e8f0', fontSize: '14px', resize: 'vertical',
                      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>

                {reviewError && (
                  <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderRadius: '10px', color: '#dc2626', fontSize: '13px' }}>
                    {reviewError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '12px', border: 0,
                      background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                      color: '#fff', fontWeight: '700', fontSize: '14px',
                      cursor: reviewSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {reviewSubmitting ? 'Đang gửi...' : '⭐ Gửi đánh giá'}
                  </button>
                  <button
                    type="button"
                    onClick={closeReviewModal}
                    style={{
                      padding: '12px 20px', borderRadius: '12px',
                      border: '1.5px solid #e2e8f0', background: '#fff',
                      color: '#64748b', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {!orders.length ? (
        <div className="status-card"><h3>Bạn chưa có đơn hàng</h3><a href="#/products">Bắt đầu mua sắm</a></div>
      ) : (
        <div className="customer-orders-layout">
          <div className="customer-order-index">
            <div className="customer-order-list">
              {visibleOrders.map((order) => (
                <button
                  className={detail?.order.orderId === order.orderId ? 'active' : ''}
                  key={order.orderId}
                  onClick={() => void viewOrder(order.orderId)}
                  type="button"
                >
                  <span>
                    <strong>{order.orderCode}</strong>
                    <small>{new Date(order.createdAt).toLocaleString('vi-VN')}</small>
                  </span>
                  <span>
                    <strong>{formatPrice(order.totalAmount)}</strong>
                    <small>{order.totalQuantity} sản phẩm</small>
                  </span>
                  <span className={`order-status ${order.orderStatusCode.toLowerCase()}`}>{order.orderStatusName}</span>
                </button>
              ))}
            </div>

            {pageCount > 1 && (
              <nav className="customer-order-pagination" aria-label="Phân trang đơn hàng">
                <button aria-label="Trang trước" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)} type="button">←</button>
                <div>
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                    <button aria-current={page === currentPage ? 'page' : undefined} className={page === currentPage ? 'active' : ''} key={page} onClick={() => changePage(page)} type="button">{page}</button>
                  ))}
                </div>
                <button aria-label="Trang sau" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)} type="button">→</button>
              </nav>
            )}
          </div>

          <aside className="customer-order-detail">
            {!detail ? (
              <div className="status-card">Chọn một đơn để xem sản phẩm đã mua.</div>
            ) : (
              <>
                <header className="customer-order-detail-head">
                  <div>
                    <span className="eyebrow">Chi tiết đơn hàng</span>
                    <h3>{detail.order.orderCode}</h3>
                    <p>{detail.order.paymentStatusName}</p>
                  </div>
                  <span className={`order-status ${detail.order.orderStatusCode.toLowerCase()}`}>{detail.order.orderStatusName}</span>
                </header>

                {/* Return Request Banner / Button */}
                {isCompleted && (
                  <div style={{ margin: '16px 0', padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    {detail.returnRequest ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>Trạng thái khiếu nại hoàn hàng:</span>
                          <span style={{
                            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                            background: detail.returnRequest.status === 'Approved' ? '#f0fdf4' : detail.returnRequest.status === 'Rejected' ? '#fef2f2' : '#fefce8',
                            color: detail.returnRequest.status === 'Approved' ? '#16a34a' : detail.returnRequest.status === 'Rejected' ? '#dc2626' : '#ca8a04',
                            border: `1px solid ${detail.returnRequest.status === 'Approved' ? '#bbf7d0' : detail.returnRequest.status === 'Rejected' ? '#fecaca' : '#fef08a'}`,
                          }}>
                            {detail.returnRequest.status === 'Approved' ? '✅ Đã chấp nhận' : detail.returnRequest.status === 'Rejected' ? '❌ Từ chối' : '⏳ Đang chờ duyệt'}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#475569' }}>
                          <strong>Lý do:</strong> {detail.returnRequest.reason}
                        </p>
                        {detail.returnRequest.evidenceUrl && (
                          <p style={{ margin: '4px 0', fontSize: '13px', color: '#0284c7' }}>
                            <strong>Minh chứng:</strong>{' '}
                            <a href={detail.returnRequest.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'underline' }}>
                              🔗 Xem ảnh / clip Drive minh chứng
                            </a>
                          </p>
                        )}
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#475569' }}>
                          <strong>Tài khoản nhận tiền:</strong>{' '}
                          🏦 Chuyển khoản qua {detail.returnRequest.bankName || 'Ngân hàng'} (STK: <strong>{detail.returnRequest.bankAccountNumber || 'N/A'}</strong> - Chủ TK: <strong>{detail.returnRequest.bankAccountName || 'N/A'}</strong>)
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px', color: '#475569' }}>
                          <strong>Trạng thái hoàn tiền:</strong>{' '}
                          <span style={{ fontWeight: '700', color: detail.returnRequest.refundStatus === 'Refunded' ? '#16a34a' : '#ea580c' }}>
                            {detail.returnRequest.refundStatus === 'Refunded'
                              ? '✅ Đã hoàn tiền thành công'
                              : detail.returnRequest.refundStatus === 'Processing'
                              ? '🔄 Đang trong quá trình thu hồi hàng & hoàn tiền'
                              : '⏳ Đang chờ xử lý'}
                          </span>
                        </p>
                        {detail.returnRequest.note && (
                          <p style={{ margin: '4px 0', fontSize: '13px', color: '#475569' }}>
                            <strong>Mô tả:</strong> {detail.returnRequest.note}
                          </p>
                        )}
                        {detail.returnRequest.adminNote && (
                          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#0284c7', background: '#f0f9ff', padding: '8px 12px', borderRadius: '8px' }}>
                            <strong>Phản hồi từ Admin:</strong> {detail.returnRequest.adminNote}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>Bạn gặp sự cố với sản phẩm?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setReturnReason('Sản phẩm lỗi/hỏng')
                            setReturnNote('')
                            setReturnEvidenceUrl('')
                            setReturnBankName('')
                            setReturnBankAccountNumber('')
                            setReturnBankAccountName('')
                            setReturnError('')
                            setShowReturnModal(true)
                          }}
                          style={{
                            padding: '8px 16px', borderRadius: '10px',
                            background: '#fefce8', border: '1px solid #fef08a',
                            color: '#ca8a04', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                          }}
                        >
                          🔄 Yêu cầu hoàn hàng / Đổi trả
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <section className="customer-order-shipping">
                  <div><span>Người nhận</span><strong>{detail.order.receiverName}</strong></div>
                  <div><span>Điện thoại</span><strong>{detail.order.receiverPhone}</strong></div>
                  <div className="customer-order-address"><span>Địa chỉ giao hàng</span><strong>{detail.order.shippingAddress}</strong></div>
                </section>

                <section className="customer-order-products">
                  <div className="customer-order-products-head">
                    <strong>Sản phẩm</strong>
                    <span>{detail.items.reduce((total, item) => total + item.quantity, 0)} sản phẩm</span>
                  </div>
                  <div className="customer-order-items">
                    {detail.items.map((item) => (
                      <article key={item.orderDetailId}>
                        <div className="customer-order-product-main">
                        {item.imageUrl
                            ? <img alt={item.productName} src={item.imageUrl} />
                            : <div className="order-image-placeholder">AA</div>
                        }
                          <div className="customer-order-product-copy">
                            <strong>{item.productName}</strong>
                            <small>SKU {item.skuCode}</small>
                            <small>Số lượng {item.quantity}</small>
                          </div>
                          <strong className="customer-order-product-price">{formatPrice(item.lineTotal)}</strong>
                        </div>

                        {isCompleted && (
                          <div className="customer-order-review-action">
                          {item.hasReview ? (
                              <span className="review-complete">Đã đánh giá</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openReviewModal({
                                orderDetailId: item.orderDetailId,
                                productName: item.productName,
                                imageUrl: item.imageUrl,
                                productSlug: item.productSlug,
                              })}
                            >
                                Viết đánh giá
                            </button>
                          )}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>

                <div className="customer-order-total">
                  <span>Tạm tính</span><strong>{formatPrice(detail.order.subtotalAmount)}</strong>
                  <span>Phí giao hàng</span><strong>{formatPrice(detail.order.shippingFee)}</strong>
                  <span>Tổng thanh toán</span><strong>{formatPrice(detail.order.totalAmount)}</strong>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
