import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { submitProductReview } from '../api'
import type { Product, ProductAttribute, ProductReview } from '../types'
import { formatPrice } from '../utils'

type Props = {
  error: string
  loading: boolean
  product: Product | null
  onAddToCart: (product: Product) => void
  onBack: () => void
  token: string
  onReviewSubmitted: () => void
}

function attributeValue(attribute: ProductAttribute) {
  const value = String(attribute.value ?? '').trim()
  if (!value) return 'Chưa cập nhật'
  return attribute.unit ? `${value} ${attribute.unit}` : value
}

function buildFallbackSpecs(product: Product) {
  return [
    { label: 'Danh mục', value: product.categoryName },
    { label: 'Thương hiệu', value: product.brandName },
    { label: 'Mã SKU', value: product.skuCode ?? 'Chưa cập nhật' },
    { label: 'Bảo hành', value: `${product.warrantyMonths} tháng` },
    { label: 'Lắp đặt', value: product.installRequired ? 'Có hỗ trợ lắp đặt' : 'Không yêu cầu lắp đặt' },
    { label: 'Tồn khả dụng', value: `${product.availableQuantity} sản phẩm` },
  ]
}

function buildHighlights(product: Product, attributes: ProductAttribute[]) {
  const attributeHighlights = attributes
    .filter((attribute) => String(attribute.value ?? '').trim())
    .slice(0, 4)
    .map((attribute) => `${attribute.name}: ${attributeValue(attribute)}`)

  if (attributeHighlights.length > 0) return attributeHighlights

  return [
    `Sản phẩm thuộc nhóm ${product.categoryName}, thương hiệu ${product.brandName}.`,
    product.installRequired ? 'Có hỗ trợ lắp đặt khi giao hàng.' : 'Không cần lắp đặt phức tạp.',
    `Bảo hành ${product.warrantyMonths} tháng theo thông tin sản phẩm.`,
    product.availableQuantity > 0 ? `Còn ${product.availableQuantity} sản phẩm có thể đặt.` : 'Tạm hết hàng.',
  ]
}

function buildReviewTree(reviews: ProductReview[]) {
  const map = new Map<number, ProductReview>()
  const roots: ProductReview[] = []

  for (const review of reviews) map.set(review.reviewId, { ...review, replies: [] })
  for (const review of map.values()) {
    if (review.parentReviewId && map.has(review.parentReviewId)) {
      map.get(review.parentReviewId)!.replies!.push(review)
    } else {
      roots.push(review)
    }
  }

  return roots
}

function ReviewNode({ review, onReply }: {
  review: ProductReview
  onReply: (review: ProductReview) => void
}) {
  return (
    <div className="review-node">
      <strong>{review.reviewerName} · ★ {review.rating}</strong>
      <p>{review.comment || 'Khách hàng chưa để lại nội dung.'}</p>
      <button type="button" onClick={() => onReply(review)}>Trả lời</button>
      {review.replies && review.replies.length > 0 && (
        <div className="review-replies">
          {review.replies.map((reply) => (
            <ReviewNode key={reply.reviewId} review={reply} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductDetail({ error, loading, product, onAddToCart, onBack, token, onReviewSubmitted }: Props) {
  const images = useMemo(() => product?.images ?? [], [product])
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewMessage, setReviewMessage] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)
  const [replyTo, setReplyTo] = useState<ProductReview | null>(null)

  if (loading) {
    return <main className="detail-page"><div className="status-card">Đang tải chi tiết sản phẩm...</div></main>
  }

  if (error || !product) {
    return (
      <main className="detail-page">
        <div className="status-card error">{error || 'Không tìm thấy sản phẩm.'}</div>
      </main>
    )
  }

  const attributes = product.attributes ?? []
  const specs = attributes.length > 0
    ? attributes.map((attribute) => ({ label: attribute.name, value: attributeValue(attribute) }))
    : buildFallbackSpecs(product)
  const highlights = buildHighlights(product, attributes)
  const canBuy = Boolean(product.skuId) && product.availableQuantity > 0
  const mainImageUrl = selectedImageUrl || images[0]?.imageUrl || product.imageUrl
  const displayPrice = product.finalPrice ?? product.price ?? product.basePrice
  const originalPrice = product.originalPrice ?? product.price ?? product.basePrice
  const hasPromotion = Boolean(product.promotionId) && displayPrice < originalPrice
  const reviewSummary = product.reviewSummary ?? { reviewCount: 0, averageRating: 0 }
  const reviews = product.reviews ?? []
  const reviewTree = buildReviewTree(reviews)
  const productSlug = product.slug

  async function handleSubmitReview(event: FormEvent) {
    event.preventDefault()
    setReviewError('')
    setReviewMessage('')

    if (!token) {
      setReviewError('Bạn cần đăng nhập để đánh giá hoặc bình luận.')
      return
    }

    setReviewSaving(true)
    try {
      await submitProductReview(productSlug, token, {
        rating: reviewRating,
        comment: reviewComment,
        parentReviewId: replyTo?.reviewId ?? null,
      })
      setReviewComment('')
      setReplyTo(null)
      setReviewMessage('Đã gửi. Nội dung sẽ hiển thị sau khi admin duyệt.')
      onReviewSubmitted()
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Không gửi được đánh giá.')
    } finally {
      setReviewSaving(false)
    }
  }

  return (
    <main className="detail-page">
      <button className="back-button" onClick={onBack}>← Quay lại danh sách</button>

      <section className="detail-layout">
        <article className="detail-gallery-card">
          <div className="detail-visual">
            {mainImageUrl ? <img src={mainImageUrl} alt={product.name} /> : <span>⌂</span>}
          </div>
          {images.length > 1 && (
            <div className="detail-thumbnails">
              {images.map((image) => (
                <button
                  className={mainImageUrl === image.imageUrl ? 'active' : ''}
                  key={image.imageId}
                  onClick={() => setSelectedImageUrl(image.imageUrl)}
                  type="button"
                >
                  <img src={image.imageUrl} alt={image.altText ?? product.name} />
                </button>
              ))}
            </div>
          )}
        </article>

        <aside className="detail-buy-card">
          <span className="eyebrow">{product.categoryName} · {product.brandName}</span>
          <h1>{product.name}</h1>

          <div className="detail-rating-line">
            <span>★ {Number(reviewSummary.averageRating).toFixed(1)}</span>
            <small>{reviewSummary.reviewCount} đánh giá</small>
          </div>

          <div className="detail-price">
            {hasPromotion && <small className="old-price">{formatPrice(originalPrice)}</small>}
            <span>{formatPrice(displayPrice)}</span>
            {hasPromotion && <small className="promotion-label">{product.promotionName}</small>}
          </div>

          <div className="detail-facts">
            <div><strong>{product.skuCode ?? 'Chưa cập nhật'}</strong><span>Mã SKU</span></div>
            <div><strong>{product.warrantyMonths} tháng</strong><span>Bảo hành</span></div>
            <div><strong>{product.availableQuantity}</strong><span>Tồn khả dụng</span></div>
            <div><strong>{product.installRequired ? 'Có' : 'Không'}</strong><span>Lắp đặt</span></div>
          </div>

          <div className="detail-actions">
            <button disabled={!canBuy} onClick={() => onAddToCart(product)}>Thêm vào giỏ</button>
            <button
              className="secondary"
              disabled={!canBuy}
              onClick={() => {
                onAddToCart(product)
                window.location.hash = '#/cart'
              }}
            >
              Mua ngay
            </button>
          </div>

          {!canBuy && <p className="detail-note">Sản phẩm hiện chưa có SKU bán hoặc đã hết hàng.</p>}
        </aside>
      </section>

      <section className="detail-service-grid">
        <div><strong>Đổi trả 12 tháng</strong><span>Áp dụng theo chính sách cửa hàng.</span></div>
        <div><strong>Bảo hành chính hãng</strong><span>{product.warrantyMonths} tháng, có thông tin trên đơn hàng.</span></div>
        <div><strong>Giao hàng tận nơi</strong><span>Địa chỉ giao lấy từ checkout hoặc hồ sơ khách hàng.</span></div>
        <div><strong>{product.installRequired ? 'Hỗ trợ lắp đặt' : 'Dễ dùng tại nhà'}</strong><span>Theo đặc thù từng dòng sản phẩm.</span></div>
      </section>

      <section className="detail-two-columns">
        <article className="detail-section-card">
          <span className="eyebrow">Tổng quan</span>
          <h2>Đặc điểm nổi bật</h2>
          <ul className="detail-highlights">
            {highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>
        </article>

        <article className="detail-section-card">
          <span className="eyebrow">Thông tin</span>
          <h2>Thông số sản phẩm</h2>
          <div className="spec-table">
            {specs.map((spec) => (
              <div key={spec.label}>
                <span>{spec.label}</span>
                <strong>{spec.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="detail-section-card">
        <span className="eyebrow">Mô tả</span>
        <h2>Thông tin sản phẩm</h2>
        <p className="detail-description">
          {product.description || 'Sản phẩm chưa có mô tả chi tiết. Sau này có thể dùng module AI để tạo nội dung rồi lưu vào database.'}
        </p>
      </article>

      <article className="detail-section-card">
        <span className="eyebrow">Đánh giá</span>
        <h2>Đánh giá khách hàng</h2>
        <div className="review-summary">
          <strong>★ {Number(reviewSummary.averageRating).toFixed(1)}</strong>
          <span>{reviewSummary.reviewCount} đánh giá đã duyệt</span>
        </div>
        {reviewTree.length === 0 ? (
          <p className="empty-hint">Chưa có đánh giá. Khi làm module review/comment, phần này sẽ tự lấy dữ liệu từ bảng Review.</p>
        ) : (
          <div className="review-list">
            {reviewTree.map((review) => <ReviewNode key={review.reviewId} review={review} onReply={setReplyTo} />)}
          </div>
        )}

        <form className="review-form" onSubmit={handleSubmitReview}>
          <h3>{replyTo ? `Trả lời ${replyTo.reviewerName}` : 'Viết đánh giá'}</h3>
          {!replyTo && (
            <label>Rating
              <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} sao</option>)}
              </select>
            </label>
          )}
          {replyTo && (
            <button className="ghost-button" type="button" onClick={() => setReplyTo(null)}>Hủy trả lời</button>
          )}
          <label>Nội dung
            <textarea
              placeholder="Chia sẻ trải nghiệm sau khi mua sản phẩm..."
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
            />
          </label>
          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewMessage && <p className="form-hint">{reviewMessage}</p>}
          <button disabled={reviewSaving}>{reviewSaving ? 'Đang gửi...' : 'Gửi để duyệt'}</button>
        </form>
      </article>
    </main>
  )
}
