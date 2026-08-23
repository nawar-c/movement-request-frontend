// Phase G5B.2 — pure, dependency-free helpers for Requests Report's ADMIN-only Requester (created-
// by) filter, kept in a plain .js module (not the .jsx page that uses them) so they're directly
// unit-testable with Node's built-in test runner, which cannot parse JSX and cannot import anything
// that transitively touches config.js's import.meta.env — same convention as reportFilters.js,
// lineItemUom.js, lineDestinationAccount.js, and lineDestinationSubinventory.js. This is a plain
// logic module, not a UI component - the Requester control's JSX stays colocated in
// RequestsReportPage.jsx, per the approved G5B.2 architecture.

export const REQUESTER_LOOKUP_PAGE_SIZE = 10

// user.employeeName is Oracle-synced master data and can be null for a not-yet-synced or
// non-employee account (see adminUsers.service.js) - username (the stable Employee ID/login) is
// always present, so it's the safe fallback rather than ever showing a blank label.
export function formatRequesterLabel(user) {
  return user.employeeName ? `${user.employeeName} — ${user.username}` : user.username
}

// Translates LookupCombobox's onSearch(term, { offset }) contract into the page/pageSize shape
// adminUsersApi.list expects. Deliberately never includes isActive: adminUsersApi.list's own
// default (the key simply absent) already returns both active and inactive matching users, which is
// required here - a Movement Request's creator may have since been deactivated, and historical
// reports must still be filterable by that requester.
export function buildRequesterSearchParams(term, offset, pageSize = REQUESTER_LOOKUP_PAGE_SIZE) {
  return {
    search: term,
    page: Math.floor(offset / pageSize) + 1,
    pageSize,
  }
}

// hasMore for LookupCombobox's "Load more results..." affordance, derived from the same
// page/pageSize/total shape every other paginated reporting/admin list already returns.
export function deriveHasMore(page, pageSize, total) {
  return page * pageSize < total
}

// The exact merge point where the ADMIN-only Requester selection is combined with the existing
// 8-key reporting filter contract - deliberately at this call-site level, never inside
// buildRequestFilters/reportFilters.js, so Dashboard's own filters object is never touched or even
// aware this key exists. An empty/falsy createdByUserId resolves to undefined, which both
// reportsApi.js's buildParams and apiClient's buildUrl already drop from the outgoing request.
export function mergeRequesterFilter(filters, createdByUserId) {
  return { ...filters, createdByUserId: createdByUserId || undefined }
}
