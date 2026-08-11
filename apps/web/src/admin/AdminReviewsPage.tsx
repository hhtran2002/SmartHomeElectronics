import { Fragment, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  getAdminReviews,
  getAdminReviewSettings,
  submitProductQuestion,
  submitProductReview,
  updateAdminReviewSettings,
  updateAdminReviewStatus,
} from '../api'
import type { AdminReview } from '../types'

type Props = {
  roles: string[]
  token: string
}

type ReviewTreeNode = AdminReview & {
  children: ReviewTreeNode[]
}

function compareCreatedAt(left: AdminReview, right: AdminReview) {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
}

function buildReviewTree(reviews: AdminReview[]) {
  const nodes = new Map<number, ReviewTreeNode>()
  const roots: ReviewTreeNode[] = []

  reviews.forEach((review) => nodes.set(review.reviewId, { ...review, children: [] }))
  nodes.forEach((review) => {
    const parent = review.parentReviewId ? nodes.get(review.parentReviewId) : undefined
    if (parent) parent.children.push(review)
    else roots.push(review)
  })

  nodes.forEach((review) => review.children.sort(compareCreatedAt))
  return roots.sort((left, right) => compareCreatedAt(right, left))
}

function filterReviewTree(nodes: ReviewTreeNode[], status: 'All' | AdminReview['status']): ReviewTreeNode[] {
  if (status === 'All') return nodes

  return nodes.flatMap((node) => {
    const children = filterReviewTree(node.children, status)
    return node.status === status || children.length > 0 ? [{ ...node, children }] : []
  })
}

