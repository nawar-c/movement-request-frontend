import { apiClient } from './client.js'

// Login/forgot-password/reset-password are unauthenticated calls — a failure here (bad
// credentials, unknown/expired reset token) is a normal validation outcome, not a session
// event, so these skip the global 401/403 auth-error handling in the API client.
export const authApi = {
  login: (email, password) => apiClient.post('/api/auth/login', { email, password }, { skipAuthHandling: true }),

  me: () => apiClient.get('/api/auth/me'),

  changePassword: (newPassword, confirmPassword) =>
    apiClient.post('/api/auth/change-password', { newPassword, confirmPassword }),

  forgotPassword: (email) => apiClient.post('/api/auth/forgot-password', { email }, { skipAuthHandling: true }),

  resetPassword: (token, newPassword, confirmPassword) =>
    apiClient.post('/api/auth/reset-password', { token, newPassword, confirmPassword }, { skipAuthHandling: true }),
}
