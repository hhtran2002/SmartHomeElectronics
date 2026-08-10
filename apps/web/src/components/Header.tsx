import { useEffect, useRef, useState } from 'react'
import type { AuthUser } from '../types'

type HeaderProps = {
  activePage?: 'home' | 'products' | 'sale' | 'cart' | 'auth' | 'admin'
  cartCount?: number
  user?: AuthUser | null
  onLogout?: () => void
}

const logoUrl =
  'https://res.cloudinary.com/dywqgsjss/image/upload/v1783623432/2f7cba59-c005-42fd-813f-3efef503409a_tdqvk7.png'

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 4h2l2.1 9.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="19" r="1.6" fill="currentColor" />
      <circle cx="17" cy="19" r="1.6" fill="currentColor" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M4.5 20a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M14 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 12H9"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type WorkspaceLink = {
  href: string
  label: string
  description: string
}

function getWorkspaceLinks(roles: string[]): WorkspaceLink[] {
  const links: WorkspaceLink[] = []

  if (roles.includes('SystemAdmin')) {
    links.push({ href: '#/admin/dashboard', label: 'Trang quản trị', description: 'Điều hành toàn hệ thống' })
  } else if (roles.includes('OrderAdmin')) {
    links.push({ href: '#/admin/dashboard', label: 'Quản lý đơn hàng', description: 'Theo dõi đơn và báo cáo' })
  }

  if (roles.includes('CustomerSupport') && !roles.includes('SystemAdmin')) {
    links.push({ href: '#/admin/reviews', label: 'Chăm sóc khách hàng', description: 'Đánh giá và yêu cầu hỗ trợ' })
  }

  if (roles.includes('WarehouseStaff') || roles.includes('SystemAdmin')) {
    links.push({ href: '#/warehouse', label: 'Khu vực thủ kho', description: 'Tồn kho và bàn giao hàng' })
  }

  if (roles.includes('DeliveryStaff') || roles.includes('SystemAdmin')) {
    links.push({ href: '#/shipper', label: 'Khu vực giao hàng', description: 'Chuyến giao và tiền COD' })
  }

  return links
}

export function Header({ activePage = 'home', cartCount = 0, user, onLogout }: HeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const workspaceLinks = user ? getWorkspaceLinks(user.roles) : []

  useEffect(() => {
    if (!accountMenuOpen) return

    function closeOnOutsideClick(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountMenuOpen(false)
    }

    function closeOnRouteChange() {
      setAccountMenuOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('hashchange', closeOnRouteChange)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('hashchange', closeOnRouteChange)
    }
  }, [accountMenuOpen])

  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="#/" aria-label="AA Smart">
          <img className="brand-logo" src={logoUrl} alt="AA Smart" />
        </a>

        <nav className="main-nav">
          <a className={activePage === 'home' ? 'active' : ''} href="#/">
            Trang chủ
          </a>
          <a className={activePage === 'products' ? 'active' : ''} href="#/products">
            Sản phẩm
          </a>
          <a className={`nav-sale-link${activePage === 'sale' ? ' active' : ''}`} href="#/sale">
            Giảm giá
          </a>
        </nav>

        <div className="header-actions">
          <a className={`cart-button ${activePage === 'cart' ? 'active' : ''}`} href="#/cart">
            <span className="button-icon">
              <CartIcon />
            </span>
            <span className="cart-count">{cartCount}</span>
          </a>

          {user ? (
            <div className="account-menu" ref={accountMenuRef}>
              <button
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                className={`auth-chip account-menu-trigger${accountMenuOpen ? ' open' : ''}`}
                onClick={() => setAccountMenuOpen((open) => !open)}
                type="button"
              >
                <span className="button-icon">
                  <UserIcon />
                </span>
                <span className="user-name">{user.fullName}</span>
                <span className="account-menu-chevron"><ChevronIcon /></span>
              </button>

              {accountMenuOpen && (
                <div className="account-dropdown" role="menu">
                  <div className="account-dropdown-head">
                    <span className="account-avatar">{user.fullName.trim().charAt(0).toUpperCase() || 'A'}</span>
                    <div>
                      <strong>{user.fullName}</strong>
                      <small>{user.email || user.phone || 'Tài khoản AA Smart'}</small>
                    </div>
                  </div>

                  <div className="account-menu-group">
                    <span className="account-menu-label">Tài khoản</span>
                    <a href="#/profile" role="menuitem">Hồ sơ của tôi</a>
                  </div>

                  {workspaceLinks.length > 0 && (
                    <div className="account-menu-group workspace-menu-group">
                      <span className="account-menu-label">Không gian làm việc</span>
                      {workspaceLinks.map((link) => (
                        <a href={link.href} key={link.href} role="menuitem">
                          <span>{link.label}</span>
                          <small>{link.description}</small>
                        </a>
                      ))}
                    </div>
                  )}

                  <button
                    className="account-logout"
                    onClick={() => {
                      setAccountMenuOpen(false)
                      onLogout?.()
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <span>Đăng xuất</span>
                    <span className="account-logout-icon"><LogoutIcon /></span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a className={`auth-chip ${activePage === 'auth' ? 'active' : ''}`} href="#/login">
              <span className="button-icon">
                <UserIcon />
              </span>
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
