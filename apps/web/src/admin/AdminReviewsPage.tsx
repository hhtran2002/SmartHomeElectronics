import { useEffect, useState } from 'react'
import { getAdminReviews, updateAdminReviewStatus } from '../api'
import type { AdminReview } from '../types'

type Props = {
  roles: string[]
  token: string
}

export function AdminReviewsPage({ roles, token }: Props) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reviews, setReviews] = useState<AdminReview[]>([])

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

  if (!canModerate) {
    return <div className="status-card error">Bạn không có quyền duyệt đánh giá.</div>
  }

  return (
    <section>
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Quản trị nội dung</span>
          <h2>Duyệt đánh giá sản phẩm</h2>
          <p>Review/comment khách gửi sẽ chờ duyệt trước khi hiển thị ở Product Detail.</p>
        </div>
      </div>

      {error && <div className="status-card error">{error}</div>}

      <div className="admin-panel-card">
        <div className="admin-detail-items">
          {loading ? (
            <p>Đang tải đánh giá...</p>
          ) : reviews.length === 0 ? (
            <p className="empty-hint">Chưa có đánh giá nào.</p>
          ) : reviews.map((review) => (
            <article className="review-moderation-row" key={review.reviewId}>
              <div>
                <strong>{review.productName}</strong>
                <small>{review.parentReviewId ? `Reply #${review.parentReviewId}` : `${review.rating} sao`} · {review.reviewerName}</small>
                <p>{review.comment || 'Không có nội dung.'}</p>
              </div>
              <div>
                <span className={`status-pill ${review.status.toLowerCase()}`}>{review.status}</span>
                <div className="row-actions">
                  <button onClick={() => void changeStatus(review, 'Approved')}>Duyệt</button>
                  <button onClick={() => void changeStatus(review, 'Hidden')}>Ẩn</button>
                  <button onClick={() => void changeStatus(review, 'Rejected')}>Từ chối</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
