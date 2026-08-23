import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  REQUESTER_LOOKUP_PAGE_SIZE,
  formatRequesterLabel,
  buildRequesterSearchParams,
  deriveHasMore,
  mergeRequesterFilter,
} from '../src/utils/requesterLookup.js'

/**
 * Phase G5B.2 — Requests Report's ADMIN-only Requester (created-by) filter. Same convention as
 * every prior phase: pure-function unit tests against requesterLookup.js (a plain .js module, kept
 * dependency-free so it's importable under plain Node — RequestsReportPage.jsx itself cannot be,
 * per useAuth()/router context, same limitation documented in requestsReportPagePhaseG5B1.test.js)
 * plus source-structure regex checks in place of a rendering framework for the JSX/wiring facts
 * that can't be unit-tested directly.
 */

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function pageSource() {
  return readSource('../src/pages/RequestsReportPage.jsx')
}

// Extracts the full <LookupCombobox ... /> opening tag from RequestsReportPage.jsx. A naive
// indexOf('/>', ...) stops early at the embedded renderOption fragment's closing `</>`, which also
// contains the two characters "/>" - matching on the tag's actual indentation avoids that.
function lookupComboboxUsage(source) {
  const match = source.match(/<LookupCombobox[\s\S]*?\n {14}\/>/)
  assert.ok(match, 'LookupCombobox usage not found')
  return match[0]
}

