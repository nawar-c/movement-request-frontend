import { Link } from 'react-router-dom'

export function AppShell({ children }) {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link to="/movement-requests" className="app-topbar__brand" style={{ textDecoration: 'none' }}>
            Movement Requests
          </Link>
          {/*
            TODO(auth): this link is visible to everyone because the app has no user/role concept yet.
            Menu hiding is not security — once backend ADMIN authorization ships, gate this link (and the
            /admin/master-data-sync route in App.jsx) by the authenticated user's role, and rely on the
            backend to reject non-admin requests regardless of what the frontend shows.
          */}
          <Link to="/admin/master-data-sync" className="app-topbar__nav-link">
            Admin
          </Link>
        </div>
        <span className="app-topbar__env" title="Oracle integration mode">
          Oracle: Mock
        </span>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
