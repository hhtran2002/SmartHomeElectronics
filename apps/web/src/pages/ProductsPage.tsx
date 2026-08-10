import { useEffect, useRef, useState } from 'react'
import { askAiAboutProducts, getProduct, searchProductsByImage } from '../api'
import { ProductFilters } from '../components/ProductFilters'
import { ProductGrid } from '../components/ProductGrid'
import type {
  AiImageSearchResponse,
  AiQuota,
  Brand,
  Category,
  Product,
  ProductFilters as Filters,
} from '../types'
import './StorefrontPages.css'

type Props = {
  brands: Brand[]
  categories: Category[]
  error: string
  filters: Filters
  loading: boolean
  products: Product[]
  total: number
  onAddToCart: (product: Product) => void
  onFiltersChange: (filters: Filters) => void
  onResetFilters: () => void
  onViewDetail: (slug: string) => void
  roles: string[]
  token: string
}

type AiConversationMessage = {
  role: 'user' | 'assistant'
  content: string
  imageName?: string
  imageResult?: AiImageSearchResponse['data']
}

const imageDecisionLabels: Record<AiImageSearchResponse['data']['decision'], string> = {
  exact_match: 'Có khả năng trùng mẫu',
  similar_matches: 'Các mẫu tương tự',
  need_clarification: 'Cần thêm đặc điểm',
  no_match: 'Chưa tìm thấy mẫu phù hợp',
}

