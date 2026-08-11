import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { getProductReviewEligibility, submitProductQuestion, submitProductReview } from '../api'
import type { Product, ProductAttribute, ProductQuestion, ProductReview } from '../types'
import { formatPrice } from '../utils'
import './ProductDetail.css'

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

  for (const review of reviews) {
    const id = Number(review.reviewId)
    const parentId = review.parentReviewId ? Number(review.parentReviewId) : null
    map.set(id, { ...review, reviewId: id, parentReviewId: parentId, replies: [] })
  }

  for (const review of map.values()) {
    if (review.parentReviewId && map.has(review.parentReviewId)) {
      map.get(review.parentReviewId)!.replies!.push(review)
    } else if (!review.parentReviewId) {
      roots.push(review)
    }
  }

  return roots
}

function ReviewNode({ review, depth = 0 }: { review: ProductReview; depth?: number }) {
  return (
    <div className="review-node">
      <strong>
        {review.reviewerName} · {depth === 0 ? `Đã mua hàng · ★ ${review.rating}` : 'Phản hồi từ cửa hàng'}
      </strong>
      <p>{review.comment || 'Khách hàng chưa để lại nội dung.'}</p>
      {review.replies && review.replies.length > 0 && (
        <div className="review-replies">
          {review.replies.map((reply) => (
            <ReviewNode depth={depth + 1} key={reply.reviewId} review={reply} />
          ))}
        </div>
      )}
    </div>
  )
}

function buildQuestionTree(questions: ProductQuestion[]) {
  const map = new Map<number, ProductQuestion>()
  const roots: ProductQuestion[] = []
  questions.forEach((question) => map.set(question.questionId, { ...question, replies: [] }))
  map.forEach((question) => {
    const parent = question.parentQuestionId ? map.get(question.parentQuestionId) : undefined
    if (parent) parent.replies!.push(question)
    else roots.push(question)
  })
  return roots
}

