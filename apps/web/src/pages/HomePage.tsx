import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Hero } from '../components/Hero'
import type { Category, Product } from '../types'
import { getCategories, getProducts } from '../api'
import { formatPrice } from '../utils'

type Props = {
  search: string
  onSearchChange: (search: string) => void
  onSubmit: (event: FormEvent) => void
}

const trustBadges = [
  {
    icon: '🛡️',
    title: '100% Chính Hãng',
    desc: 'Bảo hành chính hãng 12-36 tháng, 1-đổi-1 trong 30 ngày.',
  },
  {
    icon: '⚡',
    title: 'Giao Nhanh 2H',
    desc: 'Miễn phí giao hàng & hỗ trợ lắp đặt chuyên nghiệp tại nhà.',
  },
  {
    icon: '💳',
    title: 'Thanh Toán Linh Hoạt',
    desc: 'Hỗ trợ COD, chuyển khoản, ví điện tử & trả góp 0% lãi suất.',
  },
  {
    icon: '🤖',
    title: 'Trợ Lý AI 24/7',
    desc: 'Tư vấn cá nhân hóa theo diện tích phòng & ngân sách thực tế.',
  },
]

const categoryPresets = [
  {
    slug: 'may-loc-khong-khi',
    icon: '🌬️',
    title: 'Máy Lọc Không Khí',
    desc: 'Lọc sạch bụi mịn PM2.5, khử mùi & diệt khuẩn cho không gian sống trong lành.',
    gradient: 'from-blue-500 to-cyan-400',
  },
  {
    slug: 'robot-hut-bui',
    icon: '🤖',
    title: 'Robot Hút Bụi & Lau Nhà',
    desc: 'Tự động quét dọn, lập bản đồ 3D thông minh & tự động giặt sấy giẻ lau.',
    gradient: 'from-purple-500 to-indigo-500',
  },
  {
    slug: 'tivi-thong-minh',
    icon: '📺',
    title: 'Tivi 4K OLED / QLED',
    desc: 'Trải nghiệm điện ảnh đỉnh cao với màu sắc rực rỡ & âm thanh vòm sống động.',
    gradient: 'from-amber-500 to-red-500',
  },
  {
    slug: 'thiet-bi-nha-bep',
    icon: '🍳',
    title: 'Thiết Bị Nhà Bếp',
    desc: 'Nồi chiên không dầu, lò vi sóng & tủ lạnh Inverter tiết kiệm điện tối đa.',
    gradient: 'from-emerald-500 to-teal-500',
  },
]

const roomSolutions = [
  {
    id: 'living-room',
    name: '🛋️ Phòng Khách Thông Minh',
    desc: 'Không gian giải trí đỉnh cao & bầu không khí trong lành cho cả gia đình.',
    highlights: ['Tivi 4K OLED HDR', 'Máy lọc không khí HEPA 360°', 'Robot hút bụi 3D LiDAR'],
  },
  {
    id: 'kitchen',
    name: '🍳 Căn Bếp Tiện Nghi',
    desc: 'Nấu nướng hiện đại, nhanh chóng & giữ nguyên chất dinh dưỡng cho món ăn.',
    highlights: ['Tủ lạnh Inverter 4 cửa', 'Nồi chiên cảm ứng 8L', 'Lò vi sóng đối lưu'],
  },
  {
    id: 'bedroom',
    name: '🛏️ Phòng Ngủ Thư Giãn',
    desc: 'Giấc ngủ ngon hơn với nhiệt độ chuẩn xác & ánh sáng thông minh tự điều chỉnh.',
    highlights: ['Đèn ngủ đổi màu AI', 'Máy bù ẩm khử khuẩn', 'Điều hòa Inverter siêu êm'],
  },
]