export function ProductsPage({
  brands,
  categories,
  error,
  filters,
  loading,
  products,
  total,
  onAddToCart,
  onFiltersChange,
  onResetFilters,
  onViewDetail,
  roles,
  token,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / 12))
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<AiConversationMessage[]>([])
  const [aiProducts, setAiProducts] = useState<Product[]>([])
  const [aiContextProductIds, setAiContextProductIds] = useState<number[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiQuota, setAiQuota] = useState<AiQuota | null>(null)
  const [aiStatus, setAiStatus] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [pendingImageQuestion, setPendingImageQuestion] = useState('')
  const [showAiModal, setShowAiModal] = useState(false)
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const aiQuotaUnlimited = roles.includes('SystemAdmin') || aiQuota?.unlimited === true
  const aiQuotaExhausted = !aiQuotaUnlimited && aiQuota?.remaining === 0

  useEffect(() => {
    chatHistoryRef.current?.scrollTo({ top: chatHistoryRef.current.scrollHeight, behavior: 'smooth' })
  }, [aiMessages])

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl('')
      return
    }

    const previewUrl = URL.createObjectURL(imageFile)
    setImagePreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [imageFile])

  function clearImageAttachment() {
    setImageFile(null)
    setPendingImageQuestion('')
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  async function submitAiSearch(event: React.FormEvent) {
    event.preventDefault()
    const question = aiQuery.trim()
    const attachedImage = imageFile
    if ((!question && !attachedImage) || aiLoading) return
    if (!token) {
      setAiStatus('Bạn cần đăng nhập để dùng tư vấn AI.')
      return
    }
    if (aiQuotaExhausted) {
      setAiStatus('Bạn đã dùng hết 4 lượt tư vấn AI hôm nay.')
      return
    }
    setAiStatus('')
    setAiLoading(true)
    setAiQuery('')
    const userMessage = attachedImage
      ? question || 'Tìm sản phẩm trong ảnh này.'
      : question
    const history = aiMessages
      .slice(-4)
      .map(({ role, content }) => ({ role, content }))
    setAiMessages((current) => [...current, {
      role: 'user',
      content: userMessage,
      imageName: attachedImage?.name,
    }])

    try {
      if (attachedImage) {
        const result = await searchProductsByImage(
          attachedImage,
          question,
          pendingImageQuestion ? aiContextProductIds : [],
          token,
        )
        setAiMessages((current) => [...current, {
          role: 'assistant',
          content: result.data.answer,
          imageResult: result.data,
        }])
        setAiContextProductIds(result.data.productIds)
        setAiQuota(result.data.quota)
        const details = await Promise.all(result.data.products.map((product) => getProduct(product.slug)))
        setAiProducts(details.map((item) => item.data))

        if (result.data.decision === 'need_clarification') {
          setPendingImageQuestion(result.data.clarifyingQuestion)
        } else {
          clearImageAttachment()
        }
      } else {
        const answer = await askAiAboutProducts(question, history, aiContextProductIds, token)
        setAiMessages((current) => [...current, {
          role: 'assistant',
          content: answer.data.answer,
        }])
        if (answer.data.productIds.length > 0) {
          setAiContextProductIds(answer.data.productIds)
        }
        setAiQuota(answer.data.quota)
        const details = await Promise.all(answer.data.products.map((product) => getProduct(product.slug)))
        if (details.length > 0) setAiProducts(details.map((item) => item.data))
      }
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : 'Chưa thể tư vấn bằng AI. Vui lòng thử lại sau.')
    } finally {
      setAiLoading(false)
    }
  }

  function selectImage(file: File | null) {
    setAiStatus('')
    setPendingImageQuestion('')

    if (!file) {
      clearImageAttachment()
      return
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      clearImageAttachment()
      setAiStatus('Vui lòng chọn ảnh JPEG hoặc PNG.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      clearImageAttachment()
      setAiStatus('Ảnh chỉ được lớn tối đa 8 MB.')
      return
    }

    setImageFile(file)
  }

  return (
    <main className="catalog-page">
      <section className="products-section catalog-section" id="products">
        <header className="catalog-intro">
          <div>
            <span>Catalog AA Smart</span>
            <h1>Thiết bị cho<br />mọi không gian.</h1>
            <p>Khám phá sản phẩm chính hãng được tuyển chọn cho ngôi nhà hiện đại.</p>
          </div>
          <div className="catalog-intro-aside">
            <strong>{total}</strong>
            <span>sản phẩm phù hợp</span>
          </div>
        </header>

        <div className="catalog-search-row">
          <div className="catalog-search-field">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value, page: 1 })}
              placeholder="Tìm theo tên hoặc nhu cầu..."
            />
          </div>
          <div className="catalog-search-actions">
            <button
              className="catalog-ai-button"
              onClick={() => setShowAiModal(true)}
            >
              Tìm cùng trợ lý AI
            </button>
            <button className="catalog-reset-button" onClick={onResetFilters}>Đặt lại</button>
          </div>
        </div>

        <div className="catalog-layout">
          <ProductFilters
            brands={brands}
            categories={categories}
            filters={filters}
            onChange={onFiltersChange}
            onReset={onResetFilters}
          />
          <div className="catalog-results">
            <div className="catalog-results-heading">
              <span>Kết quả</span>
              <small>{total} sản phẩm</small>
            </div>
            <ProductGrid
              error={error}
              loading={loading}
              products={products}
              onAddToCart={onAddToCart}
              onViewDetail={onViewDetail}
            />
            <div className="pagination">
              <button
                disabled={filters.page <= 1}
                onClick={() => onFiltersChange({ ...filters, page: filters.page - 1 })}
              >
                Trang trước
              </button>
              <span>Trang {filters.page} / {totalPages}</span>
              <button
                disabled={filters.page >= totalPages}
                onClick={() => onFiltersChange({ ...filters, page: filters.page + 1 })}
              >
                Trang sau
              </button>
            </div>
          </div>
        </div>
      </section>

      {showAiModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAiModal(false)}>
          <section
            aria-modal="true"
            className="admin-product-modal"
            style={{ maxWidth: '800px', width: '90%', height: '85vh', borderRadius: '28px', background: '#ffffff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head" style={{ borderBottom: '1px solid #e2e8f0', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="eyebrow">Trợ lý ảo thông minh</span>
                <h3 style={{ margin: '4px 0 0' }}>Tư vấn & Tìm kiếm bằng AI</h3>
              </div>
              <button type="button" onClick={() => setShowAiModal(false)} style={{ border: '1px solid #cbd5e1', borderRadius: '999px', padding: '6px 14px', background: '#ffffff', fontWeight: '800', cursor: 'pointer' }}>Đóng</button>
            </div>

            <div className="modal-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '24px' }}>
              <form className="ai-catalog-search" onSubmit={submitAiSearch} style={{ border: 0, padding: 0, boxShadow: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="ai-search-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small style={{ color: '#64748b' }}>Nhập nhu cầu hoặc chụp thiết bị, sau đó hỏi tiếp trong cùng cuộc trò chuyện.</small>
                  <span className="privacy-note" style={{ fontSize: '11px', color: '#94a3b8' }}>Ảnh chỉ dùng để tìm kiếm, không lưu lại.</span>
                </div>

                {aiMessages.length > 0 ? (
                  <div className="ai-chat-history" ref={chatHistoryRef} style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(125, 211, 252, 0.25)', borderRadius: '20px', padding: '18px', background: '#f8fafc' }}>
                    {aiMessages.map((message, index) => (
                      <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`} style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', alignItems: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        {message.imageName && (
                          <span className="ai-message-image" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#e0f2fe', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', marginBottom: '6px' }}>
                            📷 {message.imageName}
                          </span>
                        )}
                        <div style={{
                          background: message.role === 'user' ? '#16a8e3' : '#ffffff',
                          color: message.role === 'user' ? '#ffffff' : '#0f172a',
                          padding: '12px 18px',
                          borderRadius: message.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                          display: 'inline-block',
                          maxWidth: '85%',
                          boxShadow: '0 4px 12px rgba(8, 47, 73, 0.04)',
                          border: message.role === 'user' ? 'none' : '1px solid rgba(125, 211, 252, 0.25)'
                        }}>
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{message.content}</p>
                        </div>

                        {message.imageResult && (
                          <div className={`ai-image-answer ${message.imageResult.decision}`} style={{ marginTop: '10px', padding: '12px', borderLeft: '3px solid #16a8e3', background: '#f0f9ff', borderRadius: '8px', width: '85%' }}>
                            <span className="image-decision-badge" style={{ fontWeight: '800', fontSize: '12px', color: '#0369a1' }}>
                              {imageDecisionLabels[message.imageResult.decision]}
                            </span>
                            {(message.imageResult.observed.category
                              || message.imageResult.observed.brand
                              || message.imageResult.observed.modelText
                              || message.imageResult.observed.color
                              || message.imageResult.observed.visibleFeatures.length > 0) && (
                              <div className="image-observations" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                {message.imageResult.observed.category && <span style={{ fontSize: '11px', background: '#e0f2fe', padding: '3px 8px', borderRadius: '6px', color: '#0369a1', fontWeight: '700' }}>Loại: {message.imageResult.observed.category}</span>}
                                {message.imageResult.observed.brand && <span style={{ fontSize: '11px', background: '#e0f2fe', padding: '3px 8px', borderRadius: '6px', color: '#0369a1', fontWeight: '700' }}>Hãng: {message.imageResult.observed.brand}</span>}
                                {message.imageResult.observed.modelText && <span style={{ fontSize: '11px', background: '#e0f2fe', padding: '3px 8px', borderRadius: '6px', color: '#0369a1', fontWeight: '700' }}>Model: {message.imageResult.observed.modelText}</span>}
                                {message.imageResult.observed.color && <span style={{ fontSize: '11px', background: '#e0f2fe', padding: '3px 8px', borderRadius: '6px', color: '#0369a1', fontWeight: '700' }}>Màu: {message.imageResult.observed.color}</span>}
                                {message.imageResult.observed.visibleFeatures.map((feature) => <span style={{ fontSize: '11px', background: '#e0f2fe', padding: '3px 8px', borderRadius: '6px', color: '#0369a1', fontWeight: '700' }} key={feature}>{feature}</span>)}
                              </div>
                            )}
                            {message.imageResult.clarifyingQuestion && (
                              <p className="clarifying-question" style={{ margin: '8px 0 0', fontStyle: 'italic', color: '#075985' }}>{message.imageResult.clarifyingQuestion}</p>
                            )}
                            {message.imageResult.uncertaintyReasons.length > 0 && (
                              <small className="uncertainty-note" style={{ display: 'block', color: '#64748b', marginTop: '6px' }}>
                                Chưa chắc chắn vì: {message.imageResult.uncertaintyReasons.join('; ')}.
                              </small>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '12px', border: '2px dashed #e2e8f0', borderRadius: '24px', padding: '40px 20px', background: '#fafafa' }}>
                    <span style={{ fontSize: '56px' }}>🤖</span>
                    <strong style={{ color: '#0f172a', fontSize: '18px' }}>Trợ Lý Ảo AA Smart</strong>
                    <p style={{ margin: 0, textAlign: 'center', maxWidth: '420px', fontSize: '14px', lineHeight: '1.6', color: '#64748b' }}>
                      Bạn có thể trò chuyện tự nhiên với trợ lý ảo hoặc chụp ảnh thiết bị để tìm mẫu tương ứng trong kho hàng của chúng tôi.
                    </p>
                  </div>
                )}

                {imageFile && imagePreviewUrl && (
                  <div className="ai-image-attachment" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f0f9ff', padding: '12px', borderRadius: '16px', border: '1px solid #bae6fd' }}>
                    <img src={imagePreviewUrl} alt="Ảnh đính kèm" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '10px' }} />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#0369a1' }}>{imageFile.name}</strong>
                      <small style={{ display: 'block', color: '#0284c7', marginTop: '2px' }}>
                        {pendingImageQuestion ? `Đang chờ phản hồi: ${pendingImageQuestion}` : 'Ảnh sẽ được đính kèm vào tin nhắn.'}
                      </small>
                    </div>
                    <button type="button" onClick={clearImageAttachment} style={{ border: 0, background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#0284c7' }}>×</button>
                  </div>
                )}

                <div className="ai-composer" style={{ display: 'flex', gap: '10px', background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '999px', alignItems: 'center', boxShadow: '0 4px 18px rgba(0,0,0,0.03)' }}>
                  <input
                    id="ai-catalog-query"
                    value={aiQuery}
                    onChange={(event) => setAiQuery(event.target.value)}
                    placeholder={pendingImageQuestion || 'Ví dụ: tìm mẫu này, còn hàng không?'}
                    maxLength={imageFile ? 300 : 400}
                    style={{ flex: 1, border: 0, outline: 'none', padding: '8px 12px', fontSize: '14px' }}
                  />
                  <input
                    ref={imageInputRef}
                    className="visually-hidden"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    type="file"
                    onChange={(event) => selectImage(event.target.files?.[0] ?? null)}
                  />
                  <button
                    className="camera-button"
                    type="button"
                    title="Chụp hoặc chọn ảnh"
                    disabled={aiLoading || aiQuotaExhausted}
                    onClick={() => imageInputRef.current?.click()}
                    style={{ background: 'transparent', border: 0, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" style={{ width: '24px', height: '24px', stroke: '#64748b', strokeWidth: 2 }}>
                      <path d="M8.5 5.5 10 3.5h4l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h3.5Z" />
                      <circle cx="12" cy="12.5" r="4" />
                    </svg>
                  </button>
                  <button
                    className="primary-link small"
                    disabled={aiLoading || aiQuotaExhausted || (!aiQuery.trim() && !imageFile)}
                    style={{ padding: '10px 20px', borderRadius: '999px', minHeight: 'auto', boxShadow: 'none' }}
                  >
                    {aiLoading ? 'Đang xử lý...' : imageFile ? 'Gửi ảnh' : 'Hỏi AI'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b', padding: '0 8px' }}>
                  <span>
                    {aiQuotaUnlimited
                      ? 'Tài khoản quản trị được sử dụng AI không giới hạn để kiểm thử.'
                      : aiQuota === null
                        ? 'Tối đa 4 lượt AI mỗi ngày. Hỗ trợ JPEG/PNG tối đa 8 MB.'
                        : `Bạn còn ${aiQuota.remaining}/${aiQuota.limit} lượt AI hôm nay.`}
                  </span>
                  {aiStatus && <span style={{ color: '#b91c1c', fontWeight: '700' }}>{aiStatus}</span>}
                </div>
              </form>

              {aiProducts.length > 0 && (
                <div className="ai-result-section" style={{ borderTop: '1px solid #f1f5f9', marginTop: '20px', paddingTop: '20px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#0f172a' }}>Sản phẩm AI đang tư vấn</h4>
                  <div style={{ maxHeight: '350px', overflowY: 'auto', background: '#f8fafc', padding: '16px', borderRadius: '20px' }}>
                    <ProductGrid error="" loading={false} products={aiProducts} onAddToCart={onAddToCart} onViewDetail={(slug) => { setShowAiModal(false); onViewDetail(slug); }} />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
