// Pure, dependency-free helpers for the Admin Users page's server-side search/filter/pagination
// (Phase G1B) — extracted so the request-params shape and the out-of-range-page recovery logic are
// directly unit-testable with Node's test runner, the same convention already used throughout this
// project (movementRequestHeader.js, lineItemUom.js, lineDestinationAccount.js). AdminUsersPage.jsx
// itself can't be unit-tested the same way adminUsersApi.js can't either — both transitively import
// config.js's import.meta.env, which plain Node can't parse (see movementRequestsApi.js for the
// identical, previously-documented limitation) — so this module intentionally has zero imports.

export const ADMIN_USERS_PAGE_SIZE = 25

/**
 * Builds the exact params object sent to adminUsersApi.list(). apiClient's own request layer
 * already drops undefined/null/'' values from the query string (see api/client.js's buildUrl) — this
 * function's job is only to decide which filters are meaningful enough to include at all, e.g.
 * trimming search and treating isActive:'' as "no filter" rather than sending it as a literal value.
 */
export function buildListUsersParams({ page = 1, pageSize = ADMIN_USERS_PAGE_SIZE, search = '', role = '', isActive = '' } = {}) {
  const params = { page, pageSize }
  const trimmedSearch = search.trim()
  if (trimmedSearch) params.search = trimmedSearch
  if (role) params.role = role
  if (isActive !== '') params.isActive = isActive
  return params
}

/**
 * After any reload — including a mutation-triggered refresh — the page currently shown may no
 * longer exist against the freshly returned total (a future delete, or any other action that shrinks
 * the result set while paged in). Recomputes the last valid page instead of leaving the UI stranded
 * on an empty out-of-range page. total === 0 always resolves to page 1 (an empty list is still "page
 * 1 of nothing", never "page 0"), and a page already within range is returned unchanged.
 */
export function clampPageToTotal({ page, pageSize, total }) {
  if (total <= 0) return 1
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  return Math.min(page, lastPage)
}
