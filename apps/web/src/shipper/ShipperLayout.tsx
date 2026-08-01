import type { ReactNode } from 'react'
import type { AuthUser } from '../types'

type Props = { children: ReactNode; user: AuthUser | null }

export function ShipperLayout({ children, user }: Props) {
  return (
    <main className="shipper-shell">
      <aside className="shipper-sidebar">
        <div><span className="eyebrow">Khu vực shipper</span><h2>AA Delivery</h2><p>{user?.fullName ?? 'Chưa đăng nhập'}</p></div>
        <nav className="admin-nav"><a className="active" href="#/shipper">Chuyến của tôi</a>{user?.roles.includes('SystemAdmin') && <a href="#/admin/dashboard">Quản trị</a>}</nav>
      </aside>
      <section className="shipper-content">{children}</section>
    </main>
  )
}
