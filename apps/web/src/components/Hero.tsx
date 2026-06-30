import type { FormEvent } from 'react'

type HeroProps = {
  search: string
  onSearchChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}

export function Hero({ search, onSearchChange, onSubmit }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">Không gian thông minh, sống nhẹ tênh</span>
        <h1>Thiết bị thông minh cho một ngôi nhà hiểu bạn.</h1>
        <p>
          Khám phá đồ điện tử gia dụng hiện đại, dễ chọn, dễ dùng và được kết nối trong cùng một trải nghiệm.
        </p>
        <form className="search" onSubmit={onSubmit}>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Bạn đang tìm thiết bị gì?"
          />
          <button>Tìm sản phẩm</button>
        </form>
        <div className="trust-row">
          <span>✓ Bảo hành chính hãng</span>
          <span>✓ Giao lắp tận nơi</span>
          <span>✓ Thanh toán an toàn</span>
        </div>
      </div>
      <div className="hero-panel">
        <span className="online">● Hệ thống đang online</span>
        <div className="smart-card">
          <span>✦ Gợi ý thông minh</span>
          <strong>“Máy lọc không khí cho phòng 30m²”</strong>
          <p>Tìm theo nhu cầu bằng ngôn ngữ tự nhiên.</p>
        </div>
        <div className="mini-stats">
          <div><strong>20</strong><span>SKU mẫu</span></div>
          <div><strong>223</strong><span>sản phẩm trong kho</span></div>
        </div>
      </div>
    </section>
  )
}
