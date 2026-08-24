import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { formatSubinventoryDisplay } from '../src/utils/formatters.js'

/**
 * Phase G5B.3 — Attention Required worklist's Source/Destination Subinventory columns. Same
 * dependency-free Node test-runner convention as every prior phase: the pure display formatter
 * (formatSubinventoryDisplay, added to the existing formatters.js) is unit-tested directly; the
 * JSX/wiring facts that can't be exercised without a rendering framework (column presence/order,
 * drill-down, filters/pagination untouched) are proven via source-structure regex checks against
 * AttentionWorklist.jsx, matching requestsReportPagePhaseG5B1.test.js's established pattern.
 */

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function attentionSource() {
  return readSource('../src/components/dashboard/AttentionWorklist.jsx')
}

describe('A/D — single value renders the actual code', () => {
  test('Source: a plain string value with multiple=false renders as-is', () => {
    assert.equal(formatSubinventoryDisplay('DRUG_MAIN', false), 'DRUG_MAIN')
  })

  test('Destination: a plain string value with multiple=false renders as-is', () => {
    assert.equal(formatSubinventoryDisplay('ER_MED', false), 'ER_MED')
  })

  test('a single value with multiple=undefined (field simply absent) still renders the value', () => {
    assert.equal(formatSubinventoryDisplay('INPHR_DRUG', undefined), 'INPHR_DRUG')
  })
})

describe('B/E — multiple=true renders "Multiple"', () => {
  test('Source: multiple=true renders "Multiple" regardless of value', () => {
    assert.equal(formatSubinventoryDisplay(null, true), 'Multiple')
  })

  test('Destination: multiple=true renders "Multiple" regardless of value', () => {
    assert.equal(formatSubinventoryDisplay(undefined, true), 'Multiple')
  })
})

describe('C/F — null/empty value with multiple=false renders "—"', () => {
  test('null value, multiple=false → "—"', () => {
    assert.equal(formatSubinventoryDisplay(null, false), '—')
  })

  test('undefined value, multiple=false → "—"', () => {
    assert.equal(formatSubinventoryDisplay(undefined, false), '—')
  })

  test('empty-string value, multiple=false → "—"', () => {
    assert.equal(formatSubinventoryDisplay('', false), '—')
  })

  test('null value, multiple=undefined (both fields absent) → "—"', () => {
    assert.equal(formatSubinventoryDisplay(null, undefined), '—')
  })
})

describe('G — the multiple flag wins even if a value is also unexpectedly present', () => {
  test('multiple=true with a non-empty value still renders "Multiple", never the value', () => {
    assert.equal(formatSubinventoryDisplay('DRUG_MAIN', true), 'Multiple')
  })
})

