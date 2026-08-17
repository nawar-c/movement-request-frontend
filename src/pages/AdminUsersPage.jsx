import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Modal } from '../components/common/Modal.jsx'
import { LoadingState, ErrorState, EmptyState, InlineError, InlineNotice } from '../components/common/States.jsx'
import { adminUsersApi } from '../api/adminUsersApi.js'
import { useOrganizations, useDestinationSubinventoriesByOrganizations } from '../hooks/useReferenceData.js'
import { PASSWORD_POLICY_HINT, validatePassword } from '../utils/validation.js'

const ROLE_OPTIONS = ['USER', 'ADMIN']

const checkboxRowStyle = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }
const modalFooterStyle = { padding: '20px 0 0', borderTop: 'none' }
const destinationKey = (d) => `${d.organizationCode}|${d.subinventoryCode}`

export function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [rowError, setRowError] = useState(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [resetUser, setResetUser] = useState(null)

  function load() {
    setLoading(true)
    setLoadError(null)
    adminUsersApi
      .list()
      .then((items) => setUsers(items))
      .catch((err) => setLoadError(err))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleToggleActive(u) {
    setRowError(null)
    try {
      await adminUsersApi.update(u.id, { isActive: !u.isActive })
      load()
    } catch (err) {
      setRowError(err)
    }
  }

  if (loading) return <LoadingState label="Loading users..." />
  if (loadError) return <ErrorState message={loadError.message} onRetry={load} />

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage application users and access."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            + New User
          </button>
        }
      />

      <InlineError message={rowError?.message} />

      <div className="card">
        <div className="card__body" style={{ padding: users.length === 0 ? undefined : 0 }}>
          {users.length === 0 ? (
            <EmptyState title="No users yet" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Username / Employee ID</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Is Nurse</th>
                    <th>Active</th>
                    <th>Must Change Password</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>{u.isNurse ? 'Yes' : 'No'}</td>
                      <td>{u.isActive ? 'Yes' : 'No'}</td>
                      <td>{u.mustChangePassword ? 'Yes' : 'No'}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn-sm" onClick={() => setEditUser(u)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => handleToggleActive(u)}>
                            {u.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => setResetUser(u)}>
                            Reset Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen ? (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false)
            load()
          }}
        />
      ) : null}
      {editUser ? (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null)
            load()
          }}
        />
      ) : null}
      {resetUser ? <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} /> : null}
    </div>
  )
}

