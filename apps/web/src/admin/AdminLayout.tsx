import type { ReactNode } from 'react'
import type { AuthUser } from '../types'

type AdminMenuKey = 'dashboard' | 'orders' | 'products' | 'promotions' | 'reviews' | 'inventory' | 'users' | 'reports'

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
  { key: 'inventory', label: 'Kho hàng', href: '#/admin/inventory' },
  { key: 'users', label: 'Nhân viên', href: '#/admin/users' },
  { key: 'reports', label: 'Báo cáo', href: '#/admin/reports' },
]

export function AdminLayout({ active, children, user }: Props) {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <span className="eyebrow">Admin panel</span>
          <h2>AA Smart</h2>
          <p>{user?.fullName ?? 'Chưa đăng nhập'}</p>
        </div>
        <nav className="admin-nav">
          {menu.map((item) => (
            <a className={active === item.key ? 'active' : ''} href={item.href} key={item.key}>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  )
}
