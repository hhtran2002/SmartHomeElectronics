import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Hero } from '../components/Hero'
import type { Category, Product } from '../types'
import { getCategories, getProducts } from '../api'
import { formatPrice } from '../utils'
import './HomePage.css'

type Props = {
  search: string
  onSearchChange: (search: string) => void
  onSubmit: (event: FormEvent) => void
}

const categoryPresets = [
  { slug: 'may-loc-khong-khi', title: 'Không khí trong lành', label: 'Máy lọc không khí' },
  { slug: 'robot-hut-bui', title: 'Chăm sóc sàn nhà', label: 'Robot hút bụi' },
  { slug: 'tivi-thong-minh', title: 'Giải trí tại gia', label: 'Tivi thông minh' },
  { slug: 'thiet-bi-nha-bep', title: 'Gian bếp tiện nghi', label: 'Thiết bị nhà bếp' },
]

const brands = ['SAMSUNG', 'LG', 'PHILIPS', 'XIAOMI', 'TOSHIBA', 'AQUA']

function priceOf(product: Product) {
  return product.finalPrice ?? product.price ?? product.basePrice
}

function originalPriceOf(product: Product) {
  return product.originalPrice ?? product.price ?? product.basePrice
}

function ProductTile({ product, featured = false }: { product: Product; featured?: boolean }) {
  const price = priceOf(product)
  const originalPrice = originalPriceOf(product)
  const hasDiscount = originalPrice > price

  return (
    <article className={`editorial-product${featured ? ' featured' : ''}`}>
      <a className="editorial-product-image" href={`#/products/${encodeURIComponent(product.slug)}`}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading={featured ? 'eager' : 'lazy'} />
        ) : (
          <span>AA</span>
        )}
        {hasDiscount && <small>Ưu đãi</small>}
      </a>
      <div className="editorial-product-info">
        <p>{product.categoryName || product.brandName || 'Thiết bị gia dụng'}</p>
        <h3><a href={`#/products/${encodeURIComponent(product.slug)}`}>{product.name}</a></h3>
        <div className="editorial-price">
          <strong>{formatPrice(price)}</strong>
          {hasDiscount && <del>{formatPrice(originalPrice)}</del>}
        </div>
      </div>
    </article>
  )
}

export function HomePage({ search, onSearchChange, onSubmit }: Props) {
  const [saleProducts, setSaleProducts] = useState<Product[]>([])
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [dbCategories, setDbCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getProducts({ search: '', category: '', brand: '', minPrice: '', maxPrice: '', page: 1, onSale: true }),
      getProducts({ search: '', category: '', brand: '', minPrice: '', maxPrice: '', page: 1 }),
      getCategories().catch(() => ({ data: [] })),
    ])
      .then(([saleRes, popularRes, catRes]) => {
        setSaleProducts(saleRes.data.slice(0, 5))
        setPopularProducts(popularRes.data.slice(0, 4))
        setDbCategories(catRes.data || [])
      })
      .catch((error) => console.error('Failed to load homepage data:', error))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="editorial-home">
      <div className="editorial-container">
        <Hero
          search={search}
          onSearchChange={onSearchChange}
          onSubmit={onSubmit}
          imageUrl={saleProducts[0]?.imageUrl || popularProducts[0]?.imageUrl}
        />

        <section className="editorial-promises" aria-label="Cam kết dịch vụ">
          <p><strong>Chính hãng</strong><span>Bảo hành minh bạch</span></p>
          <p><strong>Giao lắp tận nơi</strong><span>Nhanh trong 2 giờ</span></p>
          <p><strong>Thanh toán linh hoạt</strong><span>Hỗ trợ trả góp 0%</span></p>
          <p><strong>Tư vấn đúng nhu cầu</strong><span>Đồng hành trước và sau mua</span></p>
        </section>

        <section className="editorial-section editorial-categories">
          <header className="editorial-section-heading">
            <div>
              <p>Khám phá theo không gian</p>
              <h2>Mọi thứ ngôi nhà cần,<br />được chọn lọc kỹ hơn.</h2>
            </div>
            <a href="#/products">Xem tất cả sản phẩm <span>→</span></a>
          </header>

          <div className="editorial-category-list">
            {categoryPresets.map((category, index) => {
              const match = dbCategories.find((item) => item.slug === category.slug)
              const href = match ? `#/products?category=${encodeURIComponent(match.slug)}` : '#/products'
              return (
                <a href={href} key={category.slug}>
                  <span>0{index + 1}</span>
                  <div><small>{category.label}</small><strong>{category.title}</strong></div>
                  <b>↗</b>
                </a>
              )
            })}
          </div>
        </section>

        <section className="editorial-section editorial-deals">
          <header className="editorial-section-heading compact">
            <div>
              <p>Giá tốt hôm nay</p>
              <h2>Ưu đãi đáng chú ý</h2>
            </div>
            <a href="#/sale">Xem tất cả ưu đãi <span>→</span></a>
          </header>

          {loading ? (
            <div className="editorial-loading">Đang chuẩn bị sản phẩm cho bạn…</div>
          ) : saleProducts.length ? (
            <div className="editorial-deal-grid">
              {saleProducts.map((product, index) => (
                <ProductTile key={product.id} product={product} featured={index === 0} />
              ))}
            </div>
          ) : (
            <div className="editorial-loading">Ưu đãi mới đang được cập nhật.</div>
          )}
        </section>

        <section className="editorial-ai">
          <div className="editorial-ai-copy">
            <p>Tư vấn thông minh</p>
            <h2>Không cần hiểu hết thông số để chọn đúng.</h2>
            <span>
              Chỉ cần mô tả căn phòng, thói quen và ngân sách. AA Smart sẽ rút gọn hàng trăm lựa chọn thành vài gợi ý thực sự phù hợp.
            </span>
            <a href="#/products">Thử tìm kiếm thông minh <b>→</b></a>
          </div>
          <div className="editorial-ai-example">
            <small>BẠN CÓ THỂ HỎI</small>
            <blockquote>“Phòng ngủ 20m², cần máy lọc không khí chạy êm và an toàn cho trẻ nhỏ.”</blockquote>
            <p><span>AA</span> Mình sẽ ưu tiên độ ồn thấp, cảm biến bụi mịn và bộ lọc dễ thay thế.</p>
          </div>
        </section>

        <section className="editorial-section editorial-new">
          <header className="editorial-section-heading compact">
            <div>
              <p>Được quan tâm nhiều</p>
              <h2>Lựa chọn của khách hàng</h2>
            </div>
            <a href="#/products">Mở catalog <span>→</span></a>
          </header>
          {loading ? (
            <div className="editorial-loading">Đang tải sản phẩm…</div>
          ) : (
            <div className="editorial-product-row">
              {popularProducts.map((product) => <ProductTile key={product.id} product={product} />)}
            </div>
          )}
        </section>

        <section className="editorial-brands" aria-label="Thương hiệu chính hãng">
          <p>Đối tác chính hãng</p>
          <div>{brands.map((brand) => <span key={brand}>{brand}</span>)}</div>
        </section>

        <section className="editorial-closing">
          <p>Giao nhanh. Lắp đặt chuẩn. Hỗ trợ lâu dài.</p>
          <h2>Một nơi đáng tin cậy cho mọi nâng cấp trong ngôi nhà.</h2>
          <div>
            <a href="#/products">Khám phá sản phẩm</a>
            <a href="#/sale">Xem ưu đãi hôm nay</a>
          </div>
        </section>
      </div>
    </main>
  )
}
