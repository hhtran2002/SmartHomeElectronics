import type { ReactNode } from 'react'
import type { AuthUser } from '../types'

type Props = {
  active: 'inventory' | 'deliveries'
  children: ReactNode
  user: AuthUser | null
}

const menu = [
  { key: 'inventory', label: 'Kho hàng', href: '#/warehouse' },
  { key: 'deliveries', label: 'Bàn giao', href: '#/warehouse/deliveries' },
] as const

export function WarehouseLayout({ active, children, user }: Props) {
  return (
    <main className="admin-shell operations-shell">
      <aside className="admin-sidebar warehouse-sidebar">
        <div>
          <span className="eyebrow">Khu vực thủ kho</span>
          <h2>AA Warehouse</h2>
          <p>{user?.fullName ?? 'Chưa đăng nhập'}</p>
        </div>
        <nav className="admin-nav">
          {menu.map((item) => (
            <a className={active === item.key ? 'active' : ''} href={item.href} key={item.key}>
              {item.label}
            </a>
          ))}
          {user?.roles.includes('SystemAdmin') && <a href="#/admin/dashboard">Quản trị</a>}
        </nav>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  )
}
