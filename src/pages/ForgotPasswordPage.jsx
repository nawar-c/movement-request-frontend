import { useState } from 'react'
import { Link } from 'react-router-dom'
import { InlineError, InlineNotice } from '../components/common/States.jsx'
import { authApi } from '../api/authApi.js'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await authApi.forgotPassword(email)
      setSubmitted(true)
    } catch (err) {
      setError(err.code === 'NETWORK_ERROR' ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="card__header">
          <h2 className="card__title">Forgot Password</h2>
        </div>
        <div className="card__body">
          {submitted ? (
            <>
              <InlineNotice>If this email exists in our system, a password reset link has been sent.</InlineNotice>
              <Link to="/login" className="btn-link">
                Back to Login
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <InlineError message={error} />
              <div className="form-field">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link to="/login" className="btn-link">
                  Back to Login
                </Link>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
