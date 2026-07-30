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
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [aiProducts, setAiProducts] = useState<Product[]>([])
  const [aiContextProductIds, setAiContextProductIds] = useState<number[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiQuotaRemaining, setAiQuotaRemaining] = useState<number | null>(null)
  const [aiStatus, setAiStatus] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [imageClarification, setImageClarification] = useState('')
  const [imageContextProductIds, setImageContextProductIds] = useState<number[]>([])
  const [imageLoading, setImageLoading] = useState(false)
  const [imageProducts, setImageProducts] = useState<Product[]>([])
  const [imageResult, setImageResult] = useState<AiImageSearchResponse['data'] | null>(null)
  const [imageStatus, setImageStatus] = useState('')
  const chatHistoryRef = useRef<HTMLDivElement>(null)

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

  async function submitAiSearch(event: React.FormEvent) {
    event.preventDefault()
    if (!aiQuery.trim() || aiLoading) return
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
    const question = aiQuery.trim()
    setAiQuery('')
    setAiMessages((current) => [...current, { role: 'user', content: question }])
    try {
      const answer = await askAiAboutProducts(question, aiMessages.slice(-4), aiContextProductIds, token)
      setAiMessages((current) => [...current, { role: 'assistant', content: answer.data.answer }])
      setAiContextProductIds(answer.data.productIds)
      setAiQuotaRemaining(answer.data.quota.remaining)
      const details = await Promise.all(answer.data.products.map((product) => getProduct(product.slug)))
      setAiProducts(details.map((item) => item.data))
    } catch (error) {
      setAiStatus(error instanceof Error ? error.message : 'Chưa thể tư vấn bằng AI. Vui lòng thử lại sau.')
    } finally {
      setAiLoading(false)
    }
  }

  function selectImage(file: File | null) {
    setImageStatus('')
    setImageResult(null)
    setImageProducts([])
    setImageContextProductIds([])
    setImageClarification('')

    if (!file) {
      setImageFile(null)
      return
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setImageFile(null)
      setImageStatus('Vui lòng chọn ảnh JPEG hoặc PNG.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageFile(null)
      setImageStatus('Ảnh chỉ được lớn tối đa 8 MB.')
      return
    }

    setImageFile(file)
  }

  async function submitImageSearch(event: React.FormEvent) {
    event.preventDefault()
    if (!imageFile || imageLoading) return
    if (!token) {
      setImageStatus('Bạn cần đăng nhập để tìm sản phẩm bằng ảnh.')
      return
    }
    if (aiQuotaRemaining === 0) {
      setImageStatus('Bạn đã dùng hết 4 lượt AI hôm nay.')
      return
    }

    setImageLoading(true)
    setImageStatus('')
    try {
      const result = await searchProductsByImage(
        imageFile,
        imageClarification,
        imageContextProductIds,
        token,
      )
      setImageResult(result.data)
      setImageContextProductIds(result.data.productIds)
      setAiQuotaRemaining(result.data.quota.remaining)
      setImageClarification('')
      const details = await Promise.all(result.data.products.map((product) => getProduct(product.slug)))
      setImageProducts(details.map((item) => item.data))
    } catch (error) {
      setImageStatus(error instanceof Error ? error.message : 'Chưa thể tìm sản phẩm bằng ảnh.')
    } finally {
      setImageLoading(false)
    }
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
          <label htmlFor="ai-catalog-query">Tư vấn bằng AI</label>
          <div>
            <input id="ai-catalog-query" value={aiQuery} onChange={(event) => setAiQuery(event.target.value)} placeholder="Ví dụ: máy lọc không khí cho nhà 1 người, giá dưới 10 triệu" maxLength={400} />
            <button disabled={aiLoading || aiQuotaRemaining === 0}>{aiLoading ? 'Đang tìm...' : 'Hỏi AI'}</button>
          </div>
          <small className="ai-quota">{aiQuotaRemaining === null ? 'Tối đa 4 lượt tư vấn AI mỗi ngày.' : `Bạn còn ${aiQuotaRemaining}/4 lượt tư vấn AI hôm nay.`}</small>
          {aiStatus && <p className="ai-chat-status">{aiStatus}</p>}
          {aiMessages.length > 0 && <div className="ai-chat-history" ref={chatHistoryRef}>{aiMessages.map((message, index) => <p className={message.role} key={`${message.role}-${index}`}><strong>{message.role === 'user' ? 'Bạn' : 'AI'}:</strong> {message.content}</p>)}</div>}
        </form>

        {aiProducts.length > 0 && <div className="ai-result-section"><h3>Gợi ý từ AI</h3><ProductGrid error="" loading={false} products={aiProducts} onAddToCart={onAddToCart} onViewDetail={onViewDetail} /></div>}

        <section className="image-search-panel">
          <div className="image-search-heading">
            <div>
              <span className="eyebrow">Tìm bằng hình ảnh</span>
              <h3>Chụp thiết bị bạn thích, AI sẽ tìm mẫu gần giống trong shop</h3>
              <p>AI không tự khẳng định đúng model khi ảnh thiếu logo, tem máy hoặc đặc điểm nhận dạng.</p>
            </div>
            <span className="privacy-note">Ảnh chỉ được xử lý để tìm kiếm, không lưu lại.</span>
          </div>

          <form className="image-search-form" onSubmit={submitImageSearch}>
            <label className={`image-upload-box ${imagePreviewUrl ? 'has-image' : ''}`}>
              {imagePreviewUrl ? (
                <img src={imagePreviewUrl} alt="Ảnh sản phẩm cần tìm" />
              ) : (
                <span>
                  <strong>Chọn hoặc chụp ảnh</strong>
                  <small>JPEG/PNG, tối đa 8 MB</small>
                </span>
              )}
              <input
                accept="image/jpeg,image/png"
                capture="environment"
                type="file"
                onChange={(event) => selectImage(event.target.files?.[0] ?? null)}
              />
            </label>

            <div className="image-search-controls">
              {imageResult?.decision === 'need_clarification' && (
                <label>
                  {imageResult.clarifyingQuestion}
                  <input
                    maxLength={300}
                    placeholder="Nhập đặc điểm bạn quan sát được..."
                    value={imageClarification}
                    onChange={(event) => setImageClarification(event.target.value)}
                  />
                </label>
              )}

              <button
                disabled={
                  !imageFile
                  || imageLoading
                  || aiQuotaRemaining === 0
                  || (imageResult?.decision === 'need_clarification' && !imageClarification.trim())
                }
              >
                {imageLoading
                  ? 'AI đang đối chiếu...'
                  : imageResult?.decision === 'need_clarification'
                    ? 'Gửi thông tin bổ sung'
                    : 'Tìm sản phẩm từ ảnh'}
              </button>
              <small>
                {aiQuotaRemaining === null
                  ? 'Dùng chung giới hạn 4 lượt AI mỗi ngày.'
                  : `Bạn còn ${aiQuotaRemaining}/4 lượt AI hôm nay.`}
              </small>
              {imageStatus && <p className="ai-chat-status">{imageStatus}</p>}
            </div>
          </form>

          {imageResult && (
            <div className={`image-search-result ${imageResult.decision}`}>
              <span className="image-decision-badge">{imageDecisionLabels[imageResult.decision]}</span>
              <p>{imageResult.answer}</p>

              {(imageResult.observed.category
                || imageResult.observed.brand
                || imageResult.observed.modelText
                || imageResult.observed.color
                || imageResult.observed.visibleFeatures.length > 0) && (
                <div className="image-observations">
                  {imageResult.observed.category && <span>Loại: {imageResult.observed.category}</span>}
                  {imageResult.observed.brand && <span>Hãng: {imageResult.observed.brand}</span>}
                  {imageResult.observed.modelText && <span>Model nhìn thấy: {imageResult.observed.modelText}</span>}
                  {imageResult.observed.color && <span>Màu: {imageResult.observed.color}</span>}
                  {imageResult.observed.visibleFeatures.map((feature) => <span key={feature}>{feature}</span>)}
                </div>
              )}

              {imageResult.decision === 'need_clarification' && (
                <p className="clarifying-question">{imageResult.clarifyingQuestion}</p>
              )}
              {imageResult.uncertaintyReasons.length > 0 && (
                <small className="uncertainty-note">
                  Chưa chắc chắn vì: {imageResult.uncertaintyReasons.join('; ')}.
                </small>
              )}
            </div>
          )}
        </section>

        {imageProducts.length > 0 && (
          <div className="ai-result-section">
            <h3>Sản phẩm đối chiếu từ ảnh</h3>
            <ProductGrid error="" loading={false} products={imageProducts} onAddToCart={onAddToCart} onViewDetail={onViewDetail} />
          </div>
        )}

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
