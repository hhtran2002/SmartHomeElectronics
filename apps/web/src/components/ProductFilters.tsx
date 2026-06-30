import type { Brand, Category, ProductFilters as Filters } from '../types'

type Props = {
  brands: Brand[]
  categories: Category[]
  filters: Filters
  onChange: (filters: Filters) => void
  onReset: () => void
}

export function ProductFilters({ brands, categories, filters, onChange, onReset }: Props) {
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch, page: 1 })

  return (
    <aside className="filters-card">
      <div className="filter-header">
        <h3>Bộ lọc</h3>
        <button onClick={onReset}>Xóa lọc</button>
      </div>

      <label>
        Danh mục
        <select value={filters.category} onChange={(event) => update({ category: event.target.value })}>
          <option value="">Tất cả danh mục</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name} ({category.productCount})
            </option>
          ))}
        </select>
      </label>

      <label>
        Thương hiệu
        <select value={filters.brand} onChange={(event) => update({ brand: event.target.value })}>
          <option value="">Tất cả thương hiệu</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.name}>
              {brand.name} ({brand.productCount})
            </option>
          ))}
        </select>
      </label>

      <div className="price-row">
        <label>
          Giá từ
          <input
            inputMode="numeric"
            value={filters.minPrice}
            onChange={(event) => update({ minPrice: event.target.value })}
            placeholder="1.000.000"
          />
        </label>
        <label>
          Giá đến
          <input
            inputMode="numeric"
            value={filters.maxPrice}
            onChange={(event) => update({ maxPrice: event.target.value })}
            placeholder="20.000.000"
          />
        </label>
      </div>
    </aside>
  )
}
