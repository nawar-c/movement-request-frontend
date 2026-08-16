import { Navigate, Outlet } from 'react-router-dom'
import { LoadingState } from '../components/common/States.jsx'
import { useAuth } from './useAuth.js'

// Normal protected application (Movement Requests, Admin/*): needs a valid session AND an
// already-satisfied password-change requirement.
export function RequireAuth() {
  const { isAuthenticated, loading, user } = useAuth()
  if (loading) return <LoadingState label="Loading..." />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  return <Outlet />
}

// /change-password only needs a valid session — that's exactly the page mustChangePassword
// users are routed to, so it must not itself redirect them away for that reason.
export function RequireAuthenticated() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingState label="Loading..." />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

// Nested inside RequireAuth, so auth + mustChangePassword are already satisfied here —
// only the role remains to be checked. Frontend hiding is UX only; the backend is authoritative.
export function RequireAdmin() {
  const { user } = useAuth()
  if (user.role !== 'ADMIN') return <Navigate to="/movement-requests" replace />
  return <Outlet />
}

// /login, /forgot-password, /reset-password: send an already-authenticated user straight into
// the app instead of showing them the login form again.
export function RequireGuest() {
  const { isAuthenticated, loading, user } = useAuth()
  if (loading) return <LoadingState label="Loading..." />
  if (isAuthenticated) {
    return <Navigate to={user.mustChangePassword ? '/change-password' : '/movement-requests'} replace />
  }
  return <Outlet />
}
