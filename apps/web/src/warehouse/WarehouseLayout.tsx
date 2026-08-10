import type { ReactNode } from 'react'
import type { AuthUser } from '../types'
import '../admin/AdminTheme.css'

type Props = {
  active: 'inventory' | 'deliveries'
  children: ReactNode
  user: AuthUser | null
}

const menu = [
  { key: 'inventory', label: 'Kho hàng', href: '#/warehouse' },
  { key: 'deliveries', label: 'Xuất kho đơn hàng', href: '#/warehouse/deliveries' },
] as const

export function WarehouseLayout({ active, children, user }: Props) {
  return (
    <main className="admin-shell operations-shell">
      <aside className="admin-sidebar warehouse-sidebar">
        <div className="admin-sidebar-head">
          <span className="admin-workspace-label">AA Smart · Warehouse</span>
          <div className="admin-account">
            <span>{(user?.fullName ?? 'W').trim().charAt(0).toUpperCase()}</span>
            <div><strong>{user?.fullName ?? 'Chưa đăng nhập'}</strong><small>Vận hành kho</small></div>
          </div>
        </div>
        <p className="admin-nav-label">Kho vận</p>
        <nav className="admin-nav">
          {menu.map((item) => (
            <a className={active === item.key ? 'active' : ''} href={item.href} key={item.key}>
              {item.label}
            </a>
          ))}
          {user?.roles.includes('SystemAdmin') && <a href="#/admin/dashboard">Quản trị</a>}
        </nav>
      </aside>
      <section className="admin-content"><div className="admin-content-inner">{children}</div></section>
    </main>
  )
}
