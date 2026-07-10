// import type { FormEvent } from 'react'

// type HeroProps = {
//   search: string
//   onSearchChange: (value: string) => void
//   onSubmit: (event: FormEvent) => void
// }

// export function Hero({ search, onSearchChange, onSubmit }: HeroProps) {
//   return (
//     <section className="hero">
//       <div className="hero-copy">
//         <span className="eyebrow">Không gian thông minh, sống nhẹ tênh</span>
//         <h1>Thiết bị thông minh cho một ngôi nhà hiểu bạn.</h1>
//         <p>
//           Khám phá đồ điện tử gia dụng hiện đại, dễ chọn, dễ dùng và được kết nối trong cùng một trải nghiệm.
//         </p>
//         <form className="search" onSubmit={onSubmit}>
//           <input
//             value={search}
//             onChange={(event) => onSearchChange(event.target.value)}
//             placeholder="Bạn đang tìm thiết bị gì?"
//           />
//           <button>Tìm sản phẩm</button>
//         </form>
//         <div className="trust-row">
//           <span>✓ Bảo hành chính hãng</span>
//           <span>✓ Giao lắp tận nơi</span>
//           <span>✓ Thanh toán an toàn</span>
//         </div>
//       </div>
//       <div className="hero-panel">
//         <span className="online">● Hệ thống đang online</span>
//         <div className="smart-card">
//           <span>✦ Gợi ý thông minh</span>
//           <strong>“Máy lọc không khí cho phòng 30m²”</strong>
//           <p>Tìm theo nhu cầu bằng ngôn ngữ tự nhiên.</p>
//         </div>
//         <div className="mini-stats">
//           <div><strong>20</strong><span>SKU mẫu</span></div>
//           <div><strong>223</strong><span>sản phẩm trong kho</span></div>
//         </div>
//       </div>
//     </section>
//   )
// }
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

type HeroProps = {
  search: string
  onSearchChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}

const banners = [
  'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622176/69e07dafc279aaa5d30aa98cd063df45_ifawu1.png',
  'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622171/8caff3f7d928d7a5ff2cc5802d5588f0_dimd4n.png',
  'https://res.cloudinary.com/dywqgsjss/image/upload/v1783622171/6a32b61c820a82c606eee5810f1089e9_tqszaj.png',
]

export function Hero({ search, onSearchChange, onSubmit }: HeroProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length)
    }, 4000)

    return () => window.clearInterval(timer)
  }, [])

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + banners.length) % banners.length)
  }

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % banners.length)
  }

  return (
    <section className="hero">
      <div className="hero-banner-slider">
        {banners.map((banner, index) => (
          <img
            key={banner}
            src={banner}
            alt={`Banner ${index + 1}`}
            className={index === activeIndex ? 'hero-banner-image active' : 'hero-banner-image'}
          />
        ))}

        <button type="button" className="slider-arrow slider-arrow-left" onClick={goToPrevious}>
          ‹
        </button>

        <button type="button" className="slider-arrow slider-arrow-right" onClick={goToNext}>
          ›
        </button>

        <div className="slider-dots">
          {banners.map((banner, index) => (
            <button
              key={banner}
              type="button"
              className={index === activeIndex ? 'slider-dot active' : 'slider-dot'}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>

        <form className="search hero-search" onSubmit={onSubmit}>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Bạn đang tìm thiết bị gì?"
          />
          <button type="submit">Tìm sản phẩm</button>
        </form>
      </div>
    </section>
  )
}