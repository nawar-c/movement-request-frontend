import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'

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
