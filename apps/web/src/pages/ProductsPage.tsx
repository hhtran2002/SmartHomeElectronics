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
import './AiSearchWorkspace.css'

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
    if (!showAiModal) return
    const previousOverflow = document.body.style.overflow

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowAiModal(false)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [showAiModal])

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
        <div className="modal-backdrop ai-workspace-backdrop" role="presentation" onMouseDown={() => setShowAiModal(false)}>
          <section
            aria-modal="true"
            aria-labelledby="ai-workspace-title"
            className="ai-workspace"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="ai-workspace-head">
              <div>
                <span>AA Smart Intelligence</span>
                <h2 id="ai-workspace-title">Tư vấn mua sắm cùng AI</h2>
              </div>
              <button aria-label="Đóng trợ lý AI" onClick={() => setShowAiModal(false)} type="button">Đóng <span>×</span></button>
            </header>

            <div className="ai-workspace-body">
              <section className="ai-conversation-panel">
                <header className="ai-panel-heading">
                  <div><span>Cuộc trò chuyện</span><strong>Mô tả điều bạn đang tìm</strong></div>
                  <small>Ảnh chỉ dùng để tìm kiếm và không được lưu lại.</small>
                </header>

                <div className={`ai-conversation-content${aiMessages.length ? ' has-messages' : ''}`} ref={chatHistoryRef}>
                  {aiMessages.length > 0 ? (
                    <div className="ai-chat-history">
                      {aiMessages.map((message, index) => (
                        <article className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
                          <span className="ai-message-author">{message.role === 'user' ? 'Bạn' : 'AA Smart AI'}</span>
                          {message.imageName && <span className="ai-message-image">Ảnh đính kèm · {message.imageName}</span>}
                          <div className="ai-message-body"><p>{message.content}</p></div>

                          {message.imageResult && (
                            <div className={`ai-image-answer ${message.imageResult.decision}`}>
                              <strong className="image-decision-badge">{imageDecisionLabels[message.imageResult.decision]}</strong>
                              {(message.imageResult.observed.category
                                || message.imageResult.observed.brand
                                || message.imageResult.observed.modelText
                                || message.imageResult.observed.color
                                || message.imageResult.observed.visibleFeatures.length > 0) && (
                                <div className="image-observations">
                                  {message.imageResult.observed.category && <span>Loại · {message.imageResult.observed.category}</span>}
                                  {message.imageResult.observed.brand && <span>Hãng · {message.imageResult.observed.brand}</span>}
                                  {message.imageResult.observed.modelText && <span>Model · {message.imageResult.observed.modelText}</span>}
                                  {message.imageResult.observed.color && <span>Màu · {message.imageResult.observed.color}</span>}
                                  {message.imageResult.observed.visibleFeatures.map((feature) => <span key={feature}>{feature}</span>)}
                                </div>
                              )}
                              {message.imageResult.clarifyingQuestion && <p className="clarifying-question">{message.imageResult.clarifyingQuestion}</p>}
                              {message.imageResult.uncertaintyReasons.length > 0 && (
                                <small className="uncertainty-note">Chưa chắc chắn vì: {message.imageResult.uncertaintyReasons.join('; ')}.</small>
                              )}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="ai-conversation-empty">
                      <span className="ai-monogram">AI</span>
                      <p>Bắt đầu bằng nhu cầu thực tế, mức giá hoặc một bức ảnh thiết bị.</p>
                      <div>
                        <button onClick={() => setAiQuery('Tìm TV 4K cho phòng khách, ngân sách dưới 15 triệu')} type="button">TV phòng khách dưới 15 triệu</button>
                        <button onClick={() => setAiQuery('Tư vấn máy giặt phù hợp cho gia đình 4 người')} type="button">Máy giặt cho gia đình 4 người</button>
                        <button onClick={() => setAiQuery('Thiết bị nào đang có ưu đãi tốt và còn hàng?')} type="button">Sản phẩm đang có ưu đãi</button>
                      </div>
                    </div>
                  )}
                </div>

                {imageFile && imagePreviewUrl && (
                  <div className="ai-image-attachment">
                    <img src={imagePreviewUrl} alt="Ảnh đính kèm" />
                    <div><strong>{imageFile.name}</strong><small>{pendingImageQuestion ? `Đang chờ phản hồi: ${pendingImageQuestion}` : 'Ảnh sẽ được gửi cùng câu hỏi.'}</small></div>
                    <button aria-label="Bỏ ảnh đính kèm" type="button" onClick={clearImageAttachment}>×</button>
                  </div>
                )}

                <form className="ai-workspace-composer" onSubmit={submitAiSearch}>
                  <div className="ai-composer-row">
                    <input
                      id="ai-catalog-query"
                      value={aiQuery}
                      onChange={(event) => setAiQuery(event.target.value)}
                      placeholder={pendingImageQuestion || 'Mô tả nhu cầu, ngân sách hoặc sản phẩm bạn quan tâm...'}
                      maxLength={imageFile ? 300 : 400}
                    />
                    <input ref={imageInputRef} className="visually-hidden" accept="image/jpeg,image/png" capture="environment" type="file" onChange={(event) => selectImage(event.target.files?.[0] ?? null)} />
                    <button className="camera-button" aria-label="Chụp hoặc chọn ảnh" type="button" disabled={aiLoading || aiQuotaExhausted} onClick={() => imageInputRef.current?.click()}>
                      <svg viewBox="0 0 24 24" fill="none"><path d="M8.5 5.5 10 3.5h4l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h3.5Z" /><circle cx="12" cy="12.5" r="4" /></svg>
                    </button>
                    <button className="ai-send-button" disabled={aiLoading || aiQuotaExhausted || (!aiQuery.trim() && !imageFile)}>
                      {aiLoading ? 'Đang tìm' : imageFile ? 'Gửi ảnh' : 'Tìm sản phẩm'}
                    </button>
                  </div>
                  <div className="ai-composer-meta">
                    <span>
                    {aiQuotaUnlimited
                        ? 'Quyền kiểm thử không giới hạn'
                      : aiQuota === null
                          ? '4 lượt mỗi ngày · JPEG/PNG tối đa 8 MB'
                          : `Còn ${aiQuota.remaining}/${aiQuota.limit} lượt hôm nay`}
                    </span>
                    {aiStatus && <strong>{aiStatus}</strong>}
                  </div>
                </form>
              </section>

              <aside className="ai-result-section">
                <header className="ai-panel-heading">
                  <div>
                    <span>Đề xuất sản phẩm</span>
                    <strong>{aiProducts.length ? 'Phù hợp với cuộc trò chuyện' : aiLoading ? 'Đang phân tích yêu cầu' : aiMessages.length ? 'Đang hoàn thiện đề xuất' : 'Sẵn sàng tìm kiếm'}</strong>
                  </div>
                  <small>{aiProducts.length ? `${aiProducts.length} kết quả` : 'Kết quả sẽ cập nhật tại đây'}</small>
                </header>
                <div className="ai-results-scroll">
                  {aiProducts.length > 0 ? (
                    <ProductGrid error="" loading={false} products={aiProducts} onAddToCart={onAddToCart} onViewDetail={(slug) => { setShowAiModal(false); onViewDetail(slug); }} />
                  ) : (
                    <div className={`ai-results-empty${aiLoading ? ' is-searching' : ''}`} aria-live="polite">
                      <div className="ai-result-skeleton-grid" aria-hidden="true">
                        {[0, 1, 2].map((item) => (
                          <article key={item}>
                            <div className="ai-skeleton-image"><span /></div>
                            <i /><i /><i />
                          </article>
                        ))}
                      </div>
                      <div className="ai-result-waiting-copy">
                        <span>{aiLoading ? 'Đang xử lý' : 'AI product matching'}</span>
                        <h3>{aiLoading ? 'Đang đối chiếu nhu cầu với danh mục sản phẩm.' : aiMessages.length ? 'Đang chờ thêm dữ liệu phù hợp từ cuộc trò chuyện.' : 'Kết quả phù hợp sẽ xuất hiện tại đây.'}</h3>
                        <p>{aiLoading ? 'Phân tích nhu cầu, mức giá và tình trạng tồn kho.' : 'Hãy bắt đầu bằng một nhu cầu, khoảng giá hoặc ảnh sản phẩm.'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
