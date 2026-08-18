import { apiClient } from './client.js'

// Dashboard filters map 1:1 onto the backend's dashboard-summary query contract, confirmed against
// the deployed API: dateFrom/dateTo (YYYY-MM-DD), applicationStatus (DRAFT|SUBMITTED|SUBMIT_FAILED),
// oracleStatusCode (a NUMBER, not the Oracle status text), lineClosure, organizationCode. Reporting
// authorization/scoping is entirely backend-side — this client sends only the filters the user
// chose, nothing user-identity-related, through the same centralized apiClient every other screen uses.
function buildParams(filters = {}) {
  const params = {}
  if (filters.dateFrom) params.dateFrom = filters.dateFrom
  if (filters.dateTo) params.dateTo = filters.dateTo
  if (filters.applicationStatus) params.applicationStatus = filters.applicationStatus
  if (filters.oracleStatusCode != null && filters.oracleStatusCode !== '') {
    params.oracleStatusCode = filters.oracleStatusCode
  }
  if (filters.lineClosure) params.lineClosure = filters.lineClosure
  if (filters.organizationCode) params.organizationCode = filters.organizationCode
  return params
}

export const reportsApi = {
  getDashboardSummary: (filters) => apiClient.get('/api/reports/dashboard-summary', buildParams(filters)),

  getDataFreshness: () => apiClient.get('/api/reports/data-freshness'),
}
