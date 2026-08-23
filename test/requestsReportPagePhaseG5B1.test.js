import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildRequestFilters } from '../src/utils/reportFilters.js'

/**
 * Phase G5B.1 — Requests Report page. Same dependency-free Node test-runner convention as every
 * prior phase: pure-function extraction (buildRequestFilters, moved out of DashboardPage.jsx so it
 * can be shared without duplication) + source-structure checks in place of a rendering framework,
 * since the new page can't be imported/rendered under plain Node (useAuth()/router context).
 */

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('A — buildRequestFilters (extracted, shared by DashboardPage and RequestsReportPage)', () => {
  test('the "allTime" preset resolves to no date bounds, with the rest of the filters passed through as undefined when empty', () => {
    const result = buildRequestFilters({
      preset: 'allTime',
      customDate: '',
      applicationStatus: '',
      oracleStatusCode: '',
      lineClosure: '',
      organizationCode: '',
      sourceSubinventory: '',
      destinationSubinventory: '',
    })
    assert.equal(result.dateFrom, null)
    assert.equal(result.dateTo, null)
    assert.equal(result.applicationStatus, undefined)
    assert.equal(result.organizationCode, undefined)
  })

  test('a bounded preset ("last30") resolves dateFrom/dateTo to real YYYY-MM-DD strings', () => {
    const result = buildRequestFilters({ preset: 'last30', customDate: '' })
    assert.equal(typeof result.dateFrom, 'string')
    assert.match(result.dateFrom, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(result.dateTo, /^\d{4}-\d{2}-\d{2}$/)
  })

  test('customDate overrides the preset-derived range with a single exact day (dateFrom === dateTo === customDate)', () => {
    const result = buildRequestFilters({ preset: 'allTime', customDate: '2026-08-20' })
    assert.equal(result.dateFrom, '2026-08-20')
    assert.equal(result.dateTo, '2026-08-20')
  })

  test('a fully-populated filter set passes every value straight through', () => {
    const result = buildRequestFilters({
      preset: 'allTime',
      customDate: '',
      applicationStatus: 'SUBMITTED',
      oracleStatusCode: '2',
      lineClosure: 'NOT_CLOSED',
      organizationCode: 'DRUG',
      sourceSubinventory: 'DRUG_MAIN',
      destinationSubinventory: 'ER_DRUG',
    })
    assert.equal(result.applicationStatus, 'SUBMITTED')
    assert.equal(result.oracleStatusCode, '2')
    assert.equal(result.lineClosure, 'NOT_CLOSED')
    assert.equal(result.organizationCode, 'DRUG')
    assert.equal(result.sourceSubinventory, 'DRUG_MAIN')
    assert.equal(result.destinationSubinventory, 'ER_DRUG')
  })
})

describe('B — DashboardPage.jsx now imports buildRequestFilters instead of defining its own copy', () => {
  test('DashboardPage.jsx imports from ../utils/reportFilters.js and no longer defines buildRequestFilters locally', () => {
    const source = readSource('../src/pages/DashboardPage.jsx')
    assert.match(source, /import \{ buildRequestFilters \} from '\.\.\/utils\/reportFilters\.js'/)
    assert.doesNotMatch(source, /^function buildRequestFilters/m)
    assert.doesNotMatch(source, /^export function buildRequestFilters/m)
  })

  test('DashboardPage.jsx still calls MatchingRequestsTable without title/caption/emptyMessage overrides - relies on the unchanged defaults', () => {
    const source = readSource('../src/pages/DashboardPage.jsx')
    const match = source.match(/<MatchingRequestsTable[\s\S]*?\/>/)
    assert.ok(match, 'MatchingRequestsTable usage not found in DashboardPage.jsx')
    assert.doesNotMatch(match[0], /title=/)
    assert.doesNotMatch(match[0], /caption=/)
    assert.doesNotMatch(match[0], /emptyMessage=/)
  })
})

describe('C — MatchingRequestsTable.jsx: new optional props default to the exact original Dashboard copy', () => {
  test('title/caption/emptyMessage default values match the original hardcoded strings verbatim', () => {
    const source = readSource('../src/components/dashboard/MatchingRequestsTable.jsx')
    assert.match(source, /title = 'Matching Requests'/)
    assert.match(source, /caption = 'The underlying requests for the current Dashboard filters\.'/)
    assert.match(source, /emptyMessage = 'No requests match the current Dashboard filters\.'/)
  })

  test('the rendered title/caption/emptyMessage use the prop variables, not hardcoded JSX text', () => {
    const source = readSource('../src/components/dashboard/MatchingRequestsTable.jsx')
    assert.match(source, /<h2 className="card__title">\{title\}<\/h2>/)
    assert.match(source, /\{caption\}/)
    assert.match(source, /<ChartEmptyState message=\{emptyMessage\} \/>/)
  })
})

describe('D — RequestsReportPage.jsx reuses existing infrastructure, introduces nothing new', () => {
  function pageSource() {
    return readSource('../src/pages/RequestsReportPage.jsx')
  }

  test('imports DashboardFilters/DEFAULT_FILTERS, MatchingRequestsTable, reportsApi, buildRequestFilters, and useReportResource - no new equivalents introduced', () => {
    const source = pageSource()
    assert.match(source, /import \{ DashboardFilters, DEFAULT_FILTERS \} from '\.\.\/components\/dashboard\/DashboardFilters\.jsx'/)
    assert.match(source, /import \{ MatchingRequestsTable \} from '\.\.\/components\/dashboard\/MatchingRequestsTable\.jsx'/)
    assert.match(source, /import \{ reportsApi \} from '\.\.\/api\/reportsApi\.js'/)
    assert.match(source, /import \{ buildRequestFilters \} from '\.\.\/utils\/reportFilters\.js'/)
    assert.match(source, /import \{ useReportResource \} from '\.\.\/hooks\/useReportResource\.js'/)
  })

  test('calls reportsApi.getRequests (the existing endpoint) via useReportResource - no raw fetch() and no hardcoded /api/ URL string anywhere in this file', () => {
    const source = pageSource()
    assert.match(source, /reportsApi\.getRequests/)
    assert.doesNotMatch(source, /\bfetch\(/)
    assert.doesNotMatch(source, /['"]\/api\//)
  })

  test('a filter change resets the page back to 1, mirroring the Dashboard\'s own convention', () => {
    const source = pageSource()
    assert.match(source, /useEffect\(\(\) => \{\s*setPage\(1\)/)
  })

  test('page size is a named constant, not a magic number, and is not 100 (this is a reporting page, not the operational list capped at pageSize:100)', () => {
    const source = pageSource()
    assert.match(source, /const REQUESTS_REPORT_PAGE_SIZE = 25/)
  })

  test('does not define a new local table/pagination implementation - PaginationBar is only reached indirectly through MatchingRequestsTable, never imported directly here', () => {
    const source = pageSource()
    assert.doesNotMatch(source, /PaginationBar/)
    assert.doesNotMatch(source, /<table/)
  })
})

describe('E — App.jsx route: /reports/requests exists, is authenticated, and is NOT admin-gated', () => {
  test('the route is registered pointing at RequestsReportPage', () => {
    const source = readSource('../src/App.jsx')
    assert.match(source, /import \{ RequestsReportPage \} from '\.\/pages\/RequestsReportPage\.jsx'/)
    assert.match(source, /<Route path="\/reports\/requests" element=\{<RequestsReportPage \/>\} \/>/)
  })

  test('the route is declared before the RequireAdmin nested route block, i.e. outside admin gating (same section as /dashboard)', () => {
    const source = readSource('../src/App.jsx')
    const reportsIndex = source.indexOf('path="/reports/requests"')
    const requireAdminIndex = source.indexOf('<Route element={<RequireAdmin />}>')
    const dashboardIndex = source.indexOf('path="/dashboard"')
    assert.ok(reportsIndex > -1 && requireAdminIndex > -1 && dashboardIndex > -1)
    assert.ok(dashboardIndex < reportsIndex, '/reports/requests should be declared right after /dashboard')
    assert.ok(reportsIndex < requireAdminIndex, '/reports/requests must be declared before (outside) the RequireAdmin block')
  })

  test('all 4 pre-existing admin routes and their paths are unchanged', () => {
    const source = readSource('../src/App.jsx')
    assert.match(source, /path="\/admin\/master-data-sync"/)
    assert.match(source, /path="\/admin\/users"/)
    assert.match(source, /path="\/admin\/approval-rules"/)
    assert.match(source, /path="\/admin\/organization-default-accounts"/)
  })
})

describe('F — AppShell.jsx nav link: visible to every authenticated user (not admin-gated), exact-match routing', () => {
  function shellSource() {
    return readSource('../src/components/layout/AppShell.jsx')
  }

  test('the "Requests Report" NavLink exists, uses `end`, and points at /reports/requests', () => {
    const source = shellSource()
    assert.match(source, /<NavLink to="\/reports\/requests" end className=\{navLinkClassName\}>\s*Requests Report\s*<\/NavLink>/)
  })

  test('the new NavLink is declared before the `{isAdmin ? (` block - visible unconditionally, same as Dashboard', () => {
    const source = shellSource()
    const linkIndex = source.indexOf('to="/reports/requests"')
    const isAdminBlockIndex = source.indexOf('{isAdmin ? (')
    assert.ok(linkIndex > -1 && isAdminBlockIndex > -1)
    assert.ok(linkIndex < isAdminBlockIndex, 'Requests Report link must be outside/before the isAdmin-gated block')
  })

  test('isAdmin derivation and the 4 admin links are completely unchanged', () => {
    const source = shellSource()
    assert.match(source, /const isAdmin = user\?\.role === 'ADMIN'/)
    assert.match(source, /<NavLink to="\/admin\/users" end className=\{navLinkClassName\}>/)
    assert.match(source, /<NavLink to="\/admin\/approval-rules" end className=\{navLinkClassName\}>/)
    assert.match(source, /<NavLink to="\/admin\/organization-default-accounts" end className=\{navLinkClassName\}>/)
    assert.match(source, /<NavLink to="\/admin\/master-data-sync" end className=\{navLinkClassName\}>/)
  })
})

describe('G — Regression boundary: no unrelated G1/G2/G4/G5A files were touched by this phase', () => {
  test('RequestsReportPage.jsx has no dependency on Line Drawer, Admin Users, theme, or Source/Destination auto-select files', () => {
    const source = readSource('../src/pages/RequestsReportPage.jsx')
    assert.doesNotMatch(source, /LineEditDrawer/)
    assert.doesNotMatch(source, /AdminUsersPage/)
    assert.doesNotMatch(source, /theme\//)
    assert.doesNotMatch(source, /movementRequestHeader\.js/)
    assert.doesNotMatch(source, /lineDestinationSubinventory\.js/)
  })

  test('reportsApi.js export set is unchanged - no new endpoint function was added for this phase (getRequests already existed)', () => {
    const source = readSource('../src/api/reportsApi.js')
    const exportNames = Array.from(source.matchAll(/^\s{2}(get\w+):/gm)).map((m) => m[1])
    assert.deepEqual(exportNames, [
      'getDashboardSummary',
      'getDataFreshness',
      'getRequestTrend',
      'getOracleStatusDistribution',
      'getLineClosureDistribution',
      'getDestinationActivity',
      'getSourceActivity',
      'getAttention',
      'getRequests',
    ])
  })
})
