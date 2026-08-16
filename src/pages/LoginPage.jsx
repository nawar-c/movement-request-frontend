import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { InlineError, InlineNotice } from '../components/common/States.jsx'
import { useAuth } from '../auth/useAuth.js'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const user = await login(email, password)
      navigate(user.mustChangePassword ? '/change-password' : '/movement-requests', { replace: true })
    } catch (err) {
      setError(err.code === 'NETWORK_ERROR' ? err.message : 'Invalid email or password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="card__header">
          <h2 className="card__title">Movement Requests — Login</h2>
        </div>
        <div className="card__body">
          {location.state?.notice ? <InlineNotice>{location.state.notice}</InlineNotice> : null}
          <InlineError message={error} />
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label">Username / Email</label>
              <input
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="form-field" style={{ marginTop: 14 }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link to="/forgot-password" className="btn-link">
                Forgot Password?
              </Link>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
