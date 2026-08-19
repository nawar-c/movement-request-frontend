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
  if (filters.sourceSubinventory) params.sourceSubinventory = filters.sourceSubinventory
  if (filters.destinationSubinventory) params.destinationSubinventory = filters.destinationSubinventory
  return params
}

export const reportsApi = {
  getDashboardSummary: (filters) => apiClient.get('/api/reports/dashboard-summary', buildParams(filters)),

  getDataFreshness: () => apiClient.get('/api/reports/data-freshness'),

  // Phase 2 analytics — same filter contract, confirmed live against the deployed API (identical
  // strict-validation query params as dashboard-summary), so buildParams() is reused as-is.
  getRequestTrend: (filters) => apiClient.get('/api/reports/request-trend', buildParams(filters)),

  getOracleStatusDistribution: (filters) =>
    apiClient.get('/api/reports/oracle-status-distribution', buildParams(filters)),

  getLineClosureDistribution: (filters) =>
    apiClient.get('/api/reports/line-closure-distribution', buildParams(filters)),

  // Phase 3 operational drill-down — confirmed live against the deployed API. destination-activity
  // and source-activity return a flat, unpaginated array (small, bounded by subinventory count);
  // attention and requests return the {items, page, pageSize, total} shape and accept page/pageSize.
  getDestinationActivity: (filters) => apiClient.get('/api/reports/destination-activity', buildParams(filters)),

  getSourceActivity: (filters) => apiClient.get('/api/reports/source-activity', buildParams(filters)),

  getAttention: (filters, page, pageSize) =>
    apiClient.get('/api/reports/attention', { ...buildParams(filters), page, pageSize }),

  // oracle_response is never requested and is confirmed absent from this endpoint's fields.
  getRequests: (filters, page, pageSize) =>
    apiClient.get('/api/reports/requests', { ...buildParams(filters), page, pageSize }),
}
