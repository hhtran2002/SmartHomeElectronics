import { useState } from 'react'
import type { FormEvent } from 'react'
import { login } from '../api'
import type { AuthUser } from '../types'

type Props = {
  onLoginSuccess: (user: AuthUser, token: string) => void
  registerHref?: string
}

export function LoginPage({ onLoginSuccess, registerHref = '#/register' }: Props) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = await login({ identifier, password })
      onLoginSuccess(payload.data.user, payload.data.token)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không đăng nhập được.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page auth-page-editorial">
      <section className="auth-editorial-shell">
        <aside className="auth-story">
          <span className="auth-story-index">AA / 01</span>
          <div>
            <span className="eyebrow">Tài khoản khách hàng</span>
            <h1>Mua sắm liền mạch.<br />Theo dõi dễ dàng.</h1>
            <p>Đăng nhập để tiếp tục đơn hàng đang chọn và quản lý mọi thông tin mua sắm tại một nơi.</p>
          </div>
          <ul>
            <li><span>01</span> Giữ nguyên giỏ hàng hiện tại</li>
            <li><span>02</span> Theo dõi trạng thái đơn hàng</li>
            <li><span>03</span> Gửi đánh giá và yêu cầu hỗ trợ</li>
          </ul>
          <a className="auth-story-back" href="#/">← Về trang chủ</a>
        </aside>

        <form className="auth-card auth-editorial-form" onSubmit={handleSubmit}>
          <header>
            <span className="eyebrow">Đăng nhập</span>
            <h2>Chào mừng quay lại.</h2>
            <p>Nhập thông tin tài khoản AA Smart của bạn.</p>
          </header>
          <label>
            <span>Email hoặc số điện thoại</span>
            <input autoComplete="username" placeholder="name@email.com hoặc 09..." required value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          </label>
          <label>
            <span>Mật khẩu</span>
            <input autoComplete="current-password" placeholder="Nhập mật khẩu" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
          <footer>Chưa có tài khoản? <a href={registerHref}>Đăng ký ngay →</a></footer>
        </form>
      </section>
    </main>
  )
}
