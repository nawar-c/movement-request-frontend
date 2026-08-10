import { apiClient } from './client.js'

export const referenceApi = {
  getOrganizations: () => apiClient.get('/api/reference/organizations'),

  searchItems: (organizationCode, search) =>
    apiClient.get('/api/reference/items', { organizationCode, search }),

  getSubinventories: (organizationCode) =>
    apiClient.get('/api/reference/subinventories', { organizationCode }),

  getLocators: (organizationCode, subinventoryCode) =>
    apiClient.get('/api/reference/locators', { organizationCode, subinventoryCode }),

  getUoms: () => apiClient.get('/api/reference/uoms'),

  getTransactionTypes: () => apiClient.get('/api/reference/transaction-types'),

  getReasons: () => apiClient.get('/api/reference/reasons'),

  getCostCenters: () => apiClient.get('/api/reference/cost-centers'),
}
