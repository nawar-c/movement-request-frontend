import { apiClient } from './client.js'

// Rules are identified by the (organizationCode, subinventoryCode) composite key — there is no
// separate rule id.
export const adminApprovalRulesApi = {
  list: () => apiClient.get('/api/admin/subinventory-approval-rules'),

  setApprovalRequired: (organizationCode, subinventoryCode, approvalRequired) =>
    apiClient.patch(`/api/admin/subinventory-approval-rules/${organizationCode}/${subinventoryCode}`, {
      approvalRequired,
    }),
}
