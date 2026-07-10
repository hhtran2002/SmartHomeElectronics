// import type { FormEvent } from 'react'
// import { Hero } from '../components/Hero'

// type Props = {
//   search: string
//   onSearchChange: (search: string) => void
//   onSubmit: (event: FormEvent) => void
// }

// export function HomePage({ search, onSearchChange, onSubmit }: Props) {
//   return (
//     <main>
//       <Hero search={search} onSearchChange={onSearchChange} onSubmit={onSubmit} />
//       <section className="home-modules">
//         <div>
//           <span className="eyebrow">Module đã sẵn sàng</span>
//           <h2>Trang chủ là mặt tiền, sản phẩm là quầy hàng.</h2>
//           <p>
//             Trang này dùng để giới thiệu hệ thống, điều hướng người dùng vào danh sách sản phẩm,
//             tìm kiếm AI, giỏ hàng và khu vực quản trị khi các module đó được hoàn thiện.
//           </p>
//         </div>
//         <a className="primary-link" href="#/products">Vào trang sản phẩm</a>
//       </section>
//     </main>
//   )
// }

import type { FormEvent } from 'react'
import { Hero } from '../components/Hero'

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

const featuredProducts = [
  {
    name: 'Máy lọc không khí thông minh',
    desc: 'Phù hợp phòng ngủ, phòng khách nhỏ.',
    price: 'Từ 2.990.000đ',
  },
  {
    name: 'Robot hút bụi tự động',
    desc: 'Làm sạch thông minh, điều khiển dễ dàng.',
    price: 'Từ 4.590.000đ',
  },
  {
    name: 'Tivi thông minh 4K',
    desc: 'Hình ảnh sắc nét, kết nối tiện lợi.',
    price: 'Từ 6.990.000đ',
  },
]

const buyingSteps = [
  'Tìm sản phẩm phù hợp',
  'Thêm vào giỏ hàng',
  'Đặt hàng & thanh toán',
  'Nhận hàng tại nhà',
]

export function HomePage({ search, onSearchChange, onSubmit }: Props) {
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

      <section className="ai-search-banner">
        <div>
          <span className="eyebrow">Tìm kiếm AI</span>
          <h2>Tìm sản phẩm bằng cách mô tả nhu cầu của bạn</h2>
          <p>
            Ví dụ: “Tôi cần máy lọc không khí cho phòng ngủ 30m², chạy êm và tiết kiệm điện”.
            Hệ thống sẽ gợi ý sản phẩm phù hợp hơn so với tìm kiếm thông thường.
          </p>
        </div>

        <a className="primary-link light" href="#/ai-search">
          Thử tìm kiếm AI
        </a>
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
          {featuredProducts.map((product) => (
            <article className="product-preview-card" key={product.name}>
              <div className="product-preview-image"></div>
              <div className="product-preview-content">
                <h3>{product.name}</h3>
                <p>{product.desc}</p>
                <strong>{product.price}</strong>
                <a href="#/products">Xem chi tiết</a>
              </div>
            </article>
          ))}
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