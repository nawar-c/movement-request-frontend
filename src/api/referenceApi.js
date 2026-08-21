import { apiClient } from './client.js'

export const referenceApi = {
  getOrganizations: () => apiClient.get('/api/reference/organizations'),

  searchItems: (organizationCode, search) =>
    apiClient.get('/api/reference/items', { organizationCode, search }),

  getSubinventories: (organizationCode) =>
    apiClient.get('/api/reference/subinventories', { organizationCode }),

  // Transfer-line Destination Subinventory only. Backend already scopes the result to the
  // logged-in user's assigned destinations (unrestricted for ADMIN) — the frontend must not
  // apply any additional filtering of its own.
  getDestinationSubinventories: (organizationCode) =>
    apiClient.get('/api/reference/destination-subinventories', { organizationCode }),

  getUoms: () => apiClient.get('/api/reference/uoms'),

  getReasons: () => apiClient.get('/api/reference/reasons'),

  searchCostCenters: async (search) => {
    const data = await apiClient.get('/api/reference/cost-centers', { search })
    return data.items
  },

  // Destination accounts are not organization-scoped (the endpoint rejects organizationCode) and
  // the full set (~7,771 rows) is searched and paginated server-side — never fetch it all at once.
  searchDestinationAccounts: (search, { limit = 25, offset = 0 } = {}) =>
    apiClient.get('/api/reference/destination-accounts', { search, limit, offset }),

  // Phase E4: USER-safe read of the organization's configured default Destination Account (with
  // readable combinationCode) — used to display an Issue line's resolved account before it has
  // ever been saved. Deliberately NOT the ADMIN-only /api/admin/organization-default-accounts
  // endpoint. May reject with a 404 ApiError (code: DEFAULT_DESTINATION_ACCOUNT_NOT_CONFIGURED)
  // when the organization has no enabled default configured — callers must handle that themselves.
  getOrganizationDefaultAccount: (organizationCode) =>
    apiClient.get('/api/reference/organization-default-account', { organizationCode }),
}
