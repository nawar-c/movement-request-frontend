import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ADMIN_USERS_PAGE_SIZE, buildListUsersParams, clampPageToTotal } from '../src/utils/adminUsersList.js'

/**
 * Phase G1B — Admin Users server-side search/filter/pagination. Same dependency-free Node
 * test-runner convention as E1-E4: pure-function extraction (adminUsersList.js) + source-structure
 * checks in place of a rendering framework, since AdminUsersPage.jsx (and adminUsersApi.js, which
 * transitively imports config.js's import.meta.env) can't be imported or rendered under plain Node.
 */

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function pageSource() {
  return readSource('../src/pages/AdminUsersPage.jsx')
}

function apiSource() {
  return readSource('../src/api/adminUsersApi.js')
}

// ---------------------------------------------------------------------------------------------
// A — buildListUsersParams (pure)
// ---------------------------------------------------------------------------------------------
describe('A — buildListUsersParams', () => {
  test('defaults: page 1, ADMIN_USERS_PAGE_SIZE, no optional filters included', () => {
    const params = buildListUsersParams({})
    assert.deepEqual(params, { page: 1, pageSize: ADMIN_USERS_PAGE_SIZE })
  });

  test('search is trimmed and included only when non-empty', () => {
    assert.deepEqual(buildListUsersParams({ search: '  sana  ' }), { page: 1, pageSize: 25, search: 'sana' })
    assert.deepEqual(buildListUsersParams({ search: '   ' }), { page: 1, pageSize: 25 })
    assert.deepEqual(buildListUsersParams({ search: '' }), { page: 1, pageSize: 25 })
  })

  test('role is included only when non-empty', () => {
    assert.deepEqual(buildListUsersParams({ role: 'ADMIN' }), { page: 1, pageSize: 25, role: 'ADMIN' })
    assert.deepEqual(buildListUsersParams({ role: '' }), { page: 1, pageSize: 25 })
  })

  test('isActive: "" means no filter at all - not sent, never coerced to false', () => {
    const params = buildListUsersParams({ isActive: '' })
    assert.equal('isActive' in params, false)
  })

  test('isActive: "true" and "false" are both included as-is (the literal query-string values the backend expects)', () => {
    assert.equal(buildListUsersParams({ isActive: 'true' }).isActive, 'true')
    assert.equal(buildListUsersParams({ isActive: 'false' }).isActive, 'false')
  })

  test('explicit page/pageSize override the defaults', () => {
    const params = buildListUsersParams({ page: 3, pageSize: 10 })
    assert.equal(params.page, 3)
    assert.equal(params.pageSize, 10)
  })

  test('search + role + isActive combine without conflict', () => {
    const params = buildListUsersParams({ page: 2, pageSize: 25, search: 'sana', role: 'USER', isActive: 'true' })
    assert.deepEqual(params, { page: 2, pageSize: 25, search: 'sana', role: 'USER', isActive: 'true' })
  })
})

// ---------------------------------------------------------------------------------------------
// B — clampPageToTotal (pure) - out-of-range-page handling
// ---------------------------------------------------------------------------------------------
describe('B — clampPageToTotal', () => {
  test('total is 0 -> always page 1, never page 0', () => {
    assert.equal(clampPageToTotal({ page: 1, pageSize: 25, total: 0 }), 1)
    assert.equal(clampPageToTotal({ page: 5, pageSize: 25, total: 0 }), 1)
  })

  test('page already within range is returned unchanged', () => {
    assert.equal(clampPageToTotal({ page: 1, pageSize: 25, total: 36 }), 1)
    assert.equal(clampPageToTotal({ page: 2, pageSize: 25, total: 36 }), 2)
  })

  test('page beyond the last valid page is clamped down to the last valid page', () => {
    // 36 users, pageSize 25 -> last page is 2. Requesting page 5 must clamp to 2.
    assert.equal(clampPageToTotal({ page: 5, pageSize: 25, total: 36 }), 2)
  })

  test('a mutation that shrinks total below the current page clamps correctly (e.g. filtered down to 3 results while on page 2)', () => {
    assert.equal(clampPageToTotal({ page: 2, pageSize: 25, total: 3 }), 1)
  })

  test('exact boundary: total is a multiple of pageSize', () => {
    assert.equal(clampPageToTotal({ page: 3, pageSize: 25, total: 50 }), 2)
    assert.equal(clampPageToTotal({ page: 2, pageSize: 25, total: 50 }), 2)
  })
})

