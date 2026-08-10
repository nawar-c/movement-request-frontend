import { Link } from 'react-router-dom'

export function AppShell({ children }) {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link to="/movement-requests" className="app-topbar__brand" style={{ textDecoration: 'none' }}>
          Movement Requests
        </Link>
        <span className="app-topbar__env" title="Oracle integration mode">
          Oracle: Mock
        </span>
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
