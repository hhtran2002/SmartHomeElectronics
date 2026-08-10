import type { ReactNode } from 'react'
import type { AuthUser } from '../types'
import './AdminTheme.css'

type AdminMenuKey = 'dashboard' | 'orders' | 'products' | 'promotions' | 'reviews' | 'returns' | 'inventory' | 'shipper' | 'cod' | 'users' | 'reports'

type Props = {
  active: AdminMenuKey
  children: ReactNode
  user: AuthUser | null
}

const menu: Array<{ key: AdminMenuKey; label: string; href: string }> = [
  { key: 'dashboard', label: 'Dashboard', href: '#/admin/dashboard' },
  { key: 'orders', label: 'Đơn hàng', href: '#/admin/orders' },
  { key: 'products', label: 'Sản phẩm', href: '#/admin/products' },
  { key: 'promotions', label: 'Khuyến mãi', href: '#/admin/promotions' },
  { key: 'reviews', label: 'Đánh giá', href: '#/admin/reviews' },
  { key: 'returns', label: 'Hoàn hàng', href: '#/admin/returns' },
  { key: 'inventory', label: 'Kho hàng', href: '#/warehouse' },
  { key: 'shipper', label: 'Giao hàng', href: '#/shipper' },
  { key: 'cod', label: 'Đối soát COD', href: '#/admin/cod-remittances' },
  { key: 'users', label: 'Nhân viên', href: '#/admin/users' },
  { key: 'reports', label: 'Báo cáo', href: '#/admin/reports' },
]

export function AdminLayout({ active, children, user }: Props) {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-head">
          <span className="admin-workspace-label">AA Smart · Operations</span>
          <div className="admin-account">
            <span>{(user?.fullName ?? 'A').trim().charAt(0).toUpperCase()}</span>
            <div>
              <strong>{user?.fullName ?? 'Chưa đăng nhập'}</strong>
              <small>Quản trị hệ thống</small>
            </div>
          </div>
        </div>
        <p className="admin-nav-label">Điều hành</p>
        <nav className="admin-nav">
          {menu.map((item) => (
            <a className={active === item.key ? 'active' : ''} href={item.href} key={item.key}>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <section className="admin-content">
        <div className="admin-content-inner">{children}</div>
      </section>
    </main>
  )
}
