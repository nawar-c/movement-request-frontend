import { useEffect, useRef, useState } from 'react'

// Generic loader for a single reporting endpoint, driven by the shared dashboard filter state.
// Mirrors the race-guard pattern already used for dashboard-summary in Phase 1, generalized so
// each chart's data/loading/error is independent — one endpoint failing never clears another's
// data or blocks the rest of the dashboard.
export function useReportResource(fetcher, requestFilters) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const requestId = useRef(0)

  function load() {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    fetcher(requestFilters)
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

  useEffect(
    load,
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

  return { data, loading, error, hasLoadedOnce, reload: load }
}