// Grouped-by-organization checkbox picker for a user's assigned Destination Subinventories.
// `selected` / `onChange` use the same {organizationCode, subinventoryCode} shape the backend
// stores and accepts.
function DestinationSubinventoryPicker({ selected, onChange }) {
  const organizations = useOrganizations()
  const orgCodes = useMemo(() => organizations.data.map((o) => o.code), [organizations.data])
  const { dataByOrg, loading } = useDestinationSubinventoriesByOrganizations(orgCodes)

  const selectedKeys = useMemo(() => new Set(selected.map(destinationKey)), [selected])

  function toggle(organizationCode, subinventoryCode) {
    const key = `${organizationCode}|${subinventoryCode}`
    if (selectedKeys.has(key)) {
      onChange(selected.filter((d) => destinationKey(d) !== key))
    } else {
      onChange([...selected, { organizationCode, subinventoryCode }])
    }
  }

  if (organizations.loading || loading) {
    return <div className="form-hint">Loading destination subinventories...</div>
  }

  return (
    <div
      style={{
        maxHeight: 240,
        overflowY: 'auto',
        border: '1px solid var(--color-border-strong)',
        borderRadius: 'var(--radius-sm)',
        padding: 12,
      }}
    >
      {organizations.data.map((org) => {
        const destinations = dataByOrg[org.code] || []
        return (
          <div key={org.code} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                color: 'var(--color-text-muted)',
                marginBottom: 6,
              }}
            >
              {org.name || org.code}
            </div>
            {destinations.length === 0 ? (
              <div className="form-hint">No destination subinventories available.</div>
            ) : (
              destinations.map((d) => (
                <label key={d.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '2px 0' }}>
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(`${org.code}|${d.code}`)}
                    onChange={() => toggle(org.code, d.code)}
                  />
                  {d.code} — {d.name}
                </label>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

function CreateUserModal({ onClose, onCreated }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isNurse, setIsNurse] = useState(false)
  const [role, setRole] = useState('USER')
  const [isActive, setIsActive] = useState(true)
  const [destinations, setDestinations] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    const passwordErrors = validatePassword(password)
    const errors = {
      username: username ? null : 'Username / Employee ID is required.',
      email: email ? null : 'Email is required.',
      password: passwordErrors.length > 0 ? `Password must have ${passwordErrors.join(', ')}.` : null,
    }
    if (errors.username || errors.email || errors.password) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    setError(null)
    try {
      await adminUsersApi.create({ username, email, password, isNurse, role, isActive, destinationSubinventories: destinations })
      onCreated()
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="New User" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <InlineError message={error?.message} details={error?.details} />
        <div className="form-field">
          <label className="form-label">
            Username / Employee ID<span className="form-label__required">*</span>
          </label>
          <input
            className={`form-input${fieldErrors.username ? ' has-error' : ''}`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          {fieldErrors.username ? <div className="form-error">{fieldErrors.username}</div> : null}
        </div>
        <div className="form-field" style={{ marginTop: 14 }}>
          <label className="form-label">
            Email<span className="form-label__required">*</span>
          </label>
          <input
            className={`form-input${fieldErrors.email ? ' has-error' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="form-hint">Used for Forgot Password only — not the login username.</div>
          {fieldErrors.email ? <div className="form-error">{fieldErrors.email}</div> : null}
        </div>
        <div className="form-field" style={{ marginTop: 14 }}>
          <label className="form-label">
            Temporary Password<span className="form-label__required">*</span>
          </label>
          <input
            type="password"
            className={`form-input${fieldErrors.password ? ' has-error' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="form-hint">{PASSWORD_POLICY_HINT}</div>
          {fieldErrors.password ? <div className="form-error">{fieldErrors.password}</div> : null}
        </div>
        <div className="form-field" style={{ marginTop: 14 }}>
          <label className="form-label">Role</label>
          <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <label style={checkboxRowStyle}>
          <input type="checkbox" checked={isNurse} onChange={(e) => setIsNurse(e.target.checked)} />
          Is Nurse
        </label>
        <label style={checkboxRowStyle}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <div className="form-field" style={{ marginTop: 14 }}>
          <label className="form-label">Allowed Destination Subinventories</label>
          <DestinationSubinventoryPicker selected={destinations} onChange={setDestinations} />
        </div>
        <div className="modal__footer" style={modalFooterStyle}>
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditUserModal({ user, onClose, onSaved }) {
  const [username, setUsername] = useState(user.username || '')
  const [email, setEmail] = useState(user.email || '')
  const [isNurse, setIsNurse] = useState(Boolean(user.isNurse))
  const [role, setRole] = useState(user.role || 'USER')
  const [isActive, setIsActive] = useState(Boolean(user.isActive))
  const [destinations, setDestinations] = useState(user.destinationSubinventories || [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await adminUsersApi.update(user.id, {
        username,
        email,
        isNurse,
        role,
        isActive,
        destinationSubinventories: destinations,
      })
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Edit User — ${user.username}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <InlineError message={error?.message} details={error?.details} />
        <div className="form-field">
          <label className="form-label">
            Username / Employee ID<span className="form-label__required">*</span>
          </label>
          <input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="form-field" style={{ marginTop: 14 }}>
          <label className="form-label">
            Email<span className="form-label__required">*</span>
          </label>
          <input className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-field" style={{ marginTop: 14 }}>
          <label className="form-label">Role</label>
          <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <label style={checkboxRowStyle}>
          <input type="checkbox" checked={isNurse} onChange={(e) => setIsNurse(e.target.checked)} />
          Is Nurse
        </label>
        <label style={checkboxRowStyle}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
        <div className="form-field" style={{ marginTop: 14 }}>
          <label className="form-label">Allowed Destination Subinventories</label>
          <DestinationSubinventoryPicker selected={destinations} onChange={setDestinations} />
        </div>
        <div className="modal__footer" style={modalFooterStyle}>
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const passwordErrors = validatePassword(password)
    if (passwordErrors.length > 0) {
      setFieldError(`Password must have ${passwordErrors.join(', ')}.`)
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
      await adminUsersApi.resetPassword(user.id, password, confirmPassword)
      setDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Modal title={`Reset Password — ${user.username}`} onClose={onClose}>
        <InlineNotice>The user must change this password at the next login.</InlineNotice>
        <div className="modal__footer" style={modalFooterStyle}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Reset Password — ${user.username}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <InlineError message={error?.message} details={error?.details} />
        <div className="form-field">
          <label className="form-label">
            New Temporary Password<span className="form-label__required">*</span>
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
            Confirm Temporary Password<span className="form-label__required">*</span>
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
        <div className="modal__footer" style={modalFooterStyle}>
          <button type="button" className="btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
