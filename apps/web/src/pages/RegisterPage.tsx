import { useState } from 'react'
import type { FormEvent } from 'react'
import { register } from '../api'
import type { AuthUser } from '../types'

type Props = {
  onRegisterSuccess: (user: AuthUser, token: string) => void
  loginHref?: string
}

export function RegisterPage({ onRegisterSuccess, loginHref = '#/login' }: Props) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = await register({ fullName, email, phone, password })
      onRegisterSuccess(payload.data.user, payload.data.token)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không đăng ký được.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page auth-page-editorial">
      <section className="auth-editorial-shell">
        <aside className="auth-story">
          <span className="auth-story-index">AA / 02</span>
          <div>
            <span className="eyebrow">Thành viên AA Smart</span>
            <h1>Một tài khoản.<br />Trọn hành trình mua sắm.</h1>
            <p>Tạo tài khoản để đặt hàng, theo dõi giao nhận và nhận hỗ trợ sau bán hàng thuận tiện hơn.</p>
          </div>
          <ul>
            <li><span>01</span> Đặt hàng và thanh toán an toàn</li>
            <li><span>02</span> Lưu lịch sử mua hàng</li>
            <li><span>03</span> Quản lý bảo hành và hoàn hàng</li>
          </ul>
          <a className="auth-story-back" href="#/">← Về trang chủ</a>
        </aside>

        <form className="auth-card auth-editorial-form" onSubmit={handleSubmit}>
          <header>
            <span className="eyebrow">Đăng ký</span>
            <h2>Tạo tài khoản mới.</h2>
            <p>Chỉ mất một phút để bắt đầu mua sắm.</p>
          </header>
          <label>
            <span>Họ và tên</span>
            <input autoComplete="name" placeholder="Nguyễn Văn A" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <div className="auth-field-row">
            <label>
              <span>Email</span>
              <input autoComplete="email" placeholder="name@email.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              <span>Số điện thoại</span>
              <input autoComplete="tel" inputMode="tel" placeholder="09..." value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
          </div>
          <small className="auth-field-hint">Cung cấp ít nhất email hoặc số điện thoại.</small>
          <label>
            <span>Mật khẩu</span>
            <input autoComplete="new-password" minLength={6} placeholder="Tối thiểu 6 ký tự" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button disabled={loading}>{loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}</button>
          <footer>Đã có tài khoản? <a href={loginHref}>Đăng nhập →</a></footer>
        </form>
      </section>
    </main>
  )
}
