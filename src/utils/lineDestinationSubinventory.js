// Phase G5A — pure resolver for a Transfer line's Destination Subinventory auto-selection, kept in
// a plain .js module (not the .jsx drawer it's used from) so it's directly unit-testable with
// Node's built-in test runner, which cannot parse JSX — same convention as lineItemUom.js,
// lineDestinationAccount.js, and movementRequestHeader.js.

// Auto-selects the single authorized Destination Subinventory when the field is genuinely empty.
// Never overwrites an existing value (a fresh manual selection, or a historical value restored via
// buildInitialForm's `{ ...initialLine }` spread in LineEditDrawer.jsx). destinationOptions is
// already the backend-authorized list for the current user + organization (see
// useDestinationSubinventories — the backend scopes results to the caller's assigned destinations,
// unrestricted for ADMIN; this resolver adds no authorization logic of its own, it only decides
// whether to pre-fill an already-authorized single option). 0 or 2+ options: returns the current
// value unchanged (empty stays empty) - the existing "No destination subinventories assigned..."
// hint and required-field validation are untouched.
export function resolveAutoSelectedDestinationSubinventory(currentValue, destinationOptions) {
  if (currentValue) return currentValue
  if (!Array.isArray(destinationOptions) || destinationOptions.length !== 1) return currentValue
  return destinationOptions[0].code
}
