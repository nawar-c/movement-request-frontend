import { toLocalDateInputValue, toDateInputValue } from './formatters.js'

// Cost Center is the authenticated user's configured value — never user-editable, never re-derived
// from anything the user could type. Required Date defaults to today's LOCAL calendar date (never
// toISOString(), which can shift the date across timezones). Kept in a plain .js module (not the
// .jsx page it's used from) so it's directly unit-testable with Node's built-in test runner, which
// cannot parse JSX.
export function buildInitialHeader(user) {
  return {
    inventoryOrganization: null,
    requiredDate: toLocalDateInputValue(),
    description: '',
    costCenter: user.costCenter || null,
  }
}

export function isCostCenterMissing(user) {
  return !user.costCenter
}

// Edit's header mapping — costCenter is the request's permanent creator-time snapshot, never
// re-resolved from the current session's user, never client-editable. Existing historical requests
// (created before per-user Cost Center configuration existed, or before Source Subinventory moved
// to the header) keep showing whatever was actually captured for them.
export function toEditHeaderFormState(mr) {
  return {
    inventoryOrganization: mr.inventoryOrganization,
    requiredDate: toDateInputValue(mr.requiredDate),
    description: mr.description || '',
    costCenter: mr.costCenter,
  }
}

// Unchanged this phase — kept alongside toEditHeaderFormState purely so historical-record mapping
// (header + lines together, e.g. a pre-header-Source-Subinventory record like MR-000039) is
// testable as a pair without rendering the Edit page.
export function toEditLineFormState(line) {
  return {
    ...line,
    clientId: line.id,
    requiredDate: toDateInputValue(line.requiredDate),
  }
}
