import { apiClient } from './client.js'

// Maps the domain enum returned by the backend (status/history) to the
// POST endpoint path segment used to trigger a sync for that domain.
const DOMAIN_SYNC_ENDPOINTS = {
  ORGANIZATION: 'organizations',
  SUBINVENTORY: 'subinventories',
  UOM: 'uoms',
  REASON: 'reasons',
  COST_CENTER: 'cost-centers',
}

export const DOMAIN_LABELS = {
  ORGANIZATION: 'Organizations',
  SUBINVENTORY: 'Subinventories',
  UOM: 'Units of Measure',
  REASON: 'Reasons',
  COST_CENTER: 'Cost Centers',
  ITEM: 'Item Refresh',
  ALL: 'Sync All',
}

// The syncable domain cards shown on the Master Data Sync page, in display order.
// Destination Accounts is intentionally excluded (not yet a syncable domain).
export const SYNC_DOMAINS = ['ORGANIZATION', 'SUBINVENTORY', 'UOM', 'REASON', 'COST_CENTER'].map((key) => ({
  key,
  label: DOMAIN_LABELS[key],
}))

export const adminSyncApi = {
  getStatus: () => apiClient.get('/api/admin/reference-sync/status'),

  getHistory: (params) => apiClient.get('/api/admin/reference-sync/history', params),

  syncAll: () => apiClient.post('/api/admin/reference-sync/all'),

  syncDomain: (domainKey) => apiClient.post(`/api/admin/reference-sync/${DOMAIN_SYNC_ENDPOINTS[domainKey]}`),

  refreshItem: ({ organizationCode, itemNumber }) =>
    apiClient.post('/api/admin/reference-sync/items', { organizationCode, itemNumber }),
}
