export function validateHeader(header) {
  const errors = {}
  if (!header.inventoryOrganization) errors.inventoryOrganization = 'Inventory Organization is required.'
  if (!header.requiredDate) errors.requiredDate = 'Required Date is required.'
  // Phase E2: one Movement Request = one Source Subinventory, now required at header level (moved
  // off of every line — see LineEditDrawer.jsx and movementRequest.service.js's
  // resolveHeaderSourceSubinventory, which is authoritative server-side either way).
  if (!header.sourceSubinventory) errors.sourceSubinventory = 'Source Subinventory is required.'
  // Cost Center is no longer a header form field the user can fix here — Create blocks entirely
  // before this form is reachable when the authenticated user has no configured Cost Center (see
  // MovementRequestCreatePage.jsx), and Edit only ever shows an existing request's already-resolved
  // snapshot. A field-level error for it would have nowhere left to render.
  return errors
}

export const PASSWORD_POLICY_HINT =
  'Minimum 7 characters, including at least 1 letter, 1 number, and 1 special character.'

// Mirrors the backend password policy. Backend remains authoritative — this only avoids a
// round trip for obviously-invalid passwords. Returns a list of unmet requirements (empty = valid).
export function validatePassword(password) {
  const errors = []
  if (!password || password.length < 7) errors.push('at least 7 characters')
  if (!/[A-Za-z]/.test(password || '')) errors.push('1 letter')
  if (!/[0-9]/.test(password || '')) errors.push('1 number')
  if (!/[^A-Za-z0-9]/.test(password || '')) errors.push('1 special character')
  return errors
}