const partnerBrands = [
  { name: 'SAMSUNG', logo: 'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622171/8caff3f7d928d7a5ff2cc5802d5588f0_dimd4n.png' },
  { name: 'LG ELECTRONICS', logo: 'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622176/69e07dafc279aaa5d30aa98cd063df45_ifawu1.png' },
  { name: 'PHILIPS', logo: 'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622171/6a32b61c820a82c606eee5810f1089e9_tqszaj.png' },
  { name: 'XIAOMI', logo: 'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622171/8caff3f7d928d7a5ff2cc5802d5588f0_dimd4n.png' },
  { name: 'TOSHIBA', logo: 'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622176/69e07dafc279aaa5d30aa98cd063df45_ifawu1.png' },
  { name: 'AQUA', logo: 'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622171/6a32b61c820a82c606eee5810f1089e9_tqszaj.png' },
]

const customerReviews = [
  {
    id: 1,
    name: 'Nguyễn Văn Minh',
    role: 'Khách hàng tại Hà Nội',
    avatar: '👨‍💼',
    rating: 5,
    comment: 'Tôi dùng AI Search tìm máy lọc không khí cho phòng ngủ 25m2, AI tư vấn rất sát nhu cầu. Đặt buổi sáng 10h là 11h30 nhân viên đã mang máy đến lắp tận phòng!',
    purchasedProduct: 'Máy lọc không khí Philips AC0950/10',
  },
  {
    id: 2,
    name: 'Trần Thị Thu Hà',
    role: 'Khách hàng tại TP.HCM',
    avatar: '👩‍🏫',
    rating: 5,
    comment: 'Sản phẩm chính hãng, đóng gói cẩn thận. Rất ấn tượng với tính năng tìm sản phẩm bằng hình ảnh, chỉ cần chụp cái tivi cũ là AI đề xuất đúng dòng nâng cấp.',
    purchasedProduct: 'Smart Tivi Samsung 4K 55 inch',
  },
  {
    id: 3,
    name: 'Lê Hoàng Nam',
    role: 'Khách hàng tại Đà Nẵng',
    avatar: '👨‍💻',
    rating: 5,
    comment: 'Trang web đẹp, dễ mua sắm. Thích nhất dịch vụ bảo hành 1-đổi-1 và miễn phí giao hàng. Sẽ tiếp tục ủng hộ AA Smart trong các dự án nhà thông minh tới.',
    purchasedProduct: 'Robot hút bụi lau nhà Xiaomi Dreame',
  },
]

const buyingSteps = [
  {
    num: '01',
    title: 'Tìm Kiếm & Hỏi AI',
    desc: 'Nhập tên thiết bị hoặc mô tả nhu cầu thực tế để Trợ lý AI gợi ý chuẩn xác.',
  },
  {
    num: '02',
    title: 'Chọn Sản Phẩm & Mã Giảm Giá',
    desc: 'So sánh cấu hình, chọn mã khuyến mãi Flash Sale để nhận ưu đãi tối đa.',
  },
  {
    num: '03',
    title: 'Xác Nhận & Thanh Toán',
    desc: 'Lựa chọn COD, chuyển khoản hoặc trả góp 0% nhanh chóng, an toàn.',
  },
  {
    num: '04',
    title: 'Giao Hàng & Lắp Đặt 2H',
    desc: 'Kỹ thuật viên giao máy, hỗ trợ kết nối ứng dụng & nghiệm thu tại nhà.',
  },
]

