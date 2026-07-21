import { useEffect, useRef, useState } from 'react'
import { askAiAboutProducts, getProduct } from '../api'
import { ProductFilters } from '../components/ProductFilters'
import { ProductGrid } from '../components/ProductGrid'
import type { Brand, Category, Product, ProductFilters as Filters } from '../types'

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
  const chatHistoryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatHistoryRef.current?.scrollTo({ top: chatHistoryRef.current.scrollHeight, behavior: 'smooth' })
  }, [aiMessages])

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
