import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { ErrorState, InlineError } from '../components/common/States.jsx'
import { DashboardFilters, DEFAULT_FILTERS } from '../components/dashboard/DashboardFilters.jsx'
import { OperationalHealth } from '../components/dashboard/OperationalHealth.jsx'
import { KpiCard } from '../components/dashboard/KpiCard.jsx'
import { DataFreshness } from '../components/dashboard/DataFreshness.jsx'
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton.jsx'
import { RequestTrendChart } from '../components/dashboard/RequestTrendChart.jsx'
import { OracleStatusDonut } from '../components/dashboard/OracleStatusDonut.jsx'
import { LineClosureBar } from '../components/dashboard/LineClosureBar.jsx'
import { ClockIcon, LayersIcon, CheckCircleIcon, AlertIcon } from '../components/common/icons.jsx'
import { reportsApi } from '../api/reportsApi.js'
import { resolveDatePreset, DATE_PRESETS } from '../utils/dateRangePresets.js'
import { useReportResource } from '../hooks/useReportResource.js'
import { formatDate } from '../utils/formatters.js'

// Single source of truth for turning the shared filter state into the query shape every reporting
// endpoint accepts (confirmed identical across dashboard-summary, request-trend,
// oracle-status-distribution, and line-closure-distribution) — reused by every fetch below so
// there is exactly one place that serializes filters, not one per endpoint.
function buildRequestFilters(filters) {
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
  }
}

export function DashboardPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const requestFilters = buildRequestFilters(filters)

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const requestId = useRef(0)

  const [freshness, setFreshness] = useState(null)
  const [freshnessLoading, setFreshnessLoading] = useState(true)
  const [freshnessError, setFreshnessError] = useState(null)

  const trend = useReportResource(reportsApi.getRequestTrend, requestFilters)
  const oracleDistribution = useReportResource(reportsApi.getOracleStatusDistribution, requestFilters)
  const lineClosureDistribution = useReportResource(reportsApi.getLineClosureDistribution, requestFilters)

  function loadSummary() {
    const currentRequest = ++requestId.current
    setSummaryLoading(true)
    setSummaryError(null)
    reportsApi
      .getDashboardSummary(requestFilters)
      .then((data) => {
        if (currentRequest !== requestId.current) return
        setSummary(data)
        setHasLoadedOnce(true)
      })
      .catch((err) => {
        if (currentRequest !== requestId.current) return
        setSummaryError(err)
      })
      .finally(() => {
        if (currentRequest !== requestId.current) return
        setSummaryLoading(false)
      })
  }

  useEffect(
    loadSummary,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      requestFilters.dateFrom,
      requestFilters.dateTo,
      requestFilters.applicationStatus,
      requestFilters.oracleStatusCode,
      requestFilters.lineClosure,
      requestFilters.organizationCode,
    ],
  )

  // Freshness is fetched once, independently of filters, and never blocks or clears the summary.
  useEffect(() => {
    setFreshnessLoading(true)
    setFreshnessError(null)
    reportsApi
      .getDataFreshness()
      .then((data) => setFreshness(data))
      .catch((err) => setFreshnessError(err))
      .finally(() => setFreshnessLoading(false))
  }, [])

  function handleFilterChange(patch) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS)
  }

  // Directional click-to-filter: a second click on the already-selected value clears it rather
  // than re-applying it — one predictable rule shared by the Oracle donut, the Line Closure bar,
  // and the clickable KPI cards.
  function toggleFilter(key, value) {
    const nextValue = String(value)
    setFilters((prev) => ({ ...prev, [key]: prev[key] === nextValue ? '' : nextValue }))
  }

  // DAY-grain only (see RequestTrendChart) — clicking a day sets an exact single-day range in the
  // SAME shared filter state, rather than inventing a new preset or a chart-local filter.
  function handleTrendDayClick(period) {
    setFilters((prev) => (prev.customDate === period ? { ...prev, customDate: '' } : { ...prev, customDate: period }))
  }

  const periodLabel = filters.customDate
    ? formatDate(filters.customDate) || filters.customDate
    : DATE_PRESETS.find((p) => p.value === filters.preset)?.label || 'All Time'

  const showInitialSkeleton = summaryLoading && !hasLoadedOnce
  const showUpdatingIndicator = summaryLoading && hasLoadedOnce

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Operational overview of Movement Requests" />

      <div className="dashboard-header-freshness">
        <DataFreshness freshness={freshness} loading={freshnessLoading} error={freshnessError} />
      </div>

      <DashboardFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
        updating={showUpdatingIndicator}
      />

      {showInitialSkeleton ? (
        <DashboardSkeleton />
      ) : summaryError && !summary ? (
        <ErrorState title="Unable to load the dashboard" message={summaryError.message} onRetry={loadSummary} />
      ) : summary ? (
        <>
          {summaryError ? (
            <InlineError message={`${summaryError.message} Showing the last known values.`} />
          ) : null}
          <OperationalHealth summary={summary} periodLabel={periodLabel} />
          <div className="kpi-grid">
            <KpiCard
              title="Pending Approval"
              value={summary.pendingApproval}
              description="Waiting for Oracle approval"
              icon={ClockIcon}
              accent="warning"
              active={filters.oracleStatusCode === '2'}
              onClick={() => toggleFilter('oracleStatusCode', 2)}
            />
            <KpiCard
              title="Approved Not Fully Closed"
              value={summary.approvedNotFullyClosed}
              description="Approved requests with open line activity"
              icon={LayersIcon}
              accent="neutral"
            />
            <KpiCard
              title="All Lines Closed"
              value={summary.allLinesClosed}
              description="Requests fully closed at line level"
              icon={CheckCircleIcon}
              accent="success"
              active={filters.lineClosure === 'ALL_LINES_CLOSED'}
              onClick={() => toggleFilter('lineClosure', 'ALL_LINES_CLOSED')}
            />
            <KpiCard
              title="Attention Required"
              value={summary.attentionRequired}
              description="Requests requiring operational follow-up"
              icon={AlertIcon}
              accent="danger"
            />
          </div>

          <div className="chart-row">
            <div className="chart-row__trend">
              <RequestTrendChart
                data={trend.data}
                loading={trend.loading}
                hasLoadedOnce={trend.hasLoadedOnce}
                error={trend.error}
                onRetry={trend.reload}
                selectedDay={filters.customDate}
                onDayClick={handleTrendDayClick}
              />
            </div>
            <div className="chart-row__oracle">
              <OracleStatusDonut
                data={oracleDistribution.data}
                loading={oracleDistribution.loading}
                hasLoadedOnce={oracleDistribution.hasLoadedOnce}
                error={oracleDistribution.error}
                onRetry={oracleDistribution.reload}
                selectedCode={filters.oracleStatusCode}
                onSegmentClick={(code) => toggleFilter('oracleStatusCode', code)}
              />
            </div>
          </div>

          <LineClosureBar
            data={lineClosureDistribution.data}
            loading={lineClosureDistribution.loading}
            hasLoadedOnce={lineClosureDistribution.hasLoadedOnce}
            error={lineClosureDistribution.error}
            onRetry={lineClosureDistribution.reload}
            selected={filters.lineClosure}
            onSegmentClick={(key) => toggleFilter('lineClosure', key)}
          />
        </>
      ) : null}
    </div>
  )
}
