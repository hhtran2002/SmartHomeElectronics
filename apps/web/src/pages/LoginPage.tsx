import { useState } from 'react'
import type { FormEvent } from 'react'
import { login } from '../api'
import type { AuthUser } from '../types'

type Props = {
  onLoginSuccess: (user: AuthUser, token: string) => void
}

export function LoginPage({ onLoginSuccess }: Props) {
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
      window.location.hash = '#/'
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không đăng nhập được.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <span className="eyebrow">Đăng nhập</span>
        <h1>Chào mừng quay lại.</h1>
        <label>
          Email hoặc số điện thoại
          <input required value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
        </label>
        <label>
          Mật khẩu
          <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        <p>Chưa có tài khoản? <a href="#/register">Đăng ký ngay</a></p>
      </form>
    </main>
  )
}
