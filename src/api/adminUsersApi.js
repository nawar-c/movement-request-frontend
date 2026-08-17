import { apiClient } from './client.js'

export const adminUsersApi = {
  list: async () => {
    const data = await apiClient.get('/api/admin/users')
    return Array.isArray(data) ? data : data.items || []
  },

  create: (payload) => apiClient.post('/api/admin/users', payload),

  update: (id, payload) => apiClient.patch(`/api/admin/users/${id}`, payload),

  resetPassword: (id, newPassword, confirmPassword) =>
    apiClient.post(`/api/admin/users/${id}/reset-password`, { newPassword, confirmPassword }),

  // Employee Name is Oracle-synchronized master data — these only ever sync existing application
  // users against Oracle HCM, never create/activate users or touch roles/passwords/assignments.
  syncEmployee: (id) => apiClient.post(`/api/admin/users/${id}/sync-employee`),

  syncAllEmployeeNames: () => apiClient.post('/api/admin/user-employee-sync'),
}
