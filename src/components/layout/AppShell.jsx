import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'

export function AppShell() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link to="/movement-requests" className="app-topbar__brand" style={{ textDecoration: 'none' }}>
            Movement Requests
          </Link>
          {isAdmin ? (
            <>
              <Link to="/admin/users" className="app-topbar__nav-link">
                Users
              </Link>
              <Link to="/admin/master-data-sync" className="app-topbar__nav-link">
                Admin
              </Link>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="app-topbar__env" title="Oracle integration mode">
            Oracle: Mock
          </span>
          {user?.email ? (
            <span className="text-muted" style={{ fontSize: 12 }}>
              {user.email}
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