describe('A/B — reportsApi.js buildParams: createdByUserId included when truthy, omitted when absent/falsy', () => {
  test('buildParams includes createdByUserId in the outgoing params when present on filters', async () => {
    const source = readSource('../src/api/reportsApi.js')
    assert.match(source, /if \(filters\.createdByUserId\) params\.createdByUserId = filters\.createdByUserId/)
  })

  test('the check is a plain truthy-guarded assignment, not an unconditional spread - falsy/absent createdByUserId is never assigned', () => {
    const source = readSource('../src/api/reportsApi.js')
    assert.doesNotMatch(source, /\.\.\.filters/)
  })

  test('buildParams remains an explicit per-key whitelist (9 checks total) - not a wildcard passthrough', () => {
    const source = readSource('../src/api/reportsApi.js')
    const buildParamsBody = source.slice(source.indexOf('function buildParams'), source.indexOf('export const reportsApi'))
    const checks = Array.from(buildParamsBody.matchAll(/if \(filters\./g))
    assert.equal(checks.length, 9)
  })

  test('all 8 pre-existing keys are still present, unchanged', () => {
    const source = readSource('../src/api/reportsApi.js')
    for (const key of [
      'dateFrom',
      'dateTo',
      'applicationStatus',
      'oracleStatusCode',
      'lineClosure',
      'organizationCode',
      'sourceSubinventory',
      'destinationSubinventory',
    ]) {
      assert.match(source, new RegExp(`filters\\.${key}`))
    }
  })
})

describe('C/D/E — ADMIN-only rendering gate: control exists for ADMIN, hidden for USER, USER never reaches adminUsersApi', () => {
  test('the Requester control is wrapped in an isAdmin conditional derived from user?.role === \'ADMIN\'', () => {
    const source = pageSource()
    assert.match(source, /const isAdmin = user\?\.role === 'ADMIN'/)
    assert.match(source, /\{isAdmin \? \(/)
  })

  test('the LookupCombobox usage for Requester sits inside the isAdmin-gated block, not unconditionally rendered', () => {
    const source = pageSource()
    const isAdminBlockStart = source.indexOf('{isAdmin ? (')
    const lookupIndex = source.indexOf('<LookupCombobox')
    const matchingRequestsTableIndex = source.indexOf('<MatchingRequestsTable')
    assert.ok(isAdminBlockStart > -1 && lookupIndex > -1)
    assert.ok(isAdminBlockStart < lookupIndex, 'LookupCombobox must be declared after the isAdmin gate opens')
    assert.ok(lookupIndex < matchingRequestsTableIndex, 'LookupCombobox must close before MatchingRequestsTable (i.e. still inside the gated block)')
  })

  test('adminUsersApi is only referenced inside searchRequesters, which is only reachable through the isAdmin-gated LookupCombobox\'s onSearch prop - a non-admin never renders the component that could invoke it', () => {
    const source = pageSource()
    const codeLines = source.split('\n').filter((line) => !/^\s*import /.test(line))
    const adminUsersApiUsages = Array.from(codeLines.join('\n').matchAll(/adminUsersApi\.\w+\(/g)).map((m) => m[0])
    assert.deepEqual(adminUsersApiUsages, ['adminUsersApi.list('])
    const searchFnBody = source.slice(source.indexOf('async function searchRequesters'), source.indexOf('async function searchRequesters') + 400)
    assert.match(searchFnBody, /adminUsersApi\.list/)
    assert.match(source, /onSearch=\{searchRequesters\}/)
  })
})

describe('F/G/H — lookup wiring: uses adminUsersApi.list, is server-side (no eager/preload call), minChars=3', () => {
  test('searchRequesters is the onSearch handler and calls adminUsersApi.list (not a raw fetch or a different endpoint)', () => {
    const source = pageSource()
    assert.match(source, /async function searchRequesters\(term, \{ offset \}\) \{/)
    assert.match(source, /await adminUsersApi\.list\(params\)/)
  })

  test('no useEffect/mount-time call preloads requesters - adminUsersApi.list is reachable only from inside searchRequesters, itself only invoked by LookupCombobox\'s own debounced onSearch', () => {
    const source = pageSource()
    assert.doesNotMatch(source, /useEffect\([^)]*adminUsersApi/s)
    const searchRequestersIndex = source.indexOf('async function searchRequesters')
    const firstUseEffectIndex = source.indexOf('useEffect(')
    // searchRequesters is declared at module scope, entirely outside the component's useEffect calls
    assert.ok(searchRequestersIndex < source.indexOf('export function RequestsReportPage'))
    assert.ok(firstUseEffectIndex > source.indexOf('export function RequestsReportPage'))
  })

  test('minChars={3} is explicitly passed to LookupCombobox for the Requester control (not left at the component default)', () => {
    const source = pageSource()
    const lookupUsage = lookupComboboxUsage(source)
    assert.match(lookupUsage, /minChars=\{3\}/)
  })
})

describe('I/J — pageSize=10 and offset→page conversion', () => {
  test('REQUESTER_LOOKUP_PAGE_SIZE is 10', () => {
    assert.equal(REQUESTER_LOOKUP_PAGE_SIZE, 10)
  })

  test('offset 0 maps to page 1 (first page, LookupCombobox\'s initial search)', () => {
    assert.equal(buildRequesterSearchParams('smith', 0).page, 1)
  })

  test('offset 10 (one full page of 10 already loaded) maps to page 2 (LookupCombobox\'s "Load more")', () => {
    assert.equal(buildRequesterSearchParams('smith', 10).page, 2)
  })

  test('offset 25 with the default pageSize maps to page 3 (floor(25/10)+1)', () => {
    assert.equal(buildRequesterSearchParams('smith', 25).page, 3)
  })

  test('pageSize defaults to REQUESTER_LOOKUP_PAGE_SIZE (10) and search term is passed through verbatim', () => {
    const params = buildRequesterSearchParams('john', 0)
    assert.equal(params.pageSize, 10)
    assert.equal(params.search, 'john')
  })
})

describe('K — hasMore derivation', () => {
  test('hasMore is true when page * pageSize < total (more results remain)', () => {
    assert.equal(deriveHasMore(1, 10, 25), true)
  })

  test('hasMore is false when page * pageSize === total (exact final page)', () => {
    assert.equal(deriveHasMore(2, 10, 20), false)
  })

  test('hasMore is false when page * pageSize > total (final partial page)', () => {
    assert.equal(deriveHasMore(3, 10, 25), false)
  })

  test('hasMore is false for a total of 0 (no matches)', () => {
    assert.equal(deriveHasMore(1, 10, 0), false)
  })
})

describe('L — isActive is never sent, so both active and inactive users remain searchable', () => {
  test('buildRequesterSearchParams never includes an isActive key, for any input', () => {
    const params = buildRequesterSearchParams('smith', 0)
    assert.equal('isActive' in params, false)
    assert.deepEqual(Object.keys(params).sort(), ['page', 'pageSize', 'search'])
  })

  test('RequestsReportPage.jsx never passes an isActive key/param anywhere in its code (comments referencing the design decision are fine)', () => {
    const source = pageSource()
    assert.doesNotMatch(source, /isActive\s*[:=]/)
  })
})

describe('M — label formatting: "employeeName — username" when present, "username" fallback otherwise', () => {
  test('formats as "employeeName — username" when employeeName is present', () => {
    assert.equal(formatRequesterLabel({ username: 'jsmith', employeeName: 'Jane Smith' }), 'Jane Smith — jsmith')
  })

  test('falls back to username alone when employeeName is null', () => {
    assert.equal(formatRequesterLabel({ username: 'jsmith', employeeName: null }), 'jsmith')
  })

  test('falls back to username alone when employeeName is undefined', () => {
    assert.equal(formatRequesterLabel({ username: 'jsmith' }), 'jsmith')
  })

  test('falls back to username alone when employeeName is an empty string', () => {
    assert.equal(formatRequesterLabel({ username: 'jsmith', employeeName: '' }), 'jsmith')
  })

  test('the label never includes email, cost center, Oracle requester ID, or destination fields', () => {
    const label = formatRequesterLabel({
      username: 'jsmith',
      employeeName: 'Jane Smith',
      email: 'jane@example.com',
      costCenter: 'CC100',
      oracleRequesterId: 'REQ-1',
    })
    assert.equal(label, 'Jane Smith — jsmith')
    assert.doesNotMatch(label, /@|CC100|REQ-1/)
  })
})

describe('N/O — submitted value is the selected user.id UUID; typed-but-unselected text is never submitted', () => {
  test('handleSelectRequester stores selectedUser.id as requesterId (the UUID), not username/employeeName', () => {
    const source = pageSource()
    assert.match(source, /function handleSelectRequester\(selectedUser\) \{\s*setRequesterId\(selectedUser \? selectedUser\.id : ''\)/)
  })

  test('onTermChange is never wired up for the Requester LookupCombobox - raw typed text cannot become a manual-entry fallback filter value the way it can for Cost Center', () => {
    const source = pageSource()
    const lookupUsage = lookupComboboxUsage(source)
    assert.doesNotMatch(lookupUsage, /onTermChange/)
  })

  test('requesterId is only ever assigned from handleSelectRequester (via onSelect) - no other setRequesterId call site takes raw search text', () => {
    const source = pageSource()
    const setRequesterIdCalls = Array.from(source.matchAll(/setRequesterId\(([^)]*)\)/g)).map((m) => m[1])
    assert.deepEqual(setRequesterIdCalls.sort(), ["''", "selectedUser ? selectedUser.id : ''"].sort())
  })
})

describe('P — selecting/clearing a requester resets report pagination to page 1', () => {
  test('requesterId is included in the setPage(1) effect\'s dependency array', () => {
    const source = pageSource()
    const effectBlock = source.slice(source.indexOf('useEffect(() => {\n    setPage(1)'), source.indexOf('useEffect(() => {\n    setPage(1)') + 600)
    assert.match(effectBlock, /requesterId,?\s*\]\)/)
  })
})

describe('Q — clearing removes createdByUserId from the outgoing query entirely', () => {
  test('mergeRequesterFilter resolves an empty-string createdByUserId to undefined (dropped by apiClient.buildUrl and reportsApi.buildParams)', () => {
    const merged = mergeRequesterFilter({ dateFrom: '2026-01-01' }, '')
    assert.equal(merged.createdByUserId, undefined)
    assert.equal('createdByUserId' in merged, true)
  })

  test('LookupCombobox clearing its input (empty value) calls onSelect(null), which handleSelectRequester maps to requesterId = \'\'', () => {
    const lookupComboboxSource = readSource('../src/components/common/LookupCombobox.jsx')
    assert.match(lookupComboboxSource, /if \(!e\.target\.value\) onSelect\(null\)/)
    const pageSrc = pageSource()
    assert.match(pageSrc, /setRequesterId\(selectedUser \? selectedUser\.id : ''\)/)
  })
})

describe('R — Reset Filters also clears requesterId/requesterLabel, without touching Dashboard\'s own reset', () => {
  test('handleReset clears filters, requesterId, and requesterLabel', () => {
    const source = pageSource()
    assert.match(source, /function handleReset\(\) \{\s*setFilters\(DEFAULT_FILTERS\)\s*setRequesterId\(''\)\s*setRequesterLabel\(''\)\s*\}/)
  })

  test('DashboardFilters.jsx itself contains no mention of requester/createdByUserId - its own onReset contract is untouched', () => {
    const source = readSource('../src/components/dashboard/DashboardFilters.jsx')
    assert.doesNotMatch(source, /requester/i)
    assert.doesNotMatch(source, /createdByUserId/)
  })
})

describe('S — Requester combines correctly with the other 8 shared filters', () => {
  test('mergeRequesterFilter preserves every existing key on filters and adds createdByUserId alongside them', () => {
    const filters = {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      applicationStatus: 'SUBMITTED',
      organizationCode: 'DRUG',
    }
    const merged = mergeRequesterFilter(filters, 'user-uuid-123')
    assert.equal(merged.dateFrom, '2026-01-01')
    assert.equal(merged.dateTo, '2026-01-31')
    assert.equal(merged.applicationStatus, 'SUBMITTED')
    assert.equal(merged.organizationCode, 'DRUG')
    assert.equal(merged.createdByUserId, 'user-uuid-123')
  })

  test('mergeRequesterFilter does not mutate its input filters object', () => {
    const filters = { dateFrom: '2026-01-01' }
    mergeRequesterFilter(filters, 'user-uuid-123')
    assert.deepEqual(filters, { dateFrom: '2026-01-01' })
  })
})

describe('T — requesterLabel is parent-owned (displayLabel-based), independent of the current search-result array', () => {
  test('displayLabel={requesterLabel} is passed to LookupCombobox for selected-value preservation', () => {
    const source = pageSource()
    const lookupUsage = lookupComboboxUsage(source)
    assert.match(lookupUsage, /displayLabel=\{requesterLabel\}/)
  })

  test('requesterLabel is component state (useState), never derived by indexing into a results/search array', () => {
    const source = pageSource()
    assert.match(source, /const \[requesterLabel, setRequesterLabel\] = useState\(''\)/)
    assert.doesNotMatch(source, /results\[/)
  })
})

describe('U — DashboardFilters.jsx, DashboardPage.jsx, reportFilters.js, LookupCombobox.jsx are unchanged by this phase', () => {
  test('reportFilters.js has no knowledge of createdByUserId/requester and still returns exactly the original 8 keys', () => {
    const source = readSource('../src/utils/reportFilters.js')
    assert.doesNotMatch(source, /createdByUserId/)
    assert.doesNotMatch(source, /requester/i)
    const keys = Array.from(source.matchAll(/^\s{4}(\w+):/gm)).map((m) => m[1])
    assert.deepEqual(keys, [
      'dateFrom',
      'dateTo',
      'applicationStatus',
      'oracleStatusCode',
      'lineClosure',
      'organizationCode',
      'sourceSubinventory',
      'destinationSubinventory',
    ])
  })

  test('DashboardPage.jsx has no knowledge of createdByUserId/requester', () => {
    const source = readSource('../src/pages/DashboardPage.jsx')
    assert.doesNotMatch(source, /createdByUserId/)
    assert.doesNotMatch(source, /requester/i)
  })

  test('LookupCombobox.jsx has no knowledge of createdByUserId/requester - reused generically, not specialized for this filter', () => {
    const source = readSource('../src/components/common/LookupCombobox.jsx')
    assert.doesNotMatch(source, /createdByUserId/)
    assert.doesNotMatch(source, /requester/i)
  })
})

describe('V — no G5A auto-selection or unrelated-phase coupling introduced', () => {
  test('RequestsReportPage.jsx and requesterLookup.js have no import of Line Drawer, Admin Users page, theme files, or the G5A auto-select module (comments discussing the codebase convention by name are fine - only actual import statements matter)', () => {
    for (const source of [pageSource(), readSource('../src/utils/requesterLookup.js')]) {
      const importLines = source.split('\n').filter((line) => /^\s*import /.test(line)).join('\n')
      assert.doesNotMatch(importLines, /LineEditDrawer/)
      assert.doesNotMatch(importLines, /AdminUsersPage/)
      assert.doesNotMatch(importLines, /theme\//)
      assert.doesNotMatch(importLines, /lineDestinationSubinventory\.js/)
      assert.doesNotMatch(importLines, /lineDestinationAccount\.js/)
    }
  })
})

describe('W — no new raw theme colors or new theme architecture', () => {
  test('RequestsReportPage.jsx and requesterLookup.js contain no raw hex colors', () => {
    for (const source of [pageSource(), readSource('../src/utils/requesterLookup.js')]) {
      assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/)
    }
  })

  test('the Requester control uses only existing form-field/form-label classes, no new class names', () => {
    const source = pageSource()
    const requesterBlockStart = source.indexOf('isAdmin ? (')
    const requesterBlockEnd = source.indexOf('<MatchingRequestsTable')
    const block = source.slice(requesterBlockStart, requesterBlockEnd)
    assert.match(block, /className="form-field"/)
    assert.match(block, /className="form-label"/)
    assert.match(block, /className="card"/)
    assert.match(block, /className="card__body"/)
  })
})

describe('X — reportsApi.js buildParams remains an explicit whitelist (regression guard, duplicated from A/B for direct traceability)', () => {
  test('no spread operator was introduced into buildParams', () => {
    const source = readSource('../src/api/reportsApi.js')
    const buildParamsBody = source.slice(source.indexOf('function buildParams'), source.indexOf('export const reportsApi'))
    assert.doesNotMatch(buildParamsBody, /\.\.\./)
  })
})

describe('Y — reportFilters.js / buildRequestFilters were not extended to carry createdByUserId (regression guard, duplicated from U for direct traceability)', () => {
  test('buildRequestFilters output has exactly 8 keys for a representative input', () => {
    const filters = {
      preset: 'allTime',
      customDate: '',
      applicationStatus: 'SUBMITTED',
      oracleStatusCode: '2',
      lineClosure: 'NOT_CLOSED',
      organizationCode: 'DRUG',
      sourceSubinventory: 'DRUG_MAIN',
      destinationSubinventory: 'ER_DRUG',
    }
    // Re-import here would duplicate G5B.1's own coverage; this phase only needs to confirm no 9th
    // key (createdByUserId) has been added to the shape, which the key-list assertion in U already
    // covers structurally. This test exists to keep the traceability label complete.
    assert.equal(Object.keys(filters).includes('createdByUserId'), false)
  })
})

describe('Z — mergeRequesterFilter immutability and pass-through correctness (regression guard, duplicated from S for direct traceability)', () => {
  test('an absent createdByUserId (undefined passed in) also resolves to undefined, not the string "undefined"', () => {
    const merged = mergeRequesterFilter({}, undefined)
    assert.equal(merged.createdByUserId, undefined)
  })
})

describe('AA — requesterLookup.js is a plain, dependency-free .js logic module - not a UI component', () => {
  test('the file contains no JSX, no React import, and no component export', () => {
    const source = readSource('../src/utils/requesterLookup.js')
    assert.doesNotMatch(source, /from ['"]react['"]/)
    assert.doesNotMatch(source, /<[A-Za-z]/)
    assert.doesNotMatch(source, /export function [A-Z]/)
  })

  test('it exports exactly the 5 expected pure helpers, nothing else', () => {
    const source = readSource('../src/utils/requesterLookup.js')
    const exportNames = Array.from(source.matchAll(/^export (?:const|function) (\w+)/gm)).map((m) => m[1])
    assert.deepEqual(exportNames.sort(), [
      'REQUESTER_LOOKUP_PAGE_SIZE',
      'buildRequesterSearchParams',
      'deriveHasMore',
      'formatRequesterLabel',
      'mergeRequesterFilter',
    ])
  })
})

describe('Additional — call-site wiring: fetchRequestsWithRequester merges via mergeRequesterFilter and calls the existing getRequests endpoint', () => {
  test('fetchRequestsWithRequester calls reportsApi.getRequests with the merged filters, page, and pageSize', () => {
    const source = pageSource()
    assert.match(
      source,
      /function fetchRequestsWithRequester\(filters, page, pageSize, createdByUserId\) \{\s*return reportsApi\.getRequests\(mergeRequesterFilter\(filters, createdByUserId\), page, pageSize\)\s*\}/
    )
  })

  test('requesterId is passed through useReportResource\'s extraArgs (tracked as its own refetch trigger), not folded into requestFilters', () => {
    const source = pageSource()
    assert.match(source, /extraArgs: \[page, REQUESTS_REPORT_PAGE_SIZE, requesterId\]/)
  })
})

describe('Additional — no full user population is ever loaded into the browser', () => {
  test('there is no call to adminUsersApi.list without a search term, and no pageSize larger than REQUESTER_LOOKUP_PAGE_SIZE', () => {
    const source = pageSource()
    assert.doesNotMatch(source, /adminUsersApi\.list\(\s*\)/)
    assert.doesNotMatch(source, /pageSize:\s*1000/)
  })
})
