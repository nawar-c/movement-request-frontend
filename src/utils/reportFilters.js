import { resolveDatePreset } from './dateRangePresets.js'

// Phase G5B.1 — extracted from DashboardPage.jsx (previously a local, unexported function) so a
// second reporting page (RequestsReportPage.jsx) can share the exact same filter-serialization
// logic instead of duplicating it. Behavior is unchanged from the original — DashboardPage.jsx now
// imports this instead of defining its own copy. Single source of truth for turning the shared
// filter state into the query shape every reporting endpoint accepts (confirmed identical across
// dashboard-summary, request-trend, oracle-status-distribution, line-closure-distribution,
// destination-activity, source-activity, attention, and requests).
export function buildRequestFilters(filters) {
  const dateRange = filters.customDate
    ? { dateFrom: filters.customDate, dateTo: filters.customDate }
    : resolveDatePreset(filters.preset)
  return {
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
    applicationStatus: filters.applicationStatus || undefined,
    oracleStatusCode: filters.oracleStatusCode || undefined,
    lineClosure: filters.lineClosure || undefined,
    organizationCode: filters.organizationCode || undefined,
    sourceSubinventory: filters.sourceSubinventory || undefined,
    destinationSubinventory: filters.destinationSubinventory || undefined,
  }
}
