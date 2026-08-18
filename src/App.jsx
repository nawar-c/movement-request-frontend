import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext.jsx'
import { RequireAdmin, RequireAuth, RequireAuthenticated, RequireGuest } from './auth/guards.jsx'
import { AppShell } from './components/layout/AppShell.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx'
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx'
import { ChangePasswordPage } from './pages/ChangePasswordPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { MovementRequestListPage } from './pages/MovementRequestListPage.jsx'
import { MovementRequestCreatePage } from './pages/MovementRequestCreatePage.jsx'
import { MovementRequestEditPage } from './pages/MovementRequestEditPage.jsx'
import { MovementRequestViewPage } from './pages/MovementRequestViewPage.jsx'
import { AdminMasterDataSyncPage } from './pages/AdminMasterDataSyncPage.jsx'
import { AdminUsersPage } from './pages/AdminUsersPage.jsx'
import { AdminApprovalRulesPage } from './pages/AdminApprovalRulesPage.jsx'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<RequireAuthenticated />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/movement-requests" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/movement-requests" element={<MovementRequestListPage />} />
            <Route path="/movement-requests/new" element={<MovementRequestCreatePage />} />
            <Route path="/movement-requests/:id/edit" element={<MovementRequestEditPage />} />
            <Route path="/movement-requests/:id" element={<MovementRequestViewPage />} />

            <Route element={<RequireAdmin />}>
              <Route path="/admin/master-data-sync" element={<AdminMasterDataSyncPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/approval-rules" element={<AdminApprovalRulesPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/movement-requests" replace />} />
      </Routes>
    </AuthProvider>
  )
}
