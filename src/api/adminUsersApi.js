import { apiClient } from './client.js'

export const adminUsersApi = {
  // Phase G1B: the backend now always returns {items, page, pageSize, total} (server-side search/
  // filter/pagination, see adminUsersList.js's buildListUsersParams for the exact params shape) -
  // never a flat array. Returned as-is; AdminUsersPage.jsx reads .items for the table and
  // .page/.pageSize/.total for PaginationBar, the same convention reportsApi.getAttention/getRequests
  // already use for the Dashboard's paginated tables.
  list: (params) => apiClient.get('/api/admin/users', params),

  create: (payload) => apiClient.post('/api/admin/users', payload),

  update: (id, payload) => apiClient.patch(`/api/admin/users/${id}`, payload),

  resetPassword: (id, newPassword, confirmPassword) =>
    apiClient.post(`/api/admin/users/${id}/reset-password`, { newPassword, confirmPassword }),

  // Employee Name is Oracle-synchronized master data — these only ever sync existing application
  // users against Oracle HCM, never create/activate users or touch roles/passwords/assignments.
  syncEmployee: (id) => apiClient.post(`/api/admin/users/${id}/sync-employee`),

  syncAllEmployeeNames: () => apiClient.post('/api/admin/user-employee-sync'),
}