export function HomePage({ search, onSearchChange, onSubmit }: Props) {
  const [saleProducts, setSaleProducts] = useState<Product[]>([])
  const [popularProducts, setPopularProducts] = useState<Product[]>([])
  const [dbCategories, setDbCategories] = useState<Category[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'sale' | 'new'>('all')
  const [activeRoom, setActiveRoom] = useState<string>('living-room')
  const [loading, setLoading] = useState(true)

  // Countdown timer for Flash Sale
  const [timeLeft, setTimeLeft] = useState({ hours: 7, minutes: 42, seconds: 18 })

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 }
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 }
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 }
        return { hours: 12, minutes: 0, seconds: 0 }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getProducts({ search: '', category: '', brand: '', minPrice: '', maxPrice: '', page: 1, onSale: true }),
      getProducts({ search: '', category: '', brand: '', minPrice: '', maxPrice: '', page: 1 }),
      getCategories().catch(() => ({ data: [] })),
    ])
      .then(([saleRes, popularRes, catRes]) => {
        setSaleProducts(saleRes.data.slice(0, 4))
        setPopularProducts(popularRes.data.slice(0, 8))
        if (catRes.data && catRes.data.length > 0) {
          setDbCategories(catRes.data)
        }
      })
      .catch((err) => {
        console.error('Failed to load homepage data:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const filteredProducts = popularProducts.filter((prod) => {
    if (activeTab === 'sale') return prod.promotionId != null || prod.finalPrice != null
    return true
  })

  return (
    <main className="home-page-2026">
      {/* 1. Hero Banner & Modern Search Bar */}
      <Hero search={search} onSearchChange={onSearchChange} onSubmit={onSubmit} />

      {/* 2. Trust Badges Strip */}
      <section className="home-trust-strip">
        <div className="trust-grid">
          {trustBadges.map((badge) => (
            <div className="trust-card" key={badge.title}>
              <span className="trust-icon">{badge.icon}</span>
              <div className="trust-info">
                <h4>{badge.title}</h4>
                <p>{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Flash Sale / Hot Deals Section */}
      <section className="home-section flash-sale-section">
        <div className="section-header-modern">
          <div className="header-left">
            <div className="flash-title-wrap">
              <span className="flash-flame">🔥</span>
              <h2>FLASH SALE HÔM NAY</h2>
              <span className="flash-badge-live">ĐANG GIẢM GIÁ SỐC</span>
            </div>
            <p className="section-subtext">Cơ hội sở hữu thiết bị điện tử cao cấp với giá ưu đãi đặc quyền.</p>
          </div>

          <div className="header-right">
            <div className="countdown-box">
              <span className="countdown-label">Kết thúc sau:</span>
              <div className="countdown-digits">
                <span>{String(timeLeft.hours).padStart(2, '0')}</span>:
                <span>{String(timeLeft.minutes).padStart(2, '0')}</span>:
                <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
              </div>
            </div>

            <a href="#/sale" className="view-all-sale-btn">
              <span>Xem tất cả Deal Giảm Giá</span>
              <span>→</span>
            </a>
          </div>
        </div>

        {/* Flash Sale Product Cards Grid */}
        <div className="flash-sale-grid">
          {loading ? (
            <div className="home-skeleton-loader">
              <div className="spinner"></div>
              <span>Đang tải các chương trình giảm giá...</span>
            </div>
          ) : saleProducts.length === 0 ? (
            <div className="home-empty-deals">
              <p>Hiện chưa có chương trình Flash Sale. Mời bạn khám phá danh mục sản phẩm!</p>
            </div>
          ) : (
            saleProducts.map((product) => {
              const origPrice = product.originalPrice ?? product.price ?? product.basePrice
              const finalPrice = product.finalPrice ?? origPrice
              const discountPercent =
                origPrice > finalPrice ? Math.round(((origPrice - finalPrice) / origPrice) * 100) : null

              return (
                <div className="sale-card-2026" key={product.id}>
                  {discountPercent && <div className="sale-badge-pill">-{discountPercent}%</div>}

                  <div className="sale-card-img-wrap">
                    <img
                      src={
                        product.imageUrl ||
                        'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622176/69e07dafc279aaa5d30aa98cd063df45_ifawu1.png'
                      }
                      alt={product.name}
                    />
                  </div>

                  <div className="sale-card-details">
                    <span className="sale-category">{product.categoryName || 'Điện tử gia dụng'}</span>
                    <h3 className="sale-title">{product.name}</h3>

                    <div className="sale-price-row">
                      <span className="current-price">{formatPrice(finalPrice)}</span>
                      {origPrice > finalPrice && <span className="old-price">{formatPrice(origPrice)}</span>}
                    </div>

                    <div className="stock-progress-bar">
                      <div className="progress-fill" style={{ width: '75%' }}></div>
                      <span className="progress-text">🔥 Sắp hết hàng</span>
                    </div>

                    <a href={`#/products/${encodeURIComponent(product.slug)}`} className="sale-buy-btn">
                      Xem Chi Tiết →
                    </a>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* 4. Smart Featured Categories */}
      <section className="home-section categories-section">
        <div className="section-header-centered">
          <span className="section-eyebrow">DANH MỤC NỔI BẬT</span>
          <h2>Khám Phá Thiết Bị Cho Ngôi Nhà Của Bạn</h2>
          <p>Danh mục điện tử gia dụng thông minh được tìm kiếm & lựa chọn nhiều nhất trong năm 2026.</p>
        </div>

        <div className="category-cards-grid">
          {categoryPresets.map((cat) => {
            // Find dbCategory match if available
            const dbMatch = dbCategories.find(
              (c) => c.slug === cat.slug || c.name.toLowerCase().includes(cat.title.toLowerCase()),
            )
            const targetHash = dbMatch ? `#/products?category=${encodeURIComponent(dbMatch.slug)}` : '#/products'

            return (
              <a href={targetHash} className="cat-card-2026" key={cat.title}>
                <div className="cat-card-header">
                  <span className="cat-icon">{cat.icon}</span>
                  <span className="cat-arrow">→</span>
                </div>
                <h3>{cat.title}</h3>
                <p>{cat.desc}</p>
                <div className="cat-card-footer">
                  <span className="cat-explore-link">Khám phá sản phẩm</span>
                </div>
              </a>
            )
          })}
        </div>
      </section>

      {/* 5. AI Smart Shopping Assistant Highlight Banner */}
      <section className="home-section ai-banner-section">
        <div className="ai-glass-banner">
          <div className="ai-banner-content">
            <div className="ai-tag">
              <span className="sparkle">✨</span>
              <span>TRỢ LÝ TƯ VẤN AI THÔNG MINH</span>
            </div>

            <h2>Tìm Sản Phẩm Đúng Ý Chỉ Trong Vài Giây</h2>

            <p>
              Không còn loay hoay lọc thông số phức tạp. Trợ lý AI tích hợp RAG & Tìm kiếm bằng hình ảnh của AA Smart
              sẽ thấu hiểu nhu cầu của bạn và gợi ý sản phẩm chuẩn xác nhất từ hệ thống.
            </p>

            <div className="ai-features-grid">
              <div className="ai-feature-box">
                <span className="feat-icon">💬</span>
                <div>
                  <strong>Hỏi Đáp Tự Nhiên</strong>
                  <p>Ví dụ: "Tìm máy lọc không khí khử mùi tốt cho phòng 30m² có em bé"</p>
                </div>
              </div>

              <div className="ai-feature-box">
                <span className="feat-icon">📸</span>
                <div>
                  <strong>Tìm Kiếm Bằng Hình Ảnh</strong>
                  <p>Chụp hoặc tải ảnh thiết bị bất kỳ → AI tự nhận diện & đề xuất mẫu tương thích</p>
                </div>
              </div>
            </div>

            <div className="ai-action-group">
              <a href="#/products" className="ai-cta-primary">
                🚀 Trải Nghiệm AI Search Ngay
              </a>
              <span className="ai-quota-hint">✓ Miễn phí 4 lượt tư vấn AI mỗi ngày cho khách hàng</span>
            </div>
          </div>

          <div className="ai-banner-graphic">
            <div className="chat-demo-card">
              <div className="chat-demo-header">
                <span className="bot-avatar">🤖</span>
                <div>
                  <strong>AA Smart AI Assistant</strong>
                  <small>● Đang hoạt động</small>
                </div>
              </div>

              <div className="chat-demo-body">
                <div className="chat-bubble user">
                  "Phòng ngủ 20m² nên dùng robot hút bụi nào êm và tự giặt giẻ?"
                </div>
                <div className="chat-bubble bot">
                  "Chào bạn! Với phòng 20m², shop gợi ý mẫu <strong>Robot Xiaomi Dreame Bot</strong> với độ ồn &lt;
                  58dB, tự động sấy khô giẻ lau khử khuẩn. Hiện đang có sẵn tại kho!"
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Trending Products Grid */}
      <section className="home-section trending-products-section">
        <div className="section-header-tabbed">
          <div>
            <span className="section-eyebrow">SẢN PHẨM BÁN CHẠY</span>
            <h2>Thiết Bị Điện Tử Đáng Mua Nhất</h2>
          </div>

          <div className="product-tab-buttons">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Tất Cả Sản Phẩm
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'sale' ? 'active' : ''}`}
              onClick={() => setActiveTab('sale')}
            >
              🔥 Đang Giảm Giá
            </button>
          </div>
        </div>

        <div className="trending-grid-2026">
          {loading ? (
            <div className="home-skeleton-loader" style={{ gridColumn: 'span 4' }}>
              <div className="spinner"></div>
              <span>Đang tải danh sách sản phẩm...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="home-empty-deals" style={{ gridColumn: 'span 4' }}>
              <p>Chưa có sản phẩm phù hợp bộ lọc.</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const displayPrice = product.finalPrice ?? product.price ?? product.basePrice
              const origPrice = product.originalPrice ?? product.price ?? product.basePrice
              const hasDiscount = origPrice > displayPrice

              return (
                <div className="product-card-2026" key={product.id}>
                  {hasDiscount && <div className="card-badge-discount">Sale</div>}

                  <div className="card-thumb-wrap">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} loading="lazy" />
                    ) : (
                      <div className="card-thumb-placeholder">⌂</div>
                    )}
                  </div>

                  <div className="card-body-2026">
                    <div className="card-category-brand">
                      <span>{product.categoryName || 'Điện thoại & Đồ gia dụng'}</span>
                    </div>

                    <h3 className="card-title-2026">
                      <a href={`#/products/${encodeURIComponent(product.slug)}`}>{product.name}</a>
                    </h3>

                    <p className="card-snippet">
                      {product.description || 'Thiết bị gia dụng cao cấp mang lại sự thoải mái & hiện đại.'}
                    </p>

                    <div className="card-rating-row">
                      <span className="stars">★★★★★</span>
                      <span className="rating-score">4.9 (42)</span>
                    </div>

                    <div className="card-price-block">
                      <span className="main-price">{formatPrice(displayPrice)}</span>
                      {hasDiscount && <span className="sub-price">{formatPrice(origPrice)}</span>}
                    </div>

                    <div className="card-action-btns">
                      <a href={`#/products/${encodeURIComponent(product.slug)}`} className="btn-detail">
                        Xem Chi Tiết
                      </a>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="see-more-footer">
          <a href="#/products" className="btn-see-more-catalog">
            Xem Toàn Bộ Catalog Sản Phẩm ({popularProducts.length}+) →
          </a>
        </div>
      </section>

      {/* 7. Smart Home Solutions by Room */}
      <section className="home-section room-solutions-section">
        <div className="section-header-centered">
          <span className="section-eyebrow">GIẢI PHÁP KHÔNG GIAN</span>
          <h2>Gói Thiết Bị Theo Phòng Phù Hợp Cho Bạn</h2>
          <p>Tối ưu hóa công năng và tính thẩm mỹ cho từng căn phòng trong ngôi nhà của bạn.</p>
        </div>

        <div className="room-tabs-nav">
          {roomSolutions.map((room) => (
            <button
              key={room.id}
              type="button"
              className={`room-nav-btn ${activeRoom === room.id ? 'active' : ''}`}
              onClick={() => setActiveRoom(room.id)}
            >
              {room.name}
            </button>
          ))}
        </div>

        <div className="room-solution-card">
          {(() => {
            const currentRoom = roomSolutions.find((r) => r.id === activeRoom) || roomSolutions[0]
            return (
              <div className="room-card-inner">
                <div className="room-card-info">
                  <h3>{currentRoom.name}</h3>
                  <p>{currentRoom.desc}</p>

                  <div className="room-highlights-list">
                    <h4>Bộ thiết bị khuyến nghị bao gồm:</h4>
                    <ul>
                      {currentRoom.highlights.map((item) => (
                        <li key={item}>
                          <span className="check-bullet">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a href="#/products" className="room-cta-btn">
                    Khám phá thiết bị cho không gian này →
                  </a>
                </div>

                <div className="room-card-banner">
                  <div className="room-glass-box">
                    <span className="room-badge">⚡ Trọn bộ giải pháp 2026</span>
                    <strong>Lắp Đặt Trọn Gói Trong 24H</strong>
                    <p>Bảo hành chính hãng 1-đổi-1 & hỗ trợ kỹ thuật định kỳ tận nhà.</p>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* 8. Partner Brands Logos */}
      <section className="home-section brands-strip-section">
        <div className="brands-container">
          <span className="brands-title">THƯƠNG HIỆU ĐỒNG HÀNH CHÍNH HÃNG</span>
          <div className="brands-logo-row">
            {partnerBrands.map((brand) => (
              <div className="brand-logo-card" key={brand.name}>
                <span>{brand.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Customer Testimonials */}
      <section className="home-section testimonials-section">
        <div className="section-header-centered">
          <span className="section-eyebrow">ĐÁNH GIÁ TỪ KHÁCH HÀNG</span>
          <h2>15.000+ Khách Hàng Hài Lòng Về AA Smart</h2>
          <p>Sự tin tưởng của quý khách là niềm tự hào và động lực để chúng tôi mang lại trải nghiệm tốt nhất.</p>
        </div>

        <div className="testimonials-grid">
          {customerReviews.map((rev) => (
            <div className="testimonial-card-2026" key={rev.id}>
              <div className="testi-header">
                <span className="testi-avatar">{rev.avatar}</span>
                <div>
                  <strong>{rev.name}</strong>
                  <small>{rev.role}</small>
                </div>
                <span className="testi-stars">★★★★★</span>
              </div>
              <p className="testi-comment">"{rev.comment}"</p>
              <div className="testi-product-tag">
                <span>🛒 Đã mua: {rev.purchasedProduct}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 10. Ordering Process 4-Steps */}
      <section className="home-section buying-process-2026">
        <div className="section-header-centered">
          <span className="section-eyebrow">QUY TRÌNH ĐƠN GIẢN</span>
          <h2>Mua Sắm Nhanh Chóng Với 4 Bước</h2>
        </div>

        <div className="steps-row-2026">
          {buyingSteps.map((step) => (
            <div className="step-box-2026" key={step.num}>
              <div className="step-number">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 11. Footer CTA Newsletter Banner */}
      <section className="home-section cta-banner-section">
        <div className="cta-banner-glass">
          <div className="cta-content">
            <span className="cta-badge">⚡ ƯU ĐÃI THÀNH VIÊN MỚI</span>
            <h2>Sẵn Sàng Nâng Cấp Ngôi Nhà Của Bạn?</h2>
            <p>Khám phá bộ sưu tập thiết bị điện tử gia dụng thông minh 2026 ngay hôm nay cùng nhiều ưu đãi hấp dẫn.</p>
          </div>

          <div className="cta-actions">
            <a href="#/products" className="btn-cta-white">
              Vào Trang Sản Phẩm →
            </a>
            <a href="#/sale" className="btn-cta-outline">
              Săn Deal Giảm Giá 🔥
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
