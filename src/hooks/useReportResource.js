import { useEffect, useRef, useState } from 'react'

// Generic loader for a single reporting endpoint, driven by the shared dashboard filter state.
// Mirrors the race-guard pattern already used for dashboard-summary in Phase 1, generalized so
// each chart's data/loading/error is independent — one endpoint failing never clears another's
// data or blocks the rest of the dashboard.
//
// `extraArgs` (Phase 3) are appended to the fetcher call and included in the effect's dependency
// array — used by paginated resources (attention, requests) to pass [page, pageSize] without
// changing the signature every other Phase 2 caller already relies on.
//
// `enabled` (Phase 3) lets a resource that isn't currently shown (e.g. Matching Requests before
// any analytical filter is active) skip fetching entirely rather than firing a request whose
// result will just be discarded — while resetting to a clean unloaded state so it doesn't flash
// stale data if it becomes enabled again later.
export function useReportResource(fetcher, requestFilters, { extraArgs = [], enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const requestId = useRef(0)

  function load() {
    if (!enabled) {
      ++requestId.current
      setData(null)
      setLoading(false)
      setError(null)
      setHasLoadedOnce(false)
      return
    }
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    fetcher(requestFilters, ...extraArgs)
      .then((result) => {
        if (currentRequest !== requestId.current) return
        setData(result)
        setHasLoadedOnce(true)
      })
      .catch((err) => {
        if (currentRequest !== requestId.current) return
        setError(err)
      })
      .finally(() => {
        if (currentRequest !== requestId.current) return
        setLoading(false)
      })
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(load, [
    requestFilters.dateFrom,
    requestFilters.dateTo,
    requestFilters.applicationStatus,
    requestFilters.oracleStatusCode,
    requestFilters.lineClosure,
    requestFilters.organizationCode,
    requestFilters.sourceSubinventory,
    requestFilters.destinationSubinventory,
    enabled,
    ...extraArgs,
  ])
  /* eslint-enable react-hooks/exhaustive-deps */

  return { data, loading, error, hasLoadedOnce, reload: load }
}
