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

  return (
    <section>
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Quản trị nội dung</span>
          <h2>Duyệt & Phản hồi đánh giá sản phẩm</h2>
          <p>Review/comment khách gửi sẽ chờ duyệt. Admin cũng có thể trả lời phản hồi trực tiếp cho khách hàng.</p>
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
            <article className="review-moderation-row" key={review.reviewId} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>
                    {review.productName}{' '}
                    <a
                      href={`/#/products/${encodeURIComponent(review.productSlug)}`}
                      style={{ fontSize: '12px', color: '#0284c7', textDecoration: 'none', marginLeft: '8px', fontWeight: 'normal' }}
                    >
                      🔗 Xem sản phẩm
                    </a>
                  </strong>
                  <small style={{ display: 'block', marginTop: '2px', color: '#64748b' }}>
                    {review.parentReviewId ? `Reply #${review.parentReviewId}` : `${review.rating} sao`} · {review.reviewerName} ({new Date(review.createdAt).toLocaleString('vi-VN')})
                  </small>
                  <p style={{ marginTop: '6px', fontSize: '14px' }}>{review.comment || 'Không có nội dung.'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span className={`status-pill ${review.status.toLowerCase()}`}>{review.status}</span>
                  <div className="row-actions" style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => void changeStatus(review, 'Approved')}>Duyệt</button>
                    <button onClick={() => void changeStatus(review, 'Hidden')}>Ẩn</button>
                    <button onClick={() => void changeStatus(review, 'Rejected')}>Từ chối</button>
                    <button
                      style={{ background: '#0284c7', color: '#fff', border: 0, borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                      onClick={() => {
                        if (replyingId === review.reviewId) {
                          setReplyingId(null)
                        } else {
                          setReplyingId(review.reviewId)
                          setReplyComment('')
                        }
                      }}
                    >
                      {replyingId === review.reviewId ? 'Hủy' : '↩ Trả lời'}
                    </button>
                  </div>
                </div>
              </div>

              {replyingId === review.reviewId && (
                <div style={{ background: '#f0f9ff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#0369a1' }}>Trả lời cho {review.reviewerName}:</span>
                  <textarea
                    rows={2}
                    placeholder="Nhập câu trả lời từ Admin/Cửa hàng..."
                    value={replyComment}
                    onChange={(e) => setReplyComment(e.target.value)}
                    style={{ width: '100%', marginTop: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      disabled={sendingReply || !replyComment.trim()}
                      onClick={() => void handleSendReply(review)}
                      style={{ padding: '6px 16px', background: '#0284c7', color: '#fff', border: 0, borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      {sendingReply ? 'Đang gửi...' : 'Gửi trả lời'}
                    </button>
                    <button
                      onClick={() => setReplyingId(null)}
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
