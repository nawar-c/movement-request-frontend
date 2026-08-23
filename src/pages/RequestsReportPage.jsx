import { useEffect, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { DashboardFilters, DEFAULT_FILTERS } from '../components/dashboard/DashboardFilters.jsx'
import { MatchingRequestsTable } from '../components/dashboard/MatchingRequestsTable.jsx'
import { reportsApi } from '../api/reportsApi.js'
import { buildRequestFilters } from '../utils/reportFilters.js'
import { useReportResource } from '../hooks/useReportResource.js'

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

export function RequestsReportPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const requestFilters = buildRequestFilters(filters)
  const [page, setPage] = useState(1)

  const requests = useReportResource(reportsApi.getRequests, requestFilters, {
    extraArgs: [page, REQUESTS_REPORT_PAGE_SIZE],
  })

  // Same convention as DashboardPage's own paginated tables - any filter change invalidates
  // whatever page the table was sitting on.
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
  ])

  function handleFilterChange(patch) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS)
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
