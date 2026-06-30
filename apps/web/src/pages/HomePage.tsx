import type { FormEvent } from 'react'
import { Hero } from '../components/Hero'

type Props = {
  search: string
  onSearchChange: (search: string) => void
  onSubmit: (event: FormEvent) => void
}

export function HomePage({ search, onSearchChange, onSubmit }: Props) {
  return (
    <main>
      <Hero search={search} onSearchChange={onSearchChange} onSubmit={onSubmit} />
      <section className="home-modules">
        <div>
          <span className="eyebrow">Module đã sẵn sàng</span>
          <h2>Trang chủ là mặt tiền, sản phẩm là quầy hàng.</h2>
          <p>
            Trang này dùng để giới thiệu hệ thống, điều hướng người dùng vào danh sách sản phẩm,
            tìm kiếm AI, giỏ hàng và khu vực quản trị khi các module đó được hoàn thiện.
          </p>
        </div>
        <a className="primary-link" href="#/products">Vào trang sản phẩm</a>
      </section>
    </main>
  )
}