// ---------------------------------------------------------------------------------------------
// C — adminUsersApi.list forwards params to the new paginated endpoint (source-structure check)
// ---------------------------------------------------------------------------------------------
describe('C — adminUsersApi.list (source-structure check)', () => {
  test('list is a function of params, forwarded as-is to apiClient.get - no more Array.isArray/.items flat-array handling', () => {
    const source = apiSource()
    assert.match(source, /list:\s*\(params\)\s*=>\s*apiClient\.get\('\/api\/admin\/users',\s*params\)/)
    assert.doesNotMatch(source, /Array\.isArray/, 'the old flat-array fallback must be gone - the endpoint now always returns {items, page, pageSize, total}')
  })
})

// ---------------------------------------------------------------------------------------------
// D — AdminUsersPage: pagination wiring (source-structure check)
// ---------------------------------------------------------------------------------------------
describe('D — AdminUsersPage uses the existing PaginationBar/reporting pagination pattern', () => {
  test('imports and renders PaginationBar with page/pageSize/total/onPageChange - the same component/props shape AttentionWorklist already uses', () => {
    const source = pageSource()
    assert.match(source, /import \{ PaginationBar \} from '\.\.\/components\/dashboard\/PaginationBar\.jsx'/)
    assert.match(source, /<PaginationBar page=\{page\} pageSize=\{pageSize\} total=\{total\} onPageChange=\{handlePageChange\} \/>/)
  })

  test('page size defaults to 25 via ADMIN_USERS_PAGE_SIZE, not a hard-coded literal in the component', () => {
    const source = pageSource()
    assert.match(source, /useState\(ADMIN_USERS_PAGE_SIZE\)/)
  })
})

