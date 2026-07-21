import type { AuthUser } from '../types'

type HeaderProps = {
  activePage?: 'home' | 'products' | 'cart' | 'auth' | 'admin'
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

export function Header({ activePage = 'home', cartCount = 0, user, onLogout }: HeaderProps) {
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
        </nav>

        <div className="header-actions">
          <a className={`cart-button ${activePage === 'cart' ? 'active' : ''}`} href="#/cart">
            <span className="button-icon">
              <CartIcon />
            </span>
            <span className="cart-count">{cartCount}</span>
          </a>

          {user ? (
            <>
              <a className="auth-chip user-chip" href="#/profile">
                <span className="button-icon">
                  <UserIcon />
                </span>
                <span className="user-name">{user.fullName}</span>
              </a>

              <button className="auth-chip logout-chip" type="button" onClick={onLogout}>
                <span className="button-icon">
                  <LogoutIcon />
                </span>
              </button>
            </>
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
