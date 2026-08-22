import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Modal } from '../components/common/Modal.jsx'
import { LookupCombobox } from '../components/common/LookupCombobox.jsx'
import { PaginationBar } from '../components/dashboard/PaginationBar.jsx'
import { RowActionMenu } from '../components/common/RowActionMenu.jsx'
import { LoadingState, ErrorState, EmptyState, InlineError, InlineNotice } from '../components/common/States.jsx'
import { adminUsersApi } from '../api/adminUsersApi.js'
import { referenceApi } from '../api/referenceApi.js'
import { useOrganizations, useDestinationSubinventoriesByOrganizations } from '../hooks/useReferenceData.js'
import { PASSWORD_POLICY_HINT, validatePassword } from '../utils/validation.js'
import { ADMIN_USERS_PAGE_SIZE, buildListUsersParams, clampPageToTotal } from '../utils/adminUsersList.js'

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'USER', label: 'USER' },
  { value: 'ADMIN', label: 'ADMIN' },
]

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

// Same 300ms debounce technique already used by LookupCombobox for search-as-you-type - applied
// here so search (a server round trip, unlike Approval Rules'/Movement Requests' purely client-side
// search boxes) doesn't fire a request on every keystroke.
const SEARCH_DEBOUNCE_MS = 300

const ROLE_OPTIONS = ['USER', 'ADMIN']

const checkboxRowStyle = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13 }
const modalFooterStyle = { padding: '20px 0 0', borderTop: 'none' }
const destinationKey = (d) => `${d.organizationCode}|${d.subinventoryCode}`

// Maps the backend's per-user sync `result` to admin-friendly wording — never surfaces raw
// Oracle/technical error text. "unresolved" (no HCM match, e.g. functional accounts like `admin`)
// is a neutral outcome, not an application error.
function syncResultMessage(result) {
  if (result === 'updated' || result === 'resolved') return 'Employee information synchronized successfully.'
  if (result === 'unchanged') return 'Employee information is already up to date.'
  if (result === 'resolved_without_email') {
    return 'Employee name synchronized, but no work email was found in Oracle HCM.'
  }
  if (result === 'unresolved') return 'No Oracle HCM employee was found for this Employee ID.'
  return 'Unable to synchronize employee information.'
}

// Consolidated Employee cell (Phase G1C): Employee Name (primary) + Email (secondary) in one column,
// sharing a single "Synced from Oracle HCM" caption instead of repeating it once per field — both
// values are always written together by the same Oracle HCM sync operation (setEmployeeIdentity), so
// one caption accurately describes both. employeeName null means genuinely never synchronized (or a
// sync that hasn't resolved yet) - email is never independently editable/settable outside that same
// sync, so a present email always implies a present employeeName, never the reverse.
function EmployeeCell({ employeeName, email }) {
  if (!employeeName) {
    return <span className="text-faint">Not synchronized</span>
  }
  return (
    <div>
      <div>{employeeName}</div>
      {email ? (
        <div className="text-muted" style={{ fontSize: 12 }}>
          {email}
        </div>
      ) : null}
      <div className="text-faint" style={{ fontSize: 11 }}>
        Synced from Oracle HCM
      </div>
    </div>
  )
}

