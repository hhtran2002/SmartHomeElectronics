import type { Product } from '../types'
import { ProductCard } from './ProductCard'

type Props = {
  error: string
  loading: boolean
  products: Product[]
  onAddToCart: (product: Product) => void
  onViewDetail: (slug: string) => void
}

export function ProductGrid({ error, loading, products, onAddToCart, onViewDetail }: Props) {
  if (loading) return <div className="status-card">Đang tải sản phẩm từ SQL Server…</div>
  if (error) return <div className="status-card error">{error}</div>
  if (products.length === 0) {
    return (
      <div className="status-card">
        <span className="empty-icon">⌁</span>
        <h3>Không tìm thấy sản phẩm phù hợp</h3>
        <p>Thử đổi từ khóa, danh mục hoặc khoảng giá nhé.</p>
      </div>
    )
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
          onViewDetail={onViewDetail}
        />
      ))}
    </div>
  )
}