export function AdminReviewsPage({ roles, token }: Props) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [replyingId, setReplyingId] = useState<number | null>(null)
  const [replyComment, setReplyComment] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'All' | AdminReview['status']>('All')
  const [moderationRequired, setModerationRequired] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')

  const canModerate = roles.includes('SystemAdmin') || roles.includes('CustomerSupport')

  async function loadReviews() {
    if (!token || !canModerate) return
    setLoading(true)
    setError('')
    try {
      const [reviewsPayload, settingsPayload] = await Promise.all([
        getAdminReviews(token),
        getAdminReviewSettings(token),
      ])
      setReviews(reviewsPayload.data)
      setModerationRequired(settingsPayload.data.moderationRequired)
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

  async function changeModerationSetting(required: boolean) {
    setSavingSettings(true)
    setSettingsMessage('')
    setError('')
    try {
      const payload = await updateAdminReviewSettings(required, token)
      setModerationRequired(payload.data.moderationRequired)
      setSettingsMessage(required
        ? 'Đã bật duyệt trước khi hiển thị đánh giá.'
        : 'Đã tắt duyệt. Khách đã mua hàng có thể đăng đánh giá trực tiếp.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không cập nhật được chế độ duyệt đánh giá.')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleSendReply(review: AdminReview) {
    if (!replyComment.trim()) return
    setSendingReply(true)
    try {
      if (review.contentType === 'Question') {
        await submitProductQuestion(review.productSlug, token, {
          comment: replyComment,
          parentQuestionId: review.reviewId,
        })
      } else {
        await submitProductReview(review.productSlug, token, {
          rating: 5,
          comment: replyComment,
          parentReviewId: review.reviewId,
        })
      }
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
  const matchingReviewCount = statusFilter === 'All'
    ? reviews.length
    : reviews.filter((review) => review.status === statusFilter).length
  const reviewTree = filterReviewTree(buildReviewTree(reviews), statusFilter)
  const pendingCount = reviews.filter((review) => review.status === 'Pending').length
  const approvedCount = reviews.filter((review) => review.status === 'Approved').length

  function renderReview(review: ReviewTreeNode, depth = 0) {
    const isReply = Boolean(review.parentReviewId)
    const isFilterContext = statusFilter !== 'All' && review.status !== statusFilter
    const depthStyle = { '--review-depth': Math.min(depth, 5) } as CSSProperties

    return (
      <Fragment key={review.reviewId}>
        <article
          className={`review-moderation-row${isReply ? ' review-tree-reply' : ''}${isFilterContext ? ' review-filter-context' : ''}${replyingId === review.reviewId ? ' replying' : ''}`}
          style={depthStyle}
        >
          <div className="admin-review-main">
            <div className="admin-review-thread-label">
              <span>
                {isReply
                  ? `Phản hồi ${review.contentType === 'Question' ? 'hỏi đáp' : 'đánh giá'} #${review.parentReviewId}`
                  : review.contentType === 'Question' ? 'Câu hỏi sản phẩm' : 'Đánh giá đã mua hàng'}
              </span>
              {review.children.length > 0 && <small>{review.children.length} phản hồi trực tiếp</small>}
            </div>
            <div className="admin-review-product-line">
              <strong>{review.productName}</strong>
              <a href={`/#/products/${encodeURIComponent(review.productSlug)}`}>Xem sản phẩm ↗</a>
            </div>
            <p>{review.comment || 'Không có nội dung.'}</p>
            <small>
              {review.contentType === 'Question' || isReply
                ? `Nội dung #${review.reviewId}`
                : `${review.rating}/5 sao · #${review.reviewId}`}
            </small>
          </div>
          <div className="admin-review-author">
            <strong>{review.reviewerName}</strong>
            <small>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</small>
            <small>{new Date(review.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small>
          </div>
          <div className="admin-review-status">
            {isFilterContext && <small className="admin-review-context-label">Ngữ cảnh</small>}
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
                onChange={(event) => setReplyComment(event.target.value)}
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
        {review.children.map((child) => renderReview(child, depth + 1))}
      </Fragment>
    )
  }

  return (
    <section className="admin-review-page">
      <div className="section-heading compact">
        <div>
          <span className="eyebrow">Quản trị nội dung</span>
          <h2>Duyệt đánh giá & hỏi đáp sản phẩm</h2>
          <p>
            {moderationRequired
              ? 'Review/comment khách gửi sẽ chờ duyệt.'
              : 'Review của khách đã mua hàng sẽ được đăng tự động.'}
            {' '}Admin cũng có thể trả lời phản hồi trực tiếp cho khách hàng.
          </p>
        </div>
      </div>

      {error && <div className="status-card error">{error}</div>}

      <div className="admin-review-setting">
        <div>
          <span className="eyebrow">Chế độ đăng đánh giá</span>
          <strong>{moderationRequired ? 'Cần admin duyệt' : 'Tự động đăng'}</strong>
          <p>
            {moderationRequired
              ? 'Đánh giá mới của khách sẽ ở trạng thái chờ duyệt.'
              : 'Khách đã mua sản phẩm và hoàn thành đơn hàng sẽ được đăng đánh giá ngay.'}
          </p>
          {settingsMessage && <small>{settingsMessage}</small>}
        </div>
        <label className="admin-review-switch">
          <input
            aria-label="Yêu cầu admin duyệt đánh giá trước khi hiển thị"
            checked={moderationRequired}
            disabled={savingSettings}
            onChange={(event) => void changeModerationSetting(event.target.checked)}
            role="switch"
            type="checkbox"
          />
          <span aria-hidden="true" />
          <em>{savingSettings ? 'Đang lưu...' : moderationRequired ? 'Đang bật' : 'Đang tắt'}</em>
        </label>
      </div>

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
        <span>{matchingReviewCount} nội dung</span>
      </div>

      <div className="admin-panel-card admin-review-panel">
        <div className="admin-review-list-head" aria-hidden="true">
          <span>Nội dung đánh giá</span><span>Khách hàng</span><span>Trạng thái</span><span>Thao tác</span>
        </div>
        <div className="admin-review-list">
          {loading ? (
            <p className="admin-review-empty">Đang tải đánh giá...</p>
          ) : reviewTree.length === 0 ? (
            <p className="admin-review-empty">Không có nội dung trong trạng thái này.</p>
          ) : reviewTree.map((review) => renderReview(review))}
        </div>
      </div>
    </section>
  )
}