export function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(ADMIN_USERS_PAGE_SIZE)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [rowError, setRowError] = useState(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [isActive, setIsActive] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [resetUser, setResetUser] = useState(null)

  const [syncingId, setSyncingId] = useState(null)
  const [syncNotice, setSyncNotice] = useState(null)

  const [bulkSyncing, setBulkSyncing] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkError, setBulkError] = useState(null)

  // Debounces the raw search box text into the committed `search` value that actually drives a
  // request — the same 300ms technique LookupCombobox already uses, applied to a plain text input
  // instead of a dropdown-suggestion combobox.
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [searchInput])

  // Race guard for out-of-order responses (e.g. a fast filter change followed by another before the
  // first request resolves) - same requestId-ref idiom already used by LookupCombobox,
  // ItemSearchCombobox, and the Dashboard's useReportResource.
  const requestIdRef = useRef(0)

  // requestedPage defaults to the current `page` state so a plain reload (mutation refresh) re-fetches
  // in place; filter changes and explicit page navigation both pass it explicitly instead of relying
  // on `page` state, which would otherwise be stale inside this render's closure.
  function load(requestedPage = page) {
    const currentRequest = ++requestIdRef.current
    setLoading(true)
    setLoadError(null)
    const params = buildListUsersParams({ page: requestedPage, pageSize, search, role, isActive })
    return adminUsersApi
      .list(params)
      .then((result) => {
        if (currentRequest !== requestIdRef.current) return
        // The page just requested may no longer exist against the freshly returned total (a mutation
        // that shrank the result set, or a filter narrowing it) - if so, re-request the last valid
        // page instead of rendering an empty, stranded page.
        const validPage = clampPageToTotal({ page: result.page, pageSize: result.pageSize, total: result.total })
        if (validPage !== result.page) {
          load(validPage)
          return
        }
        setUsers(result.items)
        setPage(result.page)
        setTotal(result.total)
        setHasLoadedOnce(true)
      })
      .catch((err) => {
        if (currentRequest !== requestIdRef.current) return
        setLoadError(err)
      })
      .finally(() => {
        if (currentRequest !== requestIdRef.current) return
        setLoading(false)
      })
  }

  // Any filter change resets to page 1 and re-fetches - mirrors the Dashboard's own
  // "shared-filter change invalidates whatever page a paginated table was sitting on" effect
  // (DashboardPage.jsx). pageSize has no UI control today (fixed at ADMIN_USERS_PAGE_SIZE) but is
  // included here so the reset behavior is already correct if one is ever added.
  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, isActive, pageSize])

  function handlePageChange(nextPage) {
    load(nextPage)
  }

  async function handleToggleActive(u) {
    setRowError(null)
    try {
      await adminUsersApi.update(u.id, { isActive: !u.isActive })
      load()
    } catch (err) {
      setRowError(err)
    }
  }

  async function handleSyncEmployee(u) {
    setSyncNotice(null)
    setSyncingId(u.id)
    try {
      const result = await adminUsersApi.syncEmployee(u.id)
      setSyncNotice({ username: u.username, text: syncResultMessage(result?.result) })
      await load()
    } catch {
      setSyncNotice({ username: u.username, text: syncResultMessage('error') })
    } finally {
      setSyncingId(null)
    }
  }

  async function handleBulkSync() {
    setBulkError(null)
    setBulkResult(null)
    setBulkSyncing(true)
    try {
      const result = await adminUsersApi.syncAllEmployeeNames()
      setBulkResult(result)
      await load()
    } catch (err) {
      setBulkError(err)
    } finally {
      setBulkSyncing(false)
    }
  }

  // Only the true first load (nothing rendered yet) replaces the whole page - a later reload
  // (search/filter/page change, or a mutation refresh) must keep the toolbar and table mounted so a
  // debounced search request firing mid-keystroke never unmounts the input the admin is typing into.
  // Mirrors the Dashboard's own hasLoadedOnce convention (useReportResource/AttentionWorklist).
  if (loading && !hasLoadedOnce) return <LoadingState label="Loading users..." />
  if (loadError && !hasLoadedOnce) return <ErrorState message={loadError.message} onRetry={() => load()} />

  const hasActiveFilter = Boolean(search || role || isActive)

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage application users and access."
        actions={
          <>
            <button type="button" className="btn" onClick={handleBulkSync} disabled={bulkSyncing}>
              {bulkSyncing ? 'Syncing...' : 'Sync Employee Information'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              + New User
            </button>
          </>
        }
      />

      <InlineError message={rowError?.message} />
      <InlineError message={bulkError?.message} />
      {hasLoadedOnce ? <InlineError message={loadError?.message} /> : null}
      {syncNotice ? (
        <InlineNotice>
          {syncNotice.username}: {syncNotice.text}
        </InlineNotice>
      ) : null}
      {bulkResult ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card__body">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Employee Sync Complete</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
              <span>Scanned: {bulkResult.scanned}</span>
              <span>Resolved: {bulkResult.resolved}</span>
              <span>Updated: {bulkResult.updated}</span>
              <span>Unchanged: {bulkResult.unchanged}</span>
              <span>Resolved Without Email: {bulkResult.resolvedWithoutEmail ?? 0}</span>
              <span>Unresolved: {bulkResult.unresolved}</span>
              <span>Errors: {bulkResult.errors}</span>
            </div>
            {Array.isArray(bulkResult.details) && bulkResult.details.some((d) => d.result === 'unresolved') ? (
              <div className="text-faint" style={{ fontSize: 12, marginTop: 10 }}>
                Unresolved (no Oracle HCM match — expected for functional accounts such as{' '}
                <code>admin</code>):{' '}
                {bulkResult.details
                  .filter((d) => d.result === 'unresolved')
                  .map((d) => d.username)
                  .join(', ')}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card__body">
          <div className="toolbar">
            <input
              type="text"
              className="form-input"
              placeholder="Search username, employee name, or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select className="form-select" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
              {ACTIVE_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="text-faint" style={{ fontSize: 12 }}>
              {loading ? 'Loading...' : `${total} user${total === 1 ? '' : 's'}`}
            </span>
          </div>

          {users.length === 0 ? (
            <EmptyState title={hasActiveFilter ? 'No results match your filters' : 'No users yet'} />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Username / Employee ID</th>
                    <th>Employee</th>
                    <th>Cost Center</th>
                    <th>Role</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div>{u.username}</div>
                        {/* mustChangePassword/isNurse are no longer their own columns (Phase G1C) - each
                            renders as a small badge here, only when true, so the common case (neither
                            flag set) stays a single plain line. Is Nurse wasn't named in the approved
                            6-column design but was an existing visible column before this phase; kept
                            here as a compact badge rather than dropped, so no data is silently lost -
                            flagged for review in the implementation report. */}
                        {u.mustChangePassword || u.isNurse ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                            {u.mustChangePassword ? (
                              <span className="status-badge status-badge--pending">Must change password</span>
                            ) : null}
                            {u.isNurse ? <span className="status-badge status-badge--muted">Nurse</span> : null}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <EmployeeCell employeeName={u.employeeName} email={u.email} />
                      </td>
                      <td>
                        {u.costCenter ? u.costCenter : <span className="text-faint">Not configured</span>}
                      </td>
                      <td>{u.role}</td>
                      <td>
                        <span className={`status-badge ${u.isActive ? 'status-badge--ready' : 'status-badge--muted'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn-sm" onClick={() => setEditUser(u)}>
                            Edit
                          </button>
                          <RowActionMenu
                            label={`More actions for ${u.username}`}
                            items={[
                              {
                                label: u.isActive ? 'Disable' : 'Enable',
                                onSelect: () => handleToggleActive(u),
                              },
                              {
                                label: 'Reset Password',
                                onSelect: () => setResetUser(u),
                              },
                              {
                                label: syncingId === u.id ? 'Syncing...' : 'Sync Employee',
                                onSelect: () => handleSyncEmployee(u),
                                disabled: syncingId === u.id,
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 ? <PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={handlePageChange} /> : null}
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

// Searchable Cost Center picker shared by Create/Edit User — reuses the same LookupCombobox +
// referenceApi.searchCostCenters pattern already established on the (untouched-this-round) MR
// header Cost Center field. Unlike that field, this one also supports manual entry: the backend
// deliberately does not require Cost Center to exist in the reference cache (that cache is known
// incomplete against real historical values), so onTermChange keeps whatever the admin last typed
// as a valid value even if they never click a suggestion.
function CostCenterField({ costCenterLabel, onChange, hasError }) {
  function handleSelect(cc) {
    onChange({
      costCenter: cc ? cc.code : '',
      costCenterLabel: cc ? `${cc.code} — ${cc.name}` : '',
    })
  }

  function handleTermChange(text) {
    onChange({ costCenter: text, costCenterLabel: text })
  }

  return (
    <div className="form-field" style={{ marginTop: 14 }}>
      <label className="form-label">Cost Center</label>
      <LookupCombobox
        displayLabel={costCenterLabel}
        onSearch={async (term) => ({ items: await referenceApi.searchCostCenters(term), hasMore: false })}
        onSelect={handleSelect}
        onTermChange={handleTermChange}
        renderOption={(cc) => (
          <>
            <span className="combobox__option-primary">{cc.code}</span>
            <span className="combobox__option-secondary">{cc.name}</span>
          </>
        )}
        getOptionKey={(cc) => cc.code}
        placeholder="Search Cost Center, or type the exact code..."
        hasError={hasError}
      />
      <div className="form-hint">
        Admin-managed — used as the default Cost Center on this user&rsquo;s Movement Requests. If a
        code isn&rsquo;t found in search, you can still type it exactly.
      </div>
    </div>
  )
}

function CreateUserModal({ onClose, onCreated }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isNurse, setIsNurse] = useState(false)
  const [role, setRole] = useState('USER')
  const [isActive, setIsActive] = useState(true)
  const [costCenter, setCostCenter] = useState('')
  const [costCenterLabel, setCostCenterLabel] = useState('')
  const [destinations, setDestinations] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  async function handleSubmit(e) {
    e.preventDefault()
    const passwordErrors = validatePassword(password)
    const errors = {
      username: username ? null : 'Username / Employee ID is required.',
      password: passwordErrors.length > 0 ? `Password must have ${passwordErrors.join(', ')}.` : null,
    }
    if (errors.username || errors.password) {
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)
    setError(null)
    try {
      await adminUsersApi.create({
        username,
        password,
        isNurse,
        role,
        isActive,
        // Omitted entirely (not sent as '') when blank — backend's costCenter field is nullable/
        // optional but rejects an empty string as invalid, same convention as Edit below.
        ...(costCenter.trim() ? { costCenter: costCenter.trim() } : {}),
        destinationSubinventories: destinations,
      })
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
        <CostCenterField
          costCenterLabel={costCenterLabel}
          onChange={({ costCenter: cc, costCenterLabel: label }) => {
            setCostCenter(cc)
            setCostCenterLabel(label)
          }}
        />
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
  const [isNurse, setIsNurse] = useState(Boolean(user.isNurse))
  const [role, setRole] = useState(user.role || 'USER')
  const [isActive, setIsActive] = useState(Boolean(user.isActive))
  // The stored value only carries the code, not its name — same limitation as the MR header's Cost
  // Center (MovementRequestEditPage.jsx toHeaderFormState). Show the code until the admin searches
  // again.
  const [costCenter, setCostCenter] = useState(user.costCenter || '')
  const [costCenterLabel, setCostCenterLabel] = useState(user.costCenter || '')
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
        isNurse,
        role,
        isActive,
        // '' means the admin cleared the field — send null to explicitly clear the stored value
        // (backend: omit to leave untouched, null to clear). A non-empty value is sent as typed.
        costCenter: costCenter.trim() ? costCenter.trim() : null,
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
          <label className="form-label">Employee Name</label>
          <div className="form-input" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
            {user.employeeName || 'Not synchronized'}
          </div>
          <div className="form-hint">Synced from Oracle HCM — read-only. Use Sync Employee to update.</div>
        </div>
        <div className="form-field" style={{ marginTop: 14 }}>
          <label className="form-label">Email</label>
          <div className="form-input" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
            {user.email || 'Not synchronized'}
          </div>
          <div className="form-hint">Synced from Oracle HCM — read-only. Use Sync Employee to update.</div>
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
        <CostCenterField
          costCenterLabel={costCenterLabel}
          onChange={({ costCenter: cc, costCenterLabel: label }) => {
            setCostCenter(cc)
            setCostCenterLabel(label)
          }}
        />
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
