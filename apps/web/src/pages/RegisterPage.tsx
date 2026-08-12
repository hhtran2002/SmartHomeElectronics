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
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">Đăng ký</span>
        <h1>Tạo tài khoản khách hàng.</h1>
        <label>
          Họ tên
          <input required value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Số điện thoại
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label>
          Mật khẩu
          <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={loading}>{loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}</button>
        <p>Đã có tài khoản? <a href={loginHref}>Đăng nhập</a></p>
      </form>
    </main>
  )
}
