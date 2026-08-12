import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell.jsx'
import { MovementRequestListPage } from './pages/MovementRequestListPage.jsx'
import { MovementRequestCreatePage } from './pages/MovementRequestCreatePage.jsx'
import { MovementRequestEditPage } from './pages/MovementRequestEditPage.jsx'
import { MovementRequestViewPage } from './pages/MovementRequestViewPage.jsx'
import { AdminMasterDataSyncPage } from './pages/AdminMasterDataSyncPage.jsx'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/movement-requests" replace />} />
        <Route path="/movement-requests" element={<MovementRequestListPage />} />
        <Route path="/movement-requests/new" element={<MovementRequestCreatePage />} />
        <Route path="/movement-requests/:id/edit" element={<MovementRequestEditPage />} />
        <Route path="/movement-requests/:id" element={<MovementRequestViewPage />} />
        {/* TODO(auth): gate this route to ADMIN once backend authorization ships — see AppShell.jsx */}
        <Route path="/admin/master-data-sync" element={<AdminMasterDataSyncPage />} />
        <Route path="*" element={<Navigate to="/movement-requests" replace />} />
      </Routes>
    </AppShell>
  )
}
