import { apiClient } from './client.js'

// One row per organization (upsert-by-key, same convention as adminApprovalRulesApi). destinationAccount
// is the Oracle CCID string (matches referenceApi.searchDestinationAccounts' oracleCodeCombinationId),
// not the formatted segment string.
export const adminOrganizationAccountsApi = {
  list: () => apiClient.get('/api/admin/organization-default-accounts'),

  upsert: (organizationCode, { destinationAccount, enabled }) =>
    apiClient.put(`/api/admin/organization-default-accounts/${organizationCode}`, {
      destinationAccount,
      enabled,
    }),
}
