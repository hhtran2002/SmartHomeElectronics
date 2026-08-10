import { useEffect, useState } from 'react'
import { getAdminReviews, submitProductReview, updateAdminReviewStatus } from '../api'
import type { AdminReview } from '../types'

type Props = {
  roles: string[]
  token: string
}

export function AdminReviewsPage({ roles, token }: Props) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [replyingId, setReplyingId] = useState<number | null>(null)
  const [replyComment, setReplyComment] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'All' | AdminReview['status']>('All')

  const canModerate = roles.includes('SystemAdmin') || roles.includes('CustomerSupport')

  async function loadReviews() {
    if (!token || !canModerate) return
    setLoading(true)
    setError('')
    try {
      const payload = await getAdminReviews(token)
      setReviews(payload.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không tải được danh sách đánh giá.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canModerate])

  async function changeStatus(review: AdminReview, status: AdminReview['status']) {
    try {
      await updateAdminReviewStatus(review.reviewId, status, token)
      await loadReviews()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không cập nhật được đánh giá.')
    }
  }

  async function handleSendReply(review: AdminReview) {
    if (!replyComment.trim()) return
    setSendingReply(true)
    try {
      await submitProductReview(review.productSlug, token, {
        rating: 5,
        comment: replyComment,
        parentReviewId: review.reviewId,
      })
      setReplyingId(null)
      setReplyComment('')
      await loadReviews()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không gửi được phản hồi.')
    } finally {
      setSendingReply(false)
    }
  }

  if (!canModerate) {
    return <div className="status-card error">Bạn không có quyền duyệt đánh giá.</div>
  }

  const statusLabels: Record<AdminReview['status'], string> = {
    Pending: 'Chờ duyệt',
    Approved: 'Đã duyệt',
    Hidden: 'Đã ẩn',
    Rejected: 'Từ chối',
  }
  const filteredReviews = statusFilter === 'All' ? reviews : reviews.filter((review) => review.status === statusFilter)
  const pendingCount = reviews.filter((review) => review.status === 'Pending').length
  const approvedCount = reviews.filter((review) => review.status === 'Approved').length

  return (
    <section className="admin-review-page">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Quản trị nội dung</span>
          <h2>Duyệt & Phản hồi đánh giá sản phẩm</h2>
          <p>Review/comment khách gửi sẽ chờ duyệt. Admin cũng có thể trả lời phản hồi trực tiếp cho khách hàng.</p>
        </div>
      </div>

      {error && <div className="status-card error">{error}</div>}

      <div className="admin-review-summary" aria-label="Tổng quan đánh giá">
        <div><span>Tổng nội dung</span><strong>{reviews.length}</strong></div>
        <div><span>Cần xử lý</span><strong>{pendingCount}</strong></div>
        <div><span>Đang hiển thị</span><strong>{approvedCount}</strong></div>
      </div>

      <div className="admin-review-toolbar">
        <div>
          {(['All', 'Pending', 'Approved', 'Hidden', 'Rejected'] as const).map((status) => (
            <button className={statusFilter === status ? 'active' : ''} key={status} onClick={() => setStatusFilter(status)} type="button">
              {status === 'All' ? 'Tất cả' : statusLabels[status]}
            </button>
          ))}
        </div>
        <span>{filteredReviews.length} nội dung</span>
      </div>

      <div className="admin-panel-card admin-review-panel">
        <div className="admin-review-list-head" aria-hidden="true">
          <span>Nội dung đánh giá</span><span>Khách hàng</span><span>Trạng thái</span><span>Thao tác</span>
        </div>
        <div className="admin-review-list">
          {loading ? (
            <p className="admin-review-empty">Đang tải đánh giá...</p>
          ) : filteredReviews.length === 0 ? (
            <p className="admin-review-empty">Không có nội dung trong trạng thái này.</p>
          ) : filteredReviews.map((review) => (
            <article className={`review-moderation-row${replyingId === review.reviewId ? ' replying' : ''}`} key={review.reviewId}>
              <div className="admin-review-main">
                <div className="admin-review-product-line">
                  <strong>{review.productName}</strong>
                  <a href={`/#/products/${encodeURIComponent(review.productSlug)}`}>Xem sản phẩm ↗</a>
                </div>
                <p>{review.comment || 'Không có nội dung.'}</p>
                <small>{review.parentReviewId ? `Phản hồi cho #${review.parentReviewId}` : `${review.rating}/5 sao`} · #{review.reviewId}</small>
              </div>
              <div className="admin-review-author">
                <strong>{review.reviewerName}</strong>
                <small>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</small>
                <small>{new Date(review.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small>
              </div>
              <div className="admin-review-status">
                <span className={`status-pill ${review.status.toLowerCase()}`}>{statusLabels[review.status]}</span>
              </div>
              <div className="row-actions admin-review-actions">
                    <button onClick={() => void changeStatus(review, 'Approved')}>Duyệt</button>
                    <button onClick={() => void changeStatus(review, 'Hidden')}>Ẩn</button>
                    <button onClick={() => void changeStatus(review, 'Rejected')}>Từ chối</button>
                    <button
                      onClick={() => {
                        if (replyingId === review.reviewId) {
                          setReplyingId(null)
                        } else {
                          setReplyingId(review.reviewId)
                          setReplyComment('')
                        }
                      }}
                    >
                      {replyingId === review.reviewId ? 'Đóng' : 'Trả lời'}
                    </button>
              </div>

              {replyingId === review.reviewId && (
                <div className="admin-review-reply">
                  <div><span>Phản hồi từ cửa hàng</span><strong>Trả lời {review.reviewerName}</strong></div>
                  <textarea
                    rows={3}
                    placeholder="Nhập câu trả lời từ Admin/Cửa hàng..."
                    value={replyComment}
                    onChange={(e) => setReplyComment(e.target.value)}
                  />
                  <div>
                    <button
                      disabled={sendingReply || !replyComment.trim()}
                      onClick={() => void handleSendReply(review)}
                    >
                      {sendingReply ? 'Đang gửi...' : 'Gửi trả lời'}
                    </button>
                    <button onClick={() => setReplyingId(null)}>Hủy</button>
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
