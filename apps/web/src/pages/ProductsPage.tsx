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
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / 12))

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