function QuestionNode({ question, onReply }: {
  question: ProductQuestion
  onReply: (question: ProductQuestion) => void
}) {
  return (
    <div className={`product-question-node${question.isStaff ? ' staff-answer' : ''}`}>
      <strong>{question.authorName}{question.isStaff ? ' · Cửa hàng' : ''}</strong>
      <p>{question.comment || 'Không có nội dung.'}</p>
      <button type="button" onClick={() => onReply(question)}>Trả lời</button>
      {question.replies && question.replies.length > 0 && (
        <div className="product-question-replies">
          {question.replies.map((reply) => (
            <QuestionNode key={reply.questionId} onReply={onReply} question={reply} />
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
  const [canReview, setCanReview] = useState(false)
  const [hasPurchased, setHasPurchased] = useState(false)
  const [eligibilityLoading, setEligibilityLoading] = useState(false)
  const [questionComment, setQuestionComment] = useState('')
  const [questionError, setQuestionError] = useState('')
  const [questionMessage, setQuestionMessage] = useState('')
  const [questionSaving, setQuestionSaving] = useState(false)
  const [replyQuestion, setReplyQuestion] = useState<ProductQuestion | null>(null)

  const skus = useMemo(() => product?.skus ?? [], [product])
  const initialSku = useMemo(() => skus.find(s => s.skuId === product?.skuId) || skus[0] || null, [skus, product])
  const [selectedSkuId, setSelectedSkuId] = useState<number | null>(null)

  useEffect(() => {
    if (initialSku) {
      setSelectedSkuId(initialSku.skuId)
    }
  }, [initialSku])

  useEffect(() => {
    if (!token || !product?.slug) {
      setCanReview(false)
      setHasPurchased(false)
      return
    }

    let cancelled = false
    setEligibilityLoading(true)
    void getProductReviewEligibility(product.slug, token)
      .then((payload) => {
        if (cancelled) return
        setCanReview(payload.data.canReview)
        setHasPurchased(payload.data.hasPurchased)
      })
      .catch(() => {
        if (!cancelled) {
          setCanReview(false)
          setHasPurchased(false)
        }
      })
      .finally(() => {
        if (!cancelled) setEligibilityLoading(false)
      })

    return () => { cancelled = true }
  }, [product?.slug, token])

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
  const questions = product.questions ?? []
  const questionTree = buildQuestionTree(questions)
  const productSlug = product.slug

  async function handleSubmitReview(event: FormEvent) {
    event.preventDefault()
    setReviewError('')
    setReviewMessage('')

    if (!token) {
      setReviewError('Bạn cần đăng nhập để đánh giá.')
      return
    }

    setReviewSaving(true)
    try {
      const res = await submitProductReview(productSlug, token, {
        rating: reviewRating,
        comment: reviewComment,
      })
      setReviewComment('')
      setCanReview(false)
      const isApproved = res?.data?.status === 'Approved'
      setReviewMessage(isApproved ? 'Đã gửi phản hồi thành công!' : 'Đã gửi. Nội dung sẽ hiển thị sau khi admin duyệt.')
      onReviewSubmitted()
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Không gửi được đánh giá.')
    } finally {
      setReviewSaving(false)
    }
  }

  async function handleSubmitQuestion(event: FormEvent) {
    event.preventDefault()
    setQuestionError('')
    setQuestionMessage('')
    if (!token) {
      setQuestionError('Bạn cần đăng nhập để đặt câu hỏi hoặc trả lời.')
      return
    }
    if (questionComment.trim().length < 3) {
      setQuestionError('Nội dung hỏi đáp quá ngắn.')
      return
    }

    setQuestionSaving(true)
    try {
      const response = await submitProductQuestion(productSlug, token, {
        comment: questionComment.trim(),
        parentQuestionId: replyQuestion?.questionId ?? null,
      })
      setQuestionComment('')
      setReplyQuestion(null)
      setQuestionMessage(response.data.status === 'Approved'
        ? 'Nội dung hỏi đáp đã được đăng.'
        : 'Đã gửi. Nội dung hỏi đáp sẽ hiển thị sau khi được duyệt.')
      onReviewSubmitted()
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : 'Không gửi được nội dung hỏi đáp.')
    } finally {
      setQuestionSaving(false)
    }
  }

  return (
    <main className="detail-page product-detail-editorial">
      <button className="back-button detail-back-link" onClick={onBack}>← Tất cả sản phẩm</button>

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
            <div className="variant-selector">
              <span>Phiên bản</span>
              <div>
                {skus.map((sku) => (
                  <button
                    className={sku.skuId === selectedSkuId ? 'active' : ''}
                    key={sku.skuId}
                    onClick={() => setSelectedSkuId(sku.skuId)}
                    type="button"
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

      <section className="detail-two-columns detail-information-grid">
        <article className="detail-section-card detail-highlights-section">
          <span className="eyebrow">Tổng quan</span>
          <h2>Đặc điểm nổi bật</h2>
          <ul className="detail-highlights">
            {highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>
        </article>

        <article className="detail-section-card detail-specs-section">
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

      <article className="detail-section-card detail-description-section">
        <span className="eyebrow">Mô tả</span>
        <h2>Thông tin sản phẩm</h2>
        <p className="detail-description">
          {product.description || 'Sản phẩm chưa có mô tả chi tiết. Sau này có thể dùng module AI để tạo nội dung rồi lưu vào database.'}
        </p>
      </article>

      <article className="detail-section-card detail-reviews-section" id="product-reviews">
        <header className="detail-section-heading">
          <div><span className="eyebrow">Đánh giá</span><h2>Khách hàng nói gì</h2></div>
          <p>Nhận xét từ những khách hàng đã trải nghiệm sản phẩm.</p>
        </header>

        <div className="product-review-layout">
          <aside className="product-review-summary">
            <div className="product-review-score">
              <div>
              {Number(reviewSummary.averageRating).toFixed(1)}
              </div>
              <div className="product-review-stars">
              {[1,2,3,4,5].map((s) => (
                  <span className={s <= Math.round(Number(reviewSummary.averageRating)) ? 'filled' : ''} key={s}>★</span>
              ))}
              </div>
              <small>
              {reviewSummary.reviewCount} đánh giá
              </small>
            </div>
            <div className="product-review-bars">
            {[5,4,3,2,1].map((star) => {
              const count = reviews.filter(r => !r.parentReviewId && r.rating === star).length
              const pct = reviewSummary.reviewCount > 0 ? Math.round((count / reviewSummary.reviewCount) * 100) : 0
              return (
                  <div key={star}>
                    <span>{star}</span>
                    <div className="product-review-bar">
                      <i style={{ width: `${pct}%` }} />
                  </div>
                    <small>{count}</small>
                </div>
              )
            })}
            </div>
          </aside>

          <section className="product-review-content">
            <div className="product-review-list-wrap">
              <h3>Nhận xét gần đây</h3>
              {reviewTree.length === 0 ? (
                <div className="product-review-empty">
                  <strong>Chưa có đánh giá nào</strong>
                  <p>Hãy là người đầu tiên chia sẻ trải nghiệm về sản phẩm này.</p>
                </div>
              ) : (
                <div className="review-list">
                  {reviewTree.map((review) => <ReviewNode key={review.reviewId} review={review} />)}
                </div>
              )}
            </div>

            <div className="product-review-composer">
              <h3>Viết đánh giá của bạn</h3>
              {canReview ? (
                <form className="review-form" onSubmit={handleSubmitReview}>
                  <div className="product-review-rating-input">
                    <label>Chất lượng sản phẩm</label>
                    <div>
                      {[1,2,3,4,5].map((star) => (
                        <button className={star <= reviewRating ? 'active' : ''} key={star} type="button" onClick={() => setReviewRating(star)}>★</button>
                      ))}
                      <span>{['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Xuất sắc'][reviewRating]}</span>
                    </div>
                  </div>
                  <label htmlFor="product-review-comment">Nội dung đánh giá</label>
                  <textarea
                    id="product-review-comment"
                    placeholder="Chia sẻ trải nghiệm thực tế sau khi dùng sản phẩm..."
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    rows={4}
                  />
                  {reviewError && <p className="form-error">{reviewError}</p>}
                  <div className="product-review-submit">
                    <button disabled={reviewSaving}>{reviewSaving ? 'Đang gửi...' : 'Gửi đánh giá'}</button>
                  </div>
                </form>
              ) : (
                <div className="product-review-eligibility-note">
                  <strong>{eligibilityLoading ? 'Đang kiểm tra quyền đánh giá...' : hasPurchased ? 'Bạn đã đánh giá lần mua này' : 'Chỉ dành cho khách đã mua hàng'}</strong>
                  <p>
                    {!token
                      ? 'Hãy đăng nhập bằng tài khoản đã hoàn thành đơn hàng chứa sản phẩm này.'
                      : hasPurchased
                        ? 'Mỗi sản phẩm trong một đơn hàng hoàn thành chỉ được đánh giá một lần.'
                        : 'Bạn vẫn có thể đặt câu hỏi về sản phẩm ở mục Hỏi đáp bên dưới.'}
                  </p>
                </div>
              )}
              {reviewMessage && <p className="form-hint product-review-success">{reviewMessage}</p>}
            </div>
          </section>
        </div>
      </article>

      <article className="detail-section-card detail-questions-section" id="product-questions">
        <header className="detail-section-heading">
          <div><span className="eyebrow">Hỏi đáp</span><h2>Câu hỏi về sản phẩm</h2></div>
          <p>Nội dung tư vấn, không phải đánh giá và không ảnh hưởng điểm sao.</p>
        </header>
        <div className="product-question-layout">
          <section className="product-question-list">
            <h3>Câu hỏi gần đây</h3>
            {questionTree.length === 0 ? (
              <div className="product-review-empty">
                <strong>Chưa có câu hỏi nào</strong>
                <p>Bạn có thể hỏi về tính năng, lắp đặt, bảo hành hoặc cách sử dụng.</p>
              </div>
            ) : questionTree.map((question) => (
              <QuestionNode key={question.questionId} onReply={(item) => {
                setReplyQuestion(item)
                setQuestionComment('')
              }} question={question} />
            ))}
          </section>
          <section className="product-question-composer">
            <h3>{replyQuestion ? `Trả lời ${replyQuestion.authorName}` : 'Đặt câu hỏi'}</h3>
            {replyQuestion && (
              <div className="product-review-reply-context">
                <span><strong>{replyQuestion.authorName}:</strong> {replyQuestion.comment?.slice(0, 100)}</span>
                <button aria-label="Hủy trả lời" onClick={() => setReplyQuestion(null)} type="button">×</button>
              </div>
            )}
            <form className="review-form" onSubmit={handleSubmitQuestion}>
              <label htmlFor="product-question-comment">Nội dung hỏi đáp</label>
              <textarea
                id="product-question-comment"
                onChange={(event) => setQuestionComment(event.target.value)}
                placeholder="Bạn muốn biết thêm điều gì về sản phẩm?"
                rows={4}
                value={questionComment}
              />
              {questionError && <p className="form-error">{questionError}</p>}
              {questionMessage && <p className="form-hint product-review-success">{questionMessage}</p>}
              <div className="product-review-submit">
                <button disabled={questionSaving}>{questionSaving ? 'Đang gửi...' : replyQuestion ? 'Gửi trả lời' : 'Gửi câu hỏi'}</button>
                {!token && <p>Bạn cần đăng nhập để tham gia hỏi đáp.</p>}
              </div>
            </form>
          </section>
        </div>
      </article>
    </main>
  )
}
