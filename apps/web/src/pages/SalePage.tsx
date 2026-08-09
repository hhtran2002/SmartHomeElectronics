import { useEffect, useState } from 'react'
import { getProducts } from '../api'
import type { Product, ProductFilters } from '../types'

type Props = {
  onAddToCart: (product: Product) => void
  onViewDetail: (slug: string) => void
}

const ITEMS_PER_PAGE = 12

const initialFilters: ProductFilters = {
  search: '',
  category: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  page: 1,
  onSale: true,
}

function formatPrice(price: number | null | undefined) {
  if (price == null) return '—'
  return price.toLocaleString('vi-VN') + 'đ'
}

function calcDiscountPercent(original: number | null | undefined, final: number | null | undefined) {
  if (!original || !final || final >= original) return null
  return Math.round(((original - final) / original) * 100)
}

function SaleProductCard({
  product,
  onAddToCart,
  onViewDetail,
}: {
  product: Product
  onAddToCart: (product: Product) => void
  onViewDetail: (slug: string) => void
}) {
  const discountPct = calcDiscountPercent(product.originalPrice, product.finalPrice)
  const displayPrice = product.finalPrice ?? product.price
  const isOutOfStock = product.availableQuantity <= 0

  return (
    <article className="sale-product-card" onClick={() => onViewDetail(product.slug)}>
      <div className="sale-card-image-wrap">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="sale-card-image" />
        ) : (
          <div className="sale-card-image-placeholder">📦</div>
        )}
        {discountPct && (
          <span className="sale-card-badge">-{discountPct}%</span>
        )}
        {product.promotionName && (
          <span className="sale-card-promo-label">{product.promotionName}</span>
        )}
      </div>

      <div className="sale-card-body">
        <p className="sale-card-category">
          {product.categoryName} · {product.brandName}
        </p>
        <h3 className="sale-card-name">{product.name}</h3>
        {product.description && (
          <p className="sale-card-desc">{product.description}</p>
        )}

        <div className="sale-card-pricing">
          {product.originalPrice && product.finalPrice && product.finalPrice < product.originalPrice ? (
            <>
              <span className="sale-card-original">{formatPrice(product.originalPrice)}</span>
              <span className="sale-card-final">{formatPrice(product.finalPrice)}</span>
            </>
          ) : (
            <span className="sale-card-final">{formatPrice(displayPrice)}</span>
          )}
        </div>

        <div className="sale-card-footer">
          {isOutOfStock ? (
            <span className="sale-card-out">Hết hàng</span>
          ) : (
            <span className="sale-card-stock">Còn {product.availableQuantity}</span>
          )}
          <button
            className="sale-card-add-btn"
            disabled={isOutOfStock}
            onClick={(e) => {
              e.stopPropagation()
              onAddToCart(product)
            }}
          >
            Thêm
          </button>
        </div>
      </div>
    </article>
  )
}

export function SalePage({ onAddToCart, onViewDetail }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<'discount' | 'price_asc' | 'price_desc'>('discount')

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))

  useEffect(() => {
    setLoading(true)
    setError('')
    void getProducts({ ...initialFilters, search, page })
      .then((payload) => {
        setProducts(payload.data)
        setTotal(payload.total)
      })
      .catch(() => setError('Chưa tải được danh sách sản phẩm giảm giá.'))
      .finally(() => setLoading(false))
  }, [search, page])

  // Client-side sort
  const sorted = [...products].sort((a, b) => {
    if (sortMode === 'discount') {
      const discA = calcDiscountPercent(a.originalPrice, a.finalPrice) ?? 0
      const discB = calcDiscountPercent(b.originalPrice, b.finalPrice) ?? 0
      return discB - discA
    }
    if (sortMode === 'price_asc') {
      return (a.finalPrice ?? a.price ?? 0) - (b.finalPrice ?? b.price ?? 0)
    }
    return (b.finalPrice ?? b.price ?? 0) - (a.finalPrice ?? a.price ?? 0)
  })

  return (
    <main>
      {/* Hero Banner */}
      <div className="sale-hero">
        <div className="sale-hero-inner">
          <div className="sale-hero-badge">🔥 HOT DEAL</div>
          <h1 className="sale-hero-title">Siêu Giảm Giá</h1>
          <p className="sale-hero-sub">
            Hàng trăm sản phẩm điện tử đang được giảm giá sốc — chỉ có trong thời gian ngắn!
          </p>
          <div className="sale-hero-stats">
            <div className="sale-stat">
              <strong>{total}</strong>
              <span>sản phẩm đang sale</span>
            </div>
            <div className="sale-stat-divider" />
            <div className="sale-stat">
              <strong>Đến -70%</strong>
              <span>giảm giá tối đa</span>
            </div>
            <div className="sale-stat-divider" />
            <div className="sale-stat">
              <strong>Miễn phí</strong>
              <span>vận chuyển</span>
            </div>
          </div>
        </div>
        <div className="sale-hero-decoration" aria-hidden="true">
          <span>%</span>
        </div>
      </div>

      {/* Toolbar */}
      <section className="sale-section">
        <div className="sale-toolbar">
          <input
            className="sale-search"
            type="text"
            placeholder="🔍  Tìm sản phẩm đang giảm giá..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <div className="sale-sort">
            <span className="sale-sort-label">Sắp xếp:</span>
            {(['discount', 'price_asc', 'price_desc'] as const).map((mode) => (
              <button
                key={mode}
                className={`sale-sort-btn${sortMode === mode ? ' active' : ''}`}
                onClick={() => setSortMode(mode)}
              >
                {mode === 'discount' ? '% Giảm nhiều nhất' : mode === 'price_asc' ? 'Giá tăng dần' : 'Giá giảm dần'}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="sale-loading">
            <div className="sale-spinner" />
            <p>Đang tải sản phẩm giảm giá...</p>
          </div>
        ) : error ? (
          <div className="sale-error">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="sale-empty">
            <span>🛍️</span>
            <p>Hiện không có sản phẩm nào đang giảm giá{search ? ` cho "${search}"` : ''}.</p>
          </div>
        ) : (
          <>
            <p className="sale-result-count">
              Tìm thấy <strong>{total}</strong> sản phẩm đang giảm giá
              {search ? ` cho "${search}"` : ''}
            </p>
            <div className="sale-grid">
              {sorted.map((product) => (
                <SaleProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                  onViewDetail={onViewDetail}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="sale-pagination">
              <button
                className="sale-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Trang trước
              </button>
              <span className="sale-page-info">Trang {page} / {totalPages}</span>
              <button
                className="sale-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau →
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
