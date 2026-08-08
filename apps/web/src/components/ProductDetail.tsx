import { useEffect, useMemo, useState } from 'react'
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
  const savedHighlights = String(product.highlights ?? '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  if (savedHighlights.length > 0) return savedHighlights

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

  const skus = useMemo(() => product?.skus ?? [], [product])
  const initialSku = useMemo(() => skus.find(s => s.skuId === product?.skuId) || skus[0] || null, [skus, product])
  const [selectedSkuId, setSelectedSkuId] = useState<number | null>(null)

  useEffect(() => {
    if (initialSku) {
      setSelectedSkuId(initialSku.skuId)
    }
  }, [initialSku])

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

  const activeSku = skus.find(s => s.skuId === selectedSkuId) || initialSku

  const productToAddToCart = {
    ...product,
    skuId: activeSku ? activeSku.skuId : product.skuId,
    skuCode: activeSku ? activeSku.skuCode : product.skuCode,
    price: activeSku ? activeSku.price : product.price,
    originalPrice: activeSku ? activeSku.originalPrice : product.originalPrice,
    finalPrice: activeSku ? activeSku.finalPrice : product.finalPrice,
    promotionName: activeSku ? activeSku.promotionName : product.promotionName,
    availableQuantity: activeSku ? activeSku.availableQuantity : product.availableQuantity,
  }

  const attributes = product.attributes ?? []
  const specs = attributes.length > 0
    ? attributes.map((attribute) => ({ label: attribute.name, value: attributeValue(attribute) }))
    : buildFallbackSpecs(productToAddToCart)
  const highlights = buildHighlights(productToAddToCart, attributes)
  
  const displayPrice = productToAddToCart.finalPrice ?? productToAddToCart.price ?? productToAddToCart.basePrice
  const originalPrice = productToAddToCart.originalPrice ?? productToAddToCart.price ?? productToAddToCart.basePrice
  const hasPromotion = Boolean(productToAddToCart.promotionId || (activeSku && activeSku.promotionId)) && displayPrice < originalPrice
  
  const canBuy = Boolean(productToAddToCart.skuId) && productToAddToCart.availableQuantity > 0
  const mainImageUrl = selectedImageUrl || images[0]?.imageUrl || product.imageUrl
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

          {skus.length > 1 && (
            <div className="variant-selector" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '800' }}>Chọn phiên bản:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {skus.map((sku) => (
                  <button
                    key={sku.skuId}
                    onClick={() => setSelectedSkuId(sku.skuId)}
                    type="button"
                    style={{
                      padding: '10px 16px',
                      borderRadius: '12px',
                      border: sku.skuId === selectedSkuId ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: sku.skuId === selectedSkuId ? '#f0f9ff' : '#ffffff',
                      color: sku.skuId === selectedSkuId ? '#0284c7' : '#1e293b',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: sku.skuId === selectedSkuId ? '0 4px 12px rgba(2, 132, 199, 0.15)' : 'none'
                    }}
                  >
                    {sku.variantName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="detail-price">
            {hasPromotion && <small className="old-price">{formatPrice(originalPrice)}</small>}
            <span>{formatPrice(displayPrice)}</span>
            {hasPromotion && <small className="promotion-label">{productToAddToCart.promotionName}</small>}
          </div>

          <div className="detail-facts">
            <div><strong>{productToAddToCart.skuCode ?? 'Chưa cập nhật'}</strong><span>Mã SKU</span></div>
            <div><strong>{productToAddToCart.warrantyMonths} tháng</strong><span>Bảo hành</span></div>
            <div><strong>{productToAddToCart.availableQuantity}</strong><span>Tồn khả dụng</span></div>
            <div><strong>{productToAddToCart.installRequired ? 'Có' : 'Không'}</strong><span>Lắp đặt</span></div>
          </div>

          <div className="detail-actions">
            <button disabled={!canBuy} onClick={() => onAddToCart(productToAddToCart)}>Thêm vào giỏ</button>
            <button
              className="secondary"
              disabled={!canBuy}
              onClick={() => {
                onAddToCart(productToAddToCart)
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

      <article className="detail-section-card" id="product-reviews">
        <span className="eyebrow">Đánh giá</span>
        <h2>Đánh giá khách hàng</h2>

        {/* Review Summary Hero */}
        <div style={{
          display: 'flex', gap: '32px', alignItems: 'center',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          borderRadius: '16px', padding: '24px 28px', marginBottom: '28px',
        }}>
          <div style={{ textAlign: 'center', minWidth: '100px' }}>
            <div style={{ fontSize: '56px', fontWeight: '900', color: '#0369a1', lineHeight: 1 }}>
              {Number(reviewSummary.averageRating).toFixed(1)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '3px', margin: '8px 0' }}>
              {[1,2,3,4,5].map((s) => (
                <span key={s} style={{ fontSize: '20px', color: s <= Math.round(Number(reviewSummary.averageRating)) ? '#f59e0b' : '#e2e8f0' }}>★</span>
              ))}
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
              {reviewSummary.reviewCount} đánh giá
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {[5,4,3,2,1].map((star) => {
              const count = reviews.filter(r => !r.parentReviewId && r.rating === star).length
              const pct = reviewSummary.reviewCount > 0 ? Math.round((count / reviewSummary.reviewCount) * 100) : 0
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', width: '32px' }}>{star} ★</span>
                  <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '99px', transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: '#94a3b8', width: '28px', textAlign: 'right' }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Review List */}
        {reviewTree.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
            <p style={{ fontWeight: '700', color: '#64748b', margin: '0 0 4px' }}>Chưa có đánh giá nào</p>
            <p style={{ fontSize: '13px', margin: 0 }}>Hãy là người đầu tiên chia sẻ trải nghiệm về sản phẩm này!</p>
          </div>
        ) : (
          <div className="review-list">
            {reviewTree.map((review) => <ReviewNode key={review.reviewId} review={review} onReply={setReplyTo} />)}
          </div>
        )}

        {/* Review Form */}
        <div style={{
          marginTop: '32px', background: '#f8fafc', borderRadius: '16px',
          padding: '24px', border: '1px solid #e2e8f0',
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '18px', color: '#0f172a' }}>
            {replyTo ? `↩ Trả lời ${replyTo.reviewerName}` : '✍️ Viết đánh giá của bạn'}
          </h3>
          {replyTo && (
            <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#f0f9ff', borderRadius: '10px', fontSize: '13px', color: '#0369a1' }}>
              <strong>{replyTo.reviewerName}:</strong> {replyTo.comment?.slice(0, 100)}{(replyTo.comment?.length ?? 0) > 100 ? '...' : ''}
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                style={{ marginLeft: '12px', background: 'none', border: 0, cursor: 'pointer', color: '#94a3b8', fontSize: '16px' }}
              >×</button>
            </div>
          )}
          <form className="review-form" onSubmit={handleSubmitReview} style={{ background: 'transparent', padding: 0, border: 0 }}>
            {!replyTo && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                  Chất lượng sản phẩm
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {[1,2,3,4,5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      style={{
                        background: 'none', border: 0, cursor: 'pointer', padding: '2px',
                        fontSize: '32px', lineHeight: 1,
                        color: star <= reviewRating ? '#f59e0b' : '#e2e8f0',
                        transition: 'color 0.15s, transform 0.1s',
                        transform: star <= reviewRating ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >★</button>
                  ))}
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginLeft: '4px' }}>
                    {['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Xuất sắc!'][reviewRating]}
                  </span>
                </div>
              </div>
            )}
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>
              Nội dung đánh giá
            </label>
            <textarea
              placeholder="Chia sẻ trải nghiệm thực tế sau khi dùng sản phẩm..."
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              rows={4}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '12px',
                border: '1.5px solid #e2e8f0', fontSize: '14px', resize: 'vertical',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#0ea5e9' }}
              onBlur={(e) => { e.target.style.borderColor = '#e2e8f0' }}
            />
            {reviewError && <p className="form-error" style={{ marginTop: '8px' }}>{reviewError}</p>}
            {reviewMessage && <p className="form-hint" style={{ marginTop: '8px', color: '#16a34a' }}>{reviewMessage}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                disabled={reviewSaving}
                style={{
                  padding: '12px 24px', borderRadius: '12px', border: 0,
                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  color: '#fff', fontWeight: '700', fontSize: '14px',
                  cursor: reviewSaving ? 'not-allowed' : 'pointer', opacity: reviewSaving ? 0.7 : 1,
                }}
              >
                {reviewSaving ? 'Đang gửi...' : (replyTo ? 'Gửi trả lời' : 'Gửi đánh giá')}
              </button>
              {!token && <p style={{ margin: 0, alignSelf: 'center', fontSize: '13px', color: '#94a3b8' }}>Bạn cần đăng nhập để đánh giá</p>}
            </div>
          </form>
        </div>
      </article>
    </main>
  )
}
