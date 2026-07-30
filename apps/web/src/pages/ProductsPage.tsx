import { useEffect, useRef, useState } from 'react'
import { askAiAboutProducts, getProduct, searchProductsByImage } from '../api'
import { ProductFilters } from '../components/ProductFilters'
import { ProductGrid } from '../components/ProductGrid'
import type {
  AiImageSearchResponse,
  Brand,
  Category,
  Product,
  ProductFilters as Filters,
} from '../types'

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
  token,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / 12))
  const [aiQuery, setAiQuery] = useState('')
  const [aiMessages, setAiMessages] = useState<AiConversationMessage[]>([])
  const [aiProducts, setAiProducts] = useState<Product[]>([])
  const [aiContextProductIds, setAiContextProductIds] = useState<number[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiQuotaRemaining, setAiQuotaRemaining] = useState<number | null>(null)
  const [aiStatus, setAiStatus] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [pendingImageQuestion, setPendingImageQuestion] = useState('')
  const chatHistoryRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

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
    if (aiQuotaRemaining === 0) {
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
        setAiQuotaRemaining(result.data.quota.remaining)
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
        setAiQuotaRemaining(answer.data.quota.remaining)
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
    <main>
      <section className="products-section" id="products">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Danh mục sản phẩm</span>
            <h2>Chọn đúng SKU cho đúng nhu cầu</h2>
            <p>{total} SKU phù hợp với lựa chọn hiện tại.</p>
          </div>
          <button onClick={onResetFilters}>Xem tất cả</button>
        </div>

        <form className="ai-catalog-search" onSubmit={submitAiSearch}>
          <div className="ai-search-heading">
            <div>
              <label htmlFor="ai-catalog-query">Tìm kiếm và tư vấn bằng AI</label>
              <small>Nhập nhu cầu hoặc chụp thiết bị, sau đó hỏi tiếp trong cùng cuộc trò chuyện.</small>
            </div>
            <span className="privacy-note">Ảnh chỉ dùng để tìm kiếm, không lưu lại.</span>
          </div>

          {aiMessages.length > 0 && (
            <div className="ai-chat-history" ref={chatHistoryRef}>
              {aiMessages.map((message, index) => (
                <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}>
                  {message.imageName && (
                    <span className="ai-message-image">
                      <span aria-hidden="true">📷</span>
                      {message.imageName}
                    </span>
                  )}
                  <p>{message.content}</p>

                  {message.imageResult && (
                    <div className={`ai-image-answer ${message.imageResult.decision}`}>
                      <span className="image-decision-badge">
                        {imageDecisionLabels[message.imageResult.decision]}
                      </span>
                      {(message.imageResult.observed.category
                        || message.imageResult.observed.brand
                        || message.imageResult.observed.modelText
                        || message.imageResult.observed.color
                        || message.imageResult.observed.visibleFeatures.length > 0) && (
                        <div className="image-observations">
                          {message.imageResult.observed.category && <span>Loại: {message.imageResult.observed.category}</span>}
                          {message.imageResult.observed.brand && <span>Hãng: {message.imageResult.observed.brand}</span>}
                          {message.imageResult.observed.modelText && <span>Model nhìn thấy: {message.imageResult.observed.modelText}</span>}
                          {message.imageResult.observed.color && <span>Màu: {message.imageResult.observed.color}</span>}
                          {message.imageResult.observed.visibleFeatures.map((feature) => <span key={feature}>{feature}</span>)}
                        </div>
                      )}
                      {message.imageResult.clarifyingQuestion && (
                        <p className="clarifying-question">{message.imageResult.clarifyingQuestion}</p>
                      )}
                      {message.imageResult.uncertaintyReasons.length > 0 && (
                        <small className="uncertainty-note">
                          Chưa chắc chắn vì: {message.imageResult.uncertaintyReasons.join('; ')}.
                        </small>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {imageFile && imagePreviewUrl && (
            <div className="ai-image-attachment">
              <img src={imagePreviewUrl} alt="Ảnh sản phẩm đang đính kèm" />
              <div>
                <strong>{imageFile.name}</strong>
                <small>
                  {pendingImageQuestion
                    ? `AI đang chờ: ${pendingImageQuestion}`
                    : 'Ảnh sẽ được gửi cùng nội dung bạn nhập.'}
                </small>
              </div>
              <button type="button" onClick={clearImageAttachment} aria-label="Bỏ ảnh đính kèm">×</button>
            </div>
          )}

          <div className="ai-composer">
            <input
              id="ai-catalog-query"
              value={aiQuery}
              onChange={(event) => setAiQuery(event.target.value)}
              placeholder={pendingImageQuestion || 'Ví dụ: tìm mẫu này, còn hàng không?'}
              maxLength={imageFile ? 300 : 400}
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
              aria-label="Chụp hoặc chọn ảnh sản phẩm"
              title="Chụp hoặc chọn ảnh"
              disabled={aiLoading || aiQuotaRemaining === 0}
              onClick={() => imageInputRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M8.5 5.5 10 3.5h4l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h3.5Z" />
                <circle cx="12" cy="12.5" r="4" />
              </svg>
            </button>
            <button
              className="ai-send-button"
              disabled={
                aiLoading
                || aiQuotaRemaining === 0
                || (!aiQuery.trim() && !imageFile)
              }
            >
              {aiLoading ? 'AI đang xử lý...' : imageFile ? 'Gửi ảnh' : 'Hỏi AI'}
            </button>
          </div>

          <small className="ai-quota">
            {aiQuotaRemaining === null
              ? 'Tối đa 4 lượt AI mỗi ngày. Hỗ trợ JPEG/PNG tối đa 8 MB.'
              : `Bạn còn ${aiQuotaRemaining}/4 lượt AI hôm nay.`}
          </small>
          {aiStatus && <p className="ai-chat-status">{aiStatus}</p>}
        </form>

        {aiProducts.length > 0 && <div className="ai-result-section"><h3>Sản phẩm AI đang tư vấn</h3><ProductGrid error="" loading={false} products={aiProducts} onAddToCart={onAddToCart} onViewDetail={onViewDetail} /></div>}

        <div className="catalog-layout">
          <ProductFilters
            brands={brands}
            categories={categories}
            filters={filters}
            onChange={onFiltersChange}
            onReset={onResetFilters}
          />
          <div>
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
    </main>
  )
}
