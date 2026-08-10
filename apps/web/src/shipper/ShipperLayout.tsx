import type { ReactNode } from 'react'
import type { AuthUser } from '../types'
import '../admin/AdminTheme.css'

type Props = { active: 'shipments' | 'cod'; children: ReactNode; user: AuthUser | null }

export function ShipperLayout({ active, children, user }: Props) {
  return (
    <main className="admin-shell shipper-shell operations-shell">
      <aside className="admin-sidebar shipper-sidebar">
        <div className="admin-sidebar-head">
          <span className="admin-workspace-label">AA Smart · Delivery</span>
          <div className="admin-account">
            <span>{(user?.fullName ?? 'D').trim().charAt(0).toUpperCase()}</span>
            <div><strong>{user?.fullName ?? 'Chưa đăng nhập'}</strong><small>Nhân viên giao vận</small></div>
          </div>
        </div>
        <p className="admin-nav-label">Giao nhận</p>
        <nav className="admin-nav">
          <a className={active === 'shipments' ? 'active' : ''} href="#/shipper">Chuyến của tôi</a>
          <a className={active === 'cod' ? 'active' : ''} href="#/shipper/cod">Tiền COD</a>
          {user?.roles.includes('SystemAdmin') && <a href="#/admin/dashboard">Quản trị</a>}
        </nav>
      </aside>
      <section className="admin-content shipper-content"><div className="admin-content-inner">{children}</div></section>
    </main>
  )
}