describe('N — no client-side ambiguity inference from arrays/strings', () => {
  test('formatSubinventoryDisplay only branches on isMultiple === true and value truthiness - no Array.isArray/length/split/includes/comma-inspection logic', () => {
    const source = readSource('../src/utils/formatters.js')
    const fnBody = source.slice(
      source.indexOf('export function formatSubinventoryDisplay'),
      source.indexOf('export function formatSubinventoryDisplay') + 300
    )
    assert.doesNotMatch(fnBody, /Array\.isArray/)
    assert.doesNotMatch(fnBody, /\.length/)
    assert.doesNotMatch(fnBody, /\.split\(/)
    assert.doesNotMatch(fnBody, /\.includes\(/)
    assert.doesNotMatch(fnBody, /,\s*['"]/) // no comma-delimited string parsing
  })

  test('AttentionWorklist.jsx passes sourceSubinventory/destinationSubinventory straight through to the formatter - no local array/string inspection of these fields', () => {
    const source = attentionSource()
    assert.match(source, /formatSubinventoryDisplay\(item\.sourceSubinventory, item\.sourceSubinventoryMultiple\)/)
    assert.match(source, /formatSubinventoryDisplay\(item\.destinationSubinventory, item\.destinationSubinventoryMultiple\)/)
    assert.doesNotMatch(source, /item\.sourceSubinventory\.split/)
    assert.doesNotMatch(source, /item\.destinationSubinventory\.split/)
    assert.doesNotMatch(source, /item\.sourceSubinventory\.length/)
    assert.doesNotMatch(source, /item\.destinationSubinventory\.length/)
  })
})

describe('H/I/J — Attention table columns: existing columns retained, Source and Destination added', () => {
  test('all 7 pre-existing column headers are still present', () => {
    const source = attentionSource()
    for (const header of [
      '<th>Movement Request</th>',
      '<th>Reason</th>',
      '<th>Oracle Status</th>',
      '<th>Line Closure</th>',
      '<th>Request Age</th>',
      '<th>Organization</th>',
      '<th>Requested By</th>',
    ]) {
      assert.match(source, new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    }
  })

  test('Source and Destination headers are present, placed after Organization and before Requested By', () => {
    const source = attentionSource()
    const headers = Array.from(source.matchAll(/<th>([^<]+)<\/th>/g)).map((m) => m[1])
    assert.deepEqual(headers, [
      'Movement Request',
      'Reason',
      'Oracle Status',
      'Line Closure',
      'Request Age',
      'Organization',
      'Source',
      'Destination',
      'Requested By',
    ])
  })

  test('no column was removed - exactly 9 header cells total (7 original + 2 new)', () => {
    const source = attentionSource()
    const headerRow = source.slice(source.indexOf('<thead>'), source.indexOf('</thead>'))
    const count = Array.from(headerRow.matchAll(/<th>/g)).length
    assert.equal(count, 9)
  })
})

describe('K — existing row drill-down is unchanged', () => {
  test('row onClick still navigates via goToRequest(item.movementRequestId), unchanged target route', () => {
    const source = attentionSource()
    assert.match(source, /function goToRequest\(id\) \{\s*navigate\(`\/movement-requests\/\$\{id\}`\)/)
    assert.match(source, /onClick=\{\(\) => goToRequest\(item\.movementRequestId\)\}/)
    assert.match(source, /onKeyDown=\{\(e\) => handleRowKeyDown\(e, item\.movementRequestId\)\}/)
  })

  test('no write-triggering handler (POST/PATCH/DELETE, submit, sync) was introduced', () => {
    const source = attentionSource()
    assert.doesNotMatch(source, /apiClient\.(post|patch|delete)/i)
    assert.doesNotMatch(source, /onSubmit/)
  })
})

describe('L/M — existing filters and pagination are untouched', () => {
  test('AttentionWorklist.jsx still receives page/pageSize/total/onPageChange the same way, via the unchanged PaginationBar component', () => {
    const source = attentionSource()
    assert.match(source, /import \{ PaginationBar \} from '\.\/PaginationBar\.jsx'/)
    assert.match(
      source,
      /<PaginationBar page=\{data\.page\} pageSize=\{data\.pageSize\} total=\{data\.total\} onPageChange=\{onPageChange\} \/>/
    )
  })

  test('AttentionWorklist.jsx does not import or reference DashboardFilters, reportFilters, or any filter-building logic - it is purely a display component fed by DashboardPage', () => {
    const source = attentionSource()
    assert.doesNotMatch(source, /DashboardFilters/)
    assert.doesNotMatch(source, /reportFilters/)
    assert.doesNotMatch(source, /buildRequestFilters/)
  })

  test('PaginationBar.jsx itself is byte-unchanged (still exports the same page/pageSize/total/onPageChange contract)', () => {
    const source = readSource('../src/components/dashboard/PaginationBar.jsx')
    assert.match(source, /export function PaginationBar\(\{ page, pageSize, total, onPageChange \}\)/)
  })

  test('reportsApi.js getAttention signature and buildParams whitelist are unchanged by this phase', () => {
    const source = readSource('../src/api/reportsApi.js')
    assert.match(source, /getAttention: \(filters, page, pageSize\) =>\s*apiClient\.get\('\/api\/reports\/attention', \{ \.\.\.buildParams\(filters\), page, pageSize \}\)/)
  })
})

describe('O — existing table wrapper / responsive architecture is retained, not replaced', () => {
  test('the table is still wrapped in the existing .table-wrap / data-table classes - no new responsive wrapper introduced', () => {
    const source = attentionSource()
    assert.match(source, /<div className="table-wrap">/)
    assert.match(source, /<table className="data-table data-table--clickable-rows">/)
  })

  test('no new CSS class or inline overflow/width style was introduced on the table or its wrapper', () => {
    const source = attentionSource()
    const wrapBlock = source.slice(source.indexOf('<div className="table-wrap">'), source.indexOf('</table>'))
    assert.doesNotMatch(wrapBlock, /style=\{\{[^}]*overflow/i)
    assert.doesNotMatch(wrapBlock, /style=\{\{[^}]*width/i)
  })
})

describe('P — no raw theme colors or new theme architecture', () => {
  test('AttentionWorklist.jsx contains no raw hex colors', () => {
    const source = attentionSource()
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/)
  })

  test('formatters.js contains no raw hex colors (pure logic addition only)', () => {
    const source = readSource('../src/utils/formatters.js')
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/)
  })

  test('no theme/ import was introduced in AttentionWorklist.jsx', () => {
    const source = attentionSource()
    assert.doesNotMatch(source, /from ['"]\.\.\/\.\.\/theme\//)
  })
})

describe('Q — Requests Report (G5B.1/G5B.2) is unchanged by this phase', () => {
  test('RequestsReportPage.jsx has no knowledge of sourceSubinventoryMultiple/destinationSubinventoryMultiple/formatSubinventoryDisplay', () => {
    const source = readSource('../src/pages/RequestsReportPage.jsx')
    assert.doesNotMatch(source, /Multiple/)
    assert.doesNotMatch(source, /formatSubinventoryDisplay/)
  })

  test('MatchingRequestsTable.jsx (shared by Dashboard drill-down and Requests Report) is untouched - no Source/Destination columns added there', () => {
    const source = readSource('../src/components/dashboard/MatchingRequestsTable.jsx')
    assert.doesNotMatch(source, /formatSubinventoryDisplay/)
    assert.doesNotMatch(source, /<th>Source<\/th>/)
    assert.doesNotMatch(source, /<th>Destination<\/th>/)
  })
})

describe('R — G5B.2 Requester filter is unchanged by this phase', () => {
  test('requesterLookup.js exports are unchanged (same 5 helpers, nothing added for this phase)', () => {
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

  test('RequestsReportPage.jsx still renders the Requester control exactly as before (isAdmin-gated LookupCombobox)', () => {
    const source = readSource('../src/pages/RequestsReportPage.jsx')
    assert.match(source, /\{isAdmin \? \(/)
    assert.match(source, /<LookupCombobox/)
  })
})

describe('Additional — regression boundary: DashboardPage.jsx wiring to AttentionWorklist is unchanged aside from data already flowing through', () => {
  test('DashboardPage.jsx still passes the same 6 props to AttentionWorklist (data/loading/hasLoadedOnce/error/onRetry/onPageChange) - no new prop wiring needed since Source/Destination ride along on the existing item shape', () => {
    const source = readSource('../src/pages/DashboardPage.jsx')
    const match = source.match(/<AttentionWorklist[\s\S]*?\/>/)
    assert.ok(match, 'AttentionWorklist usage not found in DashboardPage.jsx')
    const usage = match[0]
    assert.match(usage, /data=\{attention\.data\}/)
    assert.match(usage, /loading=\{attention\.loading\}/)
    assert.match(usage, /hasLoadedOnce=\{attention\.hasLoadedOnce\}/)
    assert.match(usage, /error=\{attention\.error\}/)
    assert.match(usage, /onRetry=\{attention\.reload\}/)
    assert.match(usage, /onPageChange=\{setAttentionPage\}/)
  })

  test('DashboardFilters.jsx is untouched by this phase', () => {
    const source = readSource('../src/components/dashboard/DashboardFilters.jsx')
    assert.doesNotMatch(source, /Multiple/)
    assert.doesNotMatch(source, /formatSubinventoryDisplay/)
  })
})
