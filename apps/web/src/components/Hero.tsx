import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

type HeroProps = {
  search: string
  onSearchChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}

const banners = [
  {
    url: 'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622176/69e07dafc279aaa5d30aa98cd063df45_ifawu1.png',
    title: 'Siêu Hội Điện Tử Gia Dụng 2026',
    subtitle: 'Ưu đãi đến 35% cho các dòng tủ lạnh, máy lọc không khí mới nhất',
  },
  {
    url: 'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622171/8caff3f7d928d7a5ff2cc5802d5588f0_dimd4n.png',
    title: 'Giải Pháp Ngôi Nhà Thông Minh',
    subtitle: 'Tự động hóa không gian sống với AI và kết nối IoT đa nền tảng',
  },
  {
    url: 'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622171/6a32b61c820a82c606eee5810f1089e9_tqszaj.png',
    title: 'Tivi 4K OLED Premium Edition',
    subtitle: 'Đỉnh cao giải trí tại gia với hình ảnh chân thực & âm thanh vòm',
  },
]

const searchPills = [
  '🌬️ Máy lọc không khí',
  '🤖 Robot hút bụi',
  '📺 Tivi OLED 4K',
  '🍳 Nồi chiên không dầu',
  '🧊 Tủ lạnh Inverter',
]

export function Hero({ search, onSearchChange, onSubmit }: HeroProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length)
    }, 4500)

    return () => window.clearInterval(timer)
  }, [])

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + banners.length) % banners.length)
  }

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % banners.length)
  }

  const handlePillClick = (term: string) => {
    const cleanTerm = term.replace(/^[^\w\s\u00C0-\u1EF9]+/u, '').trim()
    onSearchChange(cleanTerm)
  }

  return (
    <section className="hero-2026">
      <div className="hero-grid">
        {/* Left Column: Content & Search */}
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-pulse"></span>
            <span>✦ HỆ THỐNG ĐIỆN TỬ GIA DỤNG THÔNG MINH 2026</span>
          </div>

          <h1 className="hero-title">
            Không Gian Thông Minh,<br />
            <span className="hero-title-gradient">Sống Nâng Tầm Mới</span>
          </h1>

          <p className="hero-subtitle">
            Khám phá thiết bị điện tử hiện đại tích hợp trợ lý AI tư vấn cá nhân hóa — dễ chọn, dễ mua, giao và lắp đặt tận nơi.
          </p>

          <form className="hero-search-box" onSubmit={onSubmit}>
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Bạn đang tìm thiết bị gì cho ngôi nhà?"
                className="hero-search-input"
              />
            </div>
            <button type="submit" className="hero-search-btn">
              <span>Tìm kiếm</span>
              <span className="btn-arrow">→</span>
            </button>
          </form>

          {/* Quick AI Search Suggestions */}
          <div className="hero-pills">
            <span className="pills-label">Gợi ý hot:</span>
            <div className="pills-list">
              {searchPills.map((pill) => (
                <button
                  key={pill}
                  type="button"
                  className="pill-item"
                  onClick={() => handlePillClick(pill)}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          {/* Key Metrics Strip */}
          <div className="hero-stats-row">
            <div className="hero-stat-item">
              <strong>100%</strong>
              <span>Chính hãng</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <strong>24/7</strong>
              <span>AI Tư vấn</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <strong>2H</strong>
              <span>Giao siêu tốc</span>
            </div>
            <div className="hero-stat-divider"></div>
            <div className="hero-stat-item">
              <strong>4.9★</strong>
              <span>Đánh giá 5 sao</span>
            </div>
          </div>
        </div>

        {/* Right Column: Slider & Floating Card */}
        <div className="hero-visual">
          <div className="hero-slider-card">
            <div className="slider-wrapper">
              {banners.map((banner, index) => (
                <div
                  key={banner.url}
                  className={`slider-slide ${index === activeIndex ? 'active' : ''}`}
                >
                  <img src={banner.url} alt={banner.title} className="slide-image" />
                  <div className="slide-overlay">
                    <h3>{banner.title}</h3>
                    <p>{banner.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="hero-slider-arrow prev" onClick={goToPrevious} aria-label="Slide trước">
              ‹
            </button>
            <button type="button" className="hero-slider-arrow next" onClick={goToNext} aria-label="Slide sau">
              ›
            </button>

            <div className="hero-slider-dots">
              {banners.map((banner, index) => (
                <button
                  key={banner.url}
                  type="button"
                  className={`dot ${index === activeIndex ? 'active' : ''}`}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            {/* Floating Glass Badges */}
            <div className="floating-badge top-right">
              <span className="badge-icon">🔥</span>
              <div>
                <strong>Flash Sale 2026</strong>
                <small>Giảm tới 35% hôm nay</small>
              </div>
            </div>

            <div className="floating-badge bottom-left">
              <span className="badge-icon">🤖</span>
              <div>
                <strong>AI Smart Search</strong>
                <small>Tìm theo hình ảnh & nhu cầu</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}