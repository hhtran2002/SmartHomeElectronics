import { useState } from 'react'
import type { FormEvent } from 'react'
import { imageAiSearch, semanticAiSearch } from '../api'
import { ProductGrid } from '../components/ProductGrid'
import type { Product } from '../types'

type Props = {
  onAddToCart: (product: Product) => void
  onViewDetail: (slug: string) => void
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'))

    reader.readAsDataURL(file)
  })
}

export function AiSearchPage({ onAddToCart, onViewDetail }: Props) {
  const [query, setQuery] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'semantic' | 'image'>('semantic')

  async function handleSemanticSearch(event: FormEvent) {
    event.preventDefault()

    const keyword = query.trim()

    if (!keyword) {
      setError('Nhập nhu cầu tìm kiếm trước nhé. Ví dụ: máy lọc không khí cho phòng ngủ nhỏ')
      return
    }

    setMode('semantic')
    setLoading(true)
    setError('')

    try {
      const payload = await semanticAiSearch(keyword)
      setProducts(payload.data)
      setTotal(payload.total)
    } catch {
      setError('Chưa gọi được AI Search. Kiểm tra apps/ai và apps/api đã chạy chưa.')
    } finally {
      setLoading(false)
    }
  }

  async function handleImageSearch(event: FormEvent) {
    event.preventDefault()

    if (!imageFile) {
      setError('Chọn một ảnh sản phẩm trước khi tìm bằng hình ảnh.')
      return
    }

    setMode('image')
    setLoading(true)
    setError('')

    try {
      const imageBase64 = await fileToBase64(imageFile)
      const payload = await imageAiSearch(imageBase64)

      setProducts(payload.data)
      setTotal(payload.total)
    } catch {
      setError('Chưa tìm được bằng hình ảnh. Lưu ý ảnh sản phẩm trong hệ thống nên là URL http/https để AI đọc được.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <section className="products-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">AI Search</span>
            <h2>Tìm kiếm sản phẩm thông minh</h2>
            <p>
              Tìm theo nhu cầu tự nhiên hoặc tải ảnh sản phẩm để hệ thống gợi ý mặt hàng gần nhất.
            </p>
          </div>
        </div>

        <div className="ai-search-panel">
          <form className="ai-search-box" onSubmit={handleSemanticSearch}>
            <label>
              Tìm kiếm ngữ nghĩa
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ví dụ: máy giặt cho gia đình đông người, tủ lạnh tiết kiệm điện..."
              />
            </label>

            <button disabled={loading}>Tìm bằng AI</button>
          </form>

          <form className="ai-search-box" onSubmit={handleImageSearch}>
            <label>
              Tìm kiếm bằng hình ảnh
              <input
                accept="image/*"
                type="file"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              />
            </label>

            <button disabled={loading}>Tìm bằng ảnh</button>
          </form>
        </div>

        <div className="section-heading compact-heading">
          <div>
            <h3>
              {mode === 'semantic' ? 'Kết quả tìm kiếm ngữ nghĩa' : 'Kết quả tìm kiếm hình ảnh'}
            </h3>
            <p>{total} sản phẩm phù hợp.</p>
          </div>
        </div>

        <ProductGrid
          error={error}
          loading={loading}
          products={products}
          onAddToCart={onAddToCart}
          onViewDetail={onViewDetail}
        />
      </section>
    </main>
  )
}