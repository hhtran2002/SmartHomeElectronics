import type { FormEvent } from 'react'

type HeroProps = {
  search: string
  onSearchChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  imageUrl?: string | null
}

const suggestions = ['Máy lọc không khí', 'Robot hút bụi', 'Tivi OLED', 'Tủ lạnh Inverter']

export function Hero({ search, onSearchChange, onSubmit, imageUrl }: HeroProps) {
  return (
    <section className="editorial-hero">
      <div className="editorial-hero-copy">
        <p className="editorial-kicker">Thiết bị cho đời sống hiện đại</p>
        <h1><span>Chọn công nghệ</span><span>phù hợp với</span><span>cách bạn sống.</span></h1>
        <p className="editorial-lead">
          Những thiết bị gia dụng đáng tin cậy, được tuyển chọn rõ ràng và giao lắp tận nơi.
        </p>

        <form className="editorial-search" onSubmit={onSubmit}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Bạn đang tìm sản phẩm gì?"
            aria-label="Tìm kiếm sản phẩm"
          />
          <button type="submit">Tìm kiếm</button>
        </form>

        <div className="editorial-suggestions" aria-label="Tìm kiếm phổ biến">
          <span>Phổ biến</span>
          {suggestions.map((item) => (
            <button type="button" key={item} onClick={() => onSearchChange(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <a className="editorial-hero-visual" href="#/sale" aria-label="Khám phá ưu đãi nổi bật">
        {imageUrl ? (
          <img src={imageUrl} alt="Sản phẩm điện tử gia dụng nổi bật" />
        ) : (
          <div className="editorial-visual-placeholder"><span>AA Smart</span><strong>Home essentials</strong></div>
        )}
        <div className="editorial-visual-caption">
          <div>
            <span>Bộ sưu tập tháng 8</span>
            <strong>Công nghệ tốt hơn cho ngôi nhà</strong>
          </div>
          <span className="editorial-arrow">↗</span>
        </div>
      </a>
    </section>
  )
}
