import { useEffect, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { DashboardFilters, DEFAULT_FILTERS } from '../components/dashboard/DashboardFilters.jsx'
import { MatchingRequestsTable } from '../components/dashboard/MatchingRequestsTable.jsx'
import { LookupCombobox } from '../components/common/LookupCombobox.jsx'
import { reportsApi } from '../api/reportsApi.js'
import { adminUsersApi } from '../api/adminUsersApi.js'
import { buildRequestFilters } from '../utils/reportFilters.js'
import { formatRequesterLabel, buildRequesterSearchParams, deriveHasMore, mergeRequesterFilter } from '../utils/requesterLookup.js'
import { useReportResource } from '../hooks/useReportResource.js'
import { useAuth } from '../auth/useAuth.js'

// Phase G5B.1 — standalone reporting/drill-down page over the existing GET /api/reports/requests
// endpoint (already used by the Dashboard's own MatchingRequestsTable, just previously only
// reachable there and only once an analytical filter was active). This page always fetches, is not
// gated behind any filter being set, and is not a replacement for the operational
// MovementRequestListPage - it's the reporting-side "browse everything with the full filter set"
// view. Reuses DashboardFilters/useReportResource/MatchingRequestsTable/reportsApi.getRequests
// exactly as-is - no new API client, no new filter logic, no new table implementation.
//
// Server-side scoping is unchanged and untouched here: ADMIN sees every request, a plain USER sees
// only their own created requests, both enforced entirely by the backend's buildScopeClause - this
// page sends only the filters the user chose, the same way every other reporting screen already does.
const REQUESTS_REPORT_PAGE_SIZE = 25

// Phase G5B.2 — LookupCombobox's onSearch(term, { offset }) contract, backed by the existing
// ADMIN-only adminUsersApi.list (no new endpoint). Pure offset/page math and the isActive-omission
// decision live in requesterLookup.js so they're independently unit-testable.
async function searchRequesters(term, { offset }) {
  const params = buildRequesterSearchParams(term, offset)
  const result = await adminUsersApi.list(params)
  return {
    items: result.items,
    hasMore: deriveHasMore(result.page, result.pageSize, result.total),
  }
}

// Merges the ADMIN-only Requester selection into the existing 8-key reporting filter contract at
// the call site only - buildRequestFilters/reportFilters.js is never touched, so its output shape
// (and Dashboard's own use of it) is completely unaffected. createdByUserId is passed via
// useReportResource's extraArgs (not folded into the requestFilters object itself) specifically so
// selecting or clearing a requester is tracked as its own refetch trigger, independent of the 8
// shared filters.
function fetchRequestsWithRequester(filters, page, pageSize, createdByUserId) {
  return reportsApi.getRequests(mergeRequesterFilter(filters, createdByUserId), page, pageSize)
}

export function RequestsReportPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const requestFilters = buildRequestFilters(filters)
  const [page, setPage] = useState(1)

  // Kept entirely separate from `filters` - see the module-level comments above. Only ever set via
  // LookupCombobox's onSelect (a real selected user object, or null on clear) - never from raw typed
  // search text (onTermChange is deliberately not wired up), so an abandoned/unselected search can
  // never leak into the reporting filter.
  const [requesterId, setRequesterId] = useState('')
  const [requesterLabel, setRequesterLabel] = useState('')

  const requests = useReportResource(fetchRequestsWithRequester, requestFilters, {
    extraArgs: [page, REQUESTS_REPORT_PAGE_SIZE, requesterId],
  })

  // Same convention as DashboardPage's own paginated tables - any filter change (including the
  // Requester selection) invalidates whatever page the table was sitting on.
  useEffect(() => {
    setPage(1)
  }, [
    requestFilters.dateFrom,
    requestFilters.dateTo,
    requestFilters.applicationStatus,
    requestFilters.oracleStatusCode,
    requestFilters.lineClosure,
    requestFilters.organizationCode,
    requestFilters.sourceSubinventory,
    requestFilters.destinationSubinventory,
    requesterId,
  ])

  function handleFilterChange(patch) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS)
    setRequesterId('')
    setRequesterLabel('')
  }

  function handleSelectRequester(selectedUser) {
    setRequesterId(selectedUser ? selectedUser.id : '')
    setRequesterLabel(selectedUser ? formatRequesterLabel(selectedUser) : '')
  }

  return (
    <div>
      <PageHeader
        title="Requests Report"
        subtitle="Reporting view of Movement Requests — filterable and paginated server-side."
      />

      <DashboardFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
        updating={requests.loading && requests.hasLoadedOnce}
      />

      {isAdmin ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card__body">
            <div className="form-field" style={{ maxWidth: 360 }}>
              <label className="form-label">Requester</label>
              <LookupCombobox
                displayLabel={requesterLabel}
                onSearch={searchRequesters}
                onSelect={handleSelectRequester}
                renderOption={(u) => (
                  <>
                    <span className="combobox__option-primary">{u.employeeName || u.username}</span>
                    <span className="combobox__option-secondary">{u.username}</span>
                  </>
                )}
                getOptionKey={(u) => u.id}
                minChars={3}
                placeholder="All Requesters — search by name or username..."
              />
            </div>
          </div>
        </div>
      ) : null}

      <MatchingRequestsTable
        title="Requests"
        caption="Movement Requests matching the current filters."
        emptyMessage="No requests match the current filters."
        data={requests.data}
        loading={requests.loading}
        hasLoadedOnce={requests.hasLoadedOnce}
        error={requests.error}
        onRetry={requests.reload}
        onPageChange={setPage}
      />
    </div>
  )
}
