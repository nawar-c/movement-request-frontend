import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { InlineError } from '../components/common/States.jsx'
import { authApi } from '../api/authApi.js'
import { PASSWORD_POLICY_HINT, validatePassword } from '../utils/validation.js'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const policyErrors = validatePassword(password)
    if (policyErrors.length > 0) {
      setFieldError(`Password must have ${policyErrors.join(', ')}.`)
      return
    }
    if (password !== confirmPassword) {
      setFieldError('Passwords do not match.')
      return
    }
    setFieldError(null)
    setSubmitting(true)
    setError(null)
    try {
      await authApi.resetPassword(token, password, confirmPassword)
      navigate('/login', { replace: true, state: { notice: 'Password reset successful. Please log in.' } })
    } catch (err) {
      setError(err.code === 'NETWORK_ERROR' ? err.message : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="card__header">
          <h2 className="card__title">Reset Password</h2>
        </div>
        <div className="card__body">
          <InlineError message={error} />
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label className="form-label">
                New Password<span className="form-label__required">*</span>
              </label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
            </div>
            <div className="form-field" style={{ marginTop: 14 }}>
              <label className="form-label">
                Confirm New Password<span className="form-label__required">*</span>
              </label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <div className="form-hint">{PASSWORD_POLICY_HINT}</div>
              {fieldError ? <div className="form-error">{fieldError}</div> : null}
            </div>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
