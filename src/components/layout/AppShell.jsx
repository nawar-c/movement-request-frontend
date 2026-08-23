import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { useTheme } from '../../theme/useTheme.js'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

// Movement Requests is a section, not a single route (list/new/view/edit all belong under it) - no
// `end` prop, so NavLink's default prefix matching keeps the brand active across
// /movement-requests, /movement-requests/new, /movement-requests/:id, and /movement-requests/:id/edit.
// Every other nav item (Dashboard, and each Admin page) maps to exactly one leaf route with no
// children, so `end` is used there for exact matching only.
function brandLinkClassName({ isActive }) {
  return isActive ? 'app-topbar__brand app-topbar__brand--active' : 'app-topbar__brand'
}

function navLinkClassName({ isActive }) {
  return isActive ? 'app-topbar__nav-link app-topbar__nav-link--active' : 'app-topbar__nav-link'
}

export function AppShell() {
  const { user, logout } = useAuth()
  const { preference, setPreference } = useTheme()
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <NavLink to="/movement-requests" className={brandLinkClassName} style={{ textDecoration: 'none' }}>
            Movement Requests
          </NavLink>
          <NavLink to="/dashboard" end className={navLinkClassName}>
            Dashboard
          </NavLink>
          <NavLink to="/reports/requests" end className={navLinkClassName}>
            Requests Report
          </NavLink>
          {isAdmin ? (
            <>
              <NavLink to="/admin/users" end className={navLinkClassName}>
                Users
              </NavLink>
              <NavLink to="/admin/approval-rules" end className={navLinkClassName}>
                Approval Rules
              </NavLink>
              <NavLink to="/admin/organization-default-accounts" end className={navLinkClassName}>
                Org Accounts
              </NavLink>
              <NavLink to="/admin/master-data-sync" end className={navLinkClassName}>
                Admin
              </NavLink>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Reuses the Dashboard date-range control's existing .preset-group/.preset-btn pattern
              (DashboardFilters.jsx) verbatim - already exactly "a compact row of mutually-exclusive
              option buttons with an obvious active state," so no new CSS architecture was needed for
              this control. */}
          <div className="preset-group" role="group" aria-label="Theme">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`preset-btn${preference === opt.value ? ' preset-btn--active' : ''}`}
                aria-pressed={preference === opt.value}
                onClick={() => setPreference(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {user?.username ? (
            <span className="text-muted" style={{ fontSize: 12 }}>
              {user.username}
            </span>
          ) : null}
          <button type="button" className="btn btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
