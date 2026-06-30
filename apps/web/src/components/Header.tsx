import type { AuthUser } from '../types'

type HeaderProps = {
  activePage?: 'home' | 'products' | 'cart' | 'auth' | 'admin'
  cartCount?: number
  user?: AuthUser | null
  onLogout?: () => void
}

export function Header({ activePage = 'home', cartCount = 0, user, onLogout }: HeaderProps) {
  return (
    <header className="header">
      <a className="brand" href="#/">
        <span className="brand-mark">⚡</span>
        <span><strong>AA Smart</strong><small>Smart Home Electronics</small></span>
      </a>
      <nav>
        <a className={activePage === 'home' ? 'active' : ''} href="#/">Trang chủ</a>
        <a className={activePage === 'products' ? 'active' : ''} href="#/products">Sản phẩm</a>
        <a href="#/ai-search">Tìm kiếm AI</a>
        <a className={activePage === 'admin' ? 'active' : ''} href="#/admin/orders">Quản lý</a>
      </nav>
      <div className="header-actions">
        <a className={`cart-button ${activePage === 'cart' ? 'active' : ''}`} href="#/cart">
          Giỏ hàng <span>{cartCount}</span>
        </a>
        {user ? (
          <>
            <a className="auth-chip" href="#/profile">{user.fullName}</a>
            <button className="auth-chip" onClick={onLogout}>Đăng xuất</button>
          </>
        ) : (
          <a className={`auth-chip ${activePage === 'auth' ? 'active' : ''}`} href="#/login">Đăng nhập</a>
        )}
      </div>
    </header>
  )
}