// ---------------------------------------------------------------------------------------------
// E — Search behavior (source-structure check)
// ---------------------------------------------------------------------------------------------
describe('E — search is sent to the backend, not applied to the loaded page only', () => {
  test('search box drives buildListUsersParams via the load() function, never a client-side .filter() over `users`', () => {
    const source = pageSource()
    assert.match(source, /buildListUsersParams\(\{ page: requestedPage, pageSize, search, role, isActive \}\)/)
    assert.doesNotMatch(source, /users\.filter\(/, 'must never filter the already-loaded page client-side - filtering is entirely server-side now')
  })

  test('search text is debounced before being committed to the value that drives a request', () => {
    const source = pageSource()
    assert.match(source, /setTimeout\(\(\) => setSearch\(searchInput\.trim\(\)\), SEARCH_DEBOUNCE_MS\)/)
  })
})

// ---------------------------------------------------------------------------------------------
// F — Role / Active filters (source-structure check)
// ---------------------------------------------------------------------------------------------
describe('F — role and isActive filters', () => {
  test('role filter options are exactly the two real roles plus "all"', () => {
    const source = pageSource()
    assert.match(source, /ROLE_FILTER_OPTIONS = \[\s*\{ value: '', label: 'All roles' \},\s*\{ value: 'USER', label: 'USER' \},\s*\{ value: 'ADMIN', label: 'ADMIN' \},\s*\]/)
  })

  test('active filter options send the literal "true"/"false" strings the backend schema expects', () => {
    const source = pageSource()
    assert.match(source, /ACTIVE_FILTER_OPTIONS = \[\s*\{ value: '', label: 'All' \},\s*\{ value: 'true', label: 'Active' \},\s*\{ value: 'false', label: 'Inactive' \},\s*\]/)
  })

  test('role and isActive are both plain <select> state feeding load(), not client-side filtering', () => {
    const source = pageSource()
    assert.match(source, /const \[role, setRole\] = useState\(''\)/)
    assert.match(source, /const \[isActive, setIsActive\] = useState\(''\)/)
  })
})

// ---------------------------------------------------------------------------------------------
// G — Filter-reset-to-page-1 behavior (source-structure check)
// ---------------------------------------------------------------------------------------------
describe('G — changing search/role/isActive/pageSize resets to page 1', () => {
  test('the filter-change effect calls load(1) and is keyed on exactly [search, role, isActive, pageSize]', () => {
    const source = pageSource()
    assert.match(source, /useEffect\(\(\) => \{\s*load\(1\)/)
    assert.match(source, /\}, \[search, role, isActive, pageSize\]\)/)
  })

  test('explicit page navigation (handlePageChange) does NOT go through the filter-reset effect - it calls load(nextPage) directly', () => {
    const source = pageSource()
    assert.match(source, /function handlePageChange\(nextPage\) \{\s*load\(nextPage\)\s*\}/)
  })
})

// ---------------------------------------------------------------------------------------------
// H — total/count handling (source-structure check)
// ---------------------------------------------------------------------------------------------
describe('H — total is sourced from the backend response, never assumed', () => {
  test('total state is only ever set from result.total inside load(), never hard-coded', () => {
    const source = pageSource()
    assert.match(source, /setTotal\(result\.total\)/)
    assert.doesNotMatch(source, /\b36\b/, 'must never hard-code the current production user count - that is validation data only')
  })
})

// ---------------------------------------------------------------------------------------------
// I — Mutation-refresh behavior (source-structure check)
// ---------------------------------------------------------------------------------------------
describe('I — mutations refresh the current server-side page, not a flat-array assumption', () => {
  test('handleToggleActive/handleSyncEmployee/handleBulkSync/Create/Edit all call load() (defaults to the current page) after a successful mutation', () => {
    const source = pageSource()
    const loadCalls = source.match(/\bload\(\)/g) || []
    // handleToggleActive, handleSyncEmployee, handleBulkSync, CreateUserModal onCreated, EditUserModal onSaved = 5 call sites
    assert.ok(loadCalls.length >= 5, `expected at least 5 no-arg load() call sites (mutation refreshes), found ${loadCalls.length}`)
  })

  test('load() itself defaults requestedPage to the current `page` state, so a mutation refresh re-fetches in place rather than resetting to page 1', () => {
    const source = pageSource()
    assert.match(source, /function load\(requestedPage = page\) \{/)
  })
})

// ---------------------------------------------------------------------------------------------
// J — Out-of-range page handling (source-structure check)
// ---------------------------------------------------------------------------------------------
describe('J — out-of-range page after a mutation/filter change is corrected, not left stranded', () => {
  test('load() calls clampPageToTotal against the fresh response and re-requests the corrected page when it differs', () => {
    const source = pageSource()
    assert.match(source, /clampPageToTotal\(\{ page: result\.page, pageSize: result\.pageSize, total: result\.total \}\)/)
    assert.match(source, /if \(validPage !== result\.page\) \{\s*load\(validPage\)/)
  })
})

// ---------------------------------------------------------------------------------------------
// K — Preservation of existing Admin Users functionality (source-structure check)
// ---------------------------------------------------------------------------------------------
describe('K — existing Admin Users actions/behavior are preserved', () => {
  test('Create User, Edit, Enable/Disable, Reset Password, Sync Employee, Sync Employee Information are all still present', () => {
    const source = pageSource()
    assert.match(source, /\+ New User/)
    assert.match(source, /onClick=\{\(\) => setEditUser\(u\)\}/)
    assert.match(source, /onClick=\{\(\) => handleToggleActive\(u\)\}/)
    assert.match(source, /onClick=\{\(\) => setResetUser\(u\)\}/)
    assert.match(source, /onClick=\{\(\) => handleSyncEmployee\(u\)\}/)
    assert.match(source, /Sync Employee Information/)
  })

  test('Cost Center display/edit (CostCenterField) and Destination Subinventory assignment (DestinationSubinventoryPicker) are untouched', () => {
    const source = pageSource()
    assert.match(source, /function CostCenterField\(/)
    assert.match(source, /function DestinationSubinventoryPicker\(/)
    assert.match(source, /<CostCenterField/)
    assert.match(source, /<DestinationSubinventoryPicker/)
  })

  test('Role display/edit and Active/inactive columns are still rendered per row', () => {
    const source = pageSource()
    assert.match(source, /<td>\{u\.role\}<\/td>/)
    assert.match(source, /<td>\{u\.isActive \? 'Yes' : 'No'\}<\/td>/)
  })

  test('the Phase E4 Modal component (with its scrolling/sticky-footer fix) is still used unmodified by Create/Edit/Reset Password - no local re-implementation', () => {
    const source = pageSource()
    assert.match(source, /import \{ Modal \} from '\.\.\/components\/common\/Modal\.jsx'/)
    const modalUsages = source.match(/<Modal /g) || []
    assert.ok(modalUsages.length >= 4, 'CreateUserModal, EditUserModal, and both ResetPasswordModal branches must all still render via the shared Modal component')
  })
})

// ---------------------------------------------------------------------------------------------
// L — Loading-state / race-safety (source-structure check) - a debounced search request must
// never unmount the search box the admin is typing into.
// ---------------------------------------------------------------------------------------------
describe('L — loading state does not unmount the toolbar on a background reload', () => {
  test('the full-page LoadingState/ErrorState early-returns are gated by !hasLoadedOnce, not loading/loadError alone', () => {
    const source = pageSource()
    assert.match(source, /if \(loading && !hasLoadedOnce\) return <LoadingState/)
    assert.match(source, /if \(loadError && !hasLoadedOnce\) return <ErrorState/)
  })

  test('a request-id ref guards against out-of-order responses, the same idiom used by LookupCombobox/ItemSearchCombobox', () => {
    const source = pageSource()
    assert.match(source, /const requestIdRef = useRef\(0\)/)
    assert.match(source, /if \(currentRequest !== requestIdRef\.current\) return/)
  })
})
