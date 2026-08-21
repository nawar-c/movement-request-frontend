// Phase E4 — Destination Account final UI. Pure display logic for an Issue line's read-only
// Destination Account, kept in a plain .js module (not the .jsx drawer it's used from) so it's
// directly unit-testable with Node's built-in test runner, which cannot parse JSX — same
// convention as lineItemUom.js and movementRequestHeader.js.

// Exact wording requested for the Issue-line blocking case — distinct from, but consistent with,
// the backend's own authoritative message for the same condition
// (movementRequestRules.js's validateLineDestinationRules).
export const DEFAULT_ACCOUNT_NOT_CONFIGURED_MESSAGE =
  'No Default Destination Account is configured for this Inventory Organization. Please contact the administrator.'

// The USER-safe reference endpoint (GET /api/reference/organization-default-account) resolves the
// organization's configured CCID to its readable combinationCode via the same synced cache the
// ADMIN config screen uses — but an unresolved CCID (present in organization_default_destination_accounts
// but not found/enabled in oracle_destination_accounts) returns combinationCode: null. In that case
// the raw CCID is shown as the readable fallback rather than an empty field — never invented, never
// blank when a real stored value exists.
export function resolveDestinationAccountDisplay(defaultAccount) {
  if (!defaultAccount) return { primary: '', secondaryCcid: null }
  const primary = defaultAccount.combinationCode || defaultAccount.destinationAccount || ''
  const secondaryCcid = defaultAccount.combinationCode ? defaultAccount.destinationAccount : null
  return { primary, secondaryCcid }
}
