import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Hero } from '../components/Hero'
import type { Product } from '../types'
import { getProducts } from '../api'
import { formatPrice } from '../utils'

type Props = {
  search: string
  onSearchChange: (search: string) => void
  onSubmit: (event: FormEvent) => void
}

const benefits = [
  {
    title: 'Sản phẩm chính hãng',
    desc: 'Thiết bị điện tử gia dụng thông minh từ các thương hiệu uy tín.',
  },
  {
    title: 'Giao hàng tận nơi',
    desc: 'Hỗ trợ giao hàng nhanh, an toàn và đúng hẹn cho khách hàng.',
  },
  {
    title: 'Thanh toán tiện lợi',
    desc: 'Hỗ trợ nhiều phương thức thanh toán phù hợp với nhu cầu mua sắm.',
  },
  {
    title: 'Bảo hành rõ ràng',
    desc: 'Chính sách bảo hành minh bạch, giúp khách hàng yên tâm sử dụng.',
  },
]

const categories = [
  {
    title: 'Máy lọc không khí',
    desc: 'Không gian sống trong lành hơn mỗi ngày.',
  },
  {
    title: 'Robot hút bụi',
    desc: 'Tự động làm sạch, tiết kiệm thời gian.',
  },
  {
    title: 'Tivi thông minh',
    desc: 'Giải trí sắc nét cho cả gia đình.',
  },
  {
    title: 'Thiết bị nhà bếp',
    desc: 'Nấu nướng tiện lợi, hiện đại hơn.',
  },
]

const buyingSteps = [
  'Tìm sản phẩm phù hợp',
  'Thêm vào giỏ hàng',
  'Đặt hàng & thanh toán',
  'Nhận hàng tại nhà',
]

export function HomePage({ search, onSearchChange, onSubmit }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProducts({ search: '', category: '', brand: '', minPrice: '', maxPrice: '', page: 1 })
      .then((res) => {
        setProducts(res.data.slice(0, 3))
      })
      .catch((err) => {
        console.error('Failed to load home products:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return (
    <main className="home-page">
      <Hero search={search} onSearchChange={onSearchChange} onSubmit={onSubmit} />

      <section className="customer-benefits">
        {benefits.map((item) => (
          <article className="benefit-card" key={item.title}>
            <div className="benefit-icon">✓</div>
            <div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="customer-section">
        <div className="section-heading">
          <span className="eyebrow">Danh mục nổi bật</span>
          <h2>Khám phá thiết bị thông minh cho ngôi nhà của bạn</h2>
          <p>
            Lựa chọn nhanh các nhóm sản phẩm điện tử gia dụng được khách hàng quan tâm nhiều nhất.
          </p>
        </div>

        <div className="category-grid">
          {categories.map((category) => (
            <a className="category-card" href="#/products" key={category.title}>
              <div className="category-image-placeholder"></div>
              <h3>{category.title}</h3>
              <p>{category.desc}</p>
              <span>Xem sản phẩm →</span>
            </a>
          ))}
        </div>
      </section>

      <section className="customer-section">
        <div className="section-heading section-heading-row">
          <div>
            <span className="eyebrow">Gợi ý hôm nay</span>
            <h2>Sản phẩm nổi bật</h2>
            <p>Một số thiết bị thông minh phù hợp cho gia đình hiện đại.</p>
          </div>

          <a className="text-link" href="#/products">
            Xem tất cả →
          </a>
        </div>

        <div className="product-preview-grid">
          {loading ? (
            <div className="status-card" style={{ gridColumn: 'span 3', padding: '30px' }}>
              Đang tải sản phẩm nổi bật...
            </div>
          ) : products.length === 0 ? (
            <div className="status-card" style={{ gridColumn: 'span 3', padding: '30px' }}>
              Chưa có sản phẩm nổi bật.
            </div>
          ) : (
            products.map((product) => {
              const displayPrice = product.finalPrice ?? product.price ?? product.basePrice
              return (
                <article className="product-preview-card" key={product.id}>
                  <div className="product-preview-image">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} />
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '48px', color: '#0ea5e9' }}>⌂</span>
                    )}
                  </div>
                  <div className="product-preview-content">
                    <h3>{product.name}</h3>
                    <p style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {product.description ?? 'Thiết bị gia dụng thông minh dành cho ngôi nhà hiện đại.'}
                    </p>
                    <strong>{formatPrice(displayPrice)}</strong>
                    <a href={`#/products/${encodeURIComponent(product.slug)}`}>Xem chi tiết</a>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>

      <section className="buying-process">
        <div className="section-heading">
          <span className="eyebrow">Mua hàng dễ dàng</span>
          <h2>Quy trình mua sắm đơn giản</h2>
        </div>

        <div className="step-grid">
          {buyingSteps.map((step, index) => (
            <article className="step-card" key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="customer-cta">
        <div>
          <span className="eyebrow">AA Smart</span>
          <h2>Bắt đầu mua sắm thiết bị thông minh ngay hôm nay</h2>
          <p>
            Khám phá các sản phẩm điện tử gia dụng hiện đại, dễ sử dụng và phù hợp với nhu cầu của
            gia đình bạn.
          </p>
        </div>

        <a className="primary-link light" href="#/products">
          Vào trang sản phẩm
        </a>
      </section>
    </main>
  )
}
