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
}
