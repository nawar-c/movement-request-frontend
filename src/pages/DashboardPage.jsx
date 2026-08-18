import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { ErrorState, InlineError } from '../components/common/States.jsx'
import { DashboardFilters, DEFAULT_FILTERS } from '../components/dashboard/DashboardFilters.jsx'
import { OperationalHealth } from '../components/dashboard/OperationalHealth.jsx'
import { KpiCard } from '../components/dashboard/KpiCard.jsx'
import { DataFreshness } from '../components/dashboard/DataFreshness.jsx'
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton.jsx'
import { ClockIcon, LayersIcon, CheckCircleIcon, AlertIcon } from '../components/common/icons.jsx'
import { reportsApi } from '../api/reportsApi.js'
import { resolveDatePreset, DATE_PRESETS } from '../utils/dateRangePresets.js'

export function DashboardPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const requestId = useRef(0)

  const [freshness, setFreshness] = useState(null)
  const [freshnessLoading, setFreshnessLoading] = useState(true)
  const [freshnessError, setFreshnessError] = useState(null)

  function loadSummary() {
    const { dateFrom, dateTo } = resolveDatePreset(filters.preset)
    const requestFilters = {
      dateFrom,
      dateTo,
      applicationStatus: filters.applicationStatus || undefined,
      oracleStatusCode: filters.oracleStatusCode || undefined,
      lineClosure: filters.lineClosure || undefined,
      organizationCode: filters.organizationCode || undefined,
    }
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

  useEffect(loadSummary, [
    filters.preset,
    filters.applicationStatus,
    filters.oracleStatusCode,
    filters.lineClosure,
    filters.organizationCode,
  ])

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

  const periodLabel = DATE_PRESETS.find((p) => p.value === filters.preset)?.label || 'All Time'

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
            />
            <KpiCard
              title="Attention Required"
              value={summary.attentionRequired}
              description="Requests requiring operational follow-up"
              icon={AlertIcon}
              accent="danger"
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
