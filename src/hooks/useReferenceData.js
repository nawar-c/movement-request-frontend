import { useEffect, useRef, useState } from 'react'
import { referenceApi } from '../api/referenceApi.js'

const EMPTY_DESTINATIONS_BY_ORG = {}

const cache = new Map()

function useCachedFetch(cacheKey, fetcher, deps, enabled = true) {
  const [state, setState] = useState(() => {
    const cached = cacheKey ? cache.get(cacheKey) : undefined
    return {
      data: cached || [],
      loading: enabled && !cached,
      error: null,
    }
  })
  const requestId = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setState({ data: [], loading: false, error: null })
      return
    }

    const cached = cacheKey ? cache.get(cacheKey) : undefined
    if (cached) {
      setState({ data: cached, loading: false, error: null })
      return
    }

    const currentRequest = ++requestId.current
    setState((prev) => ({ ...prev, loading: true, error: null }))

    fetcher()
      .then((data) => {
        if (currentRequest !== requestId.current) return
        if (cacheKey) cache.set(cacheKey, data)
        setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (currentRequest !== requestId.current) return
        setState({ data: [], loading: false, error })
      })

    return () => {
      requestId.current = currentRequest + 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

export function useOrganizations() {
  return useCachedFetch('organizations', () => referenceApi.getOrganizations(), [])
}

export function useUoms() {
  return useCachedFetch('uoms', () => referenceApi.getUoms(), [])
}

export function useReasons() {
  return useCachedFetch('reasons', () => referenceApi.getReasons(), [])
}

export function useSubinventories(organizationCode) {
  const key = organizationCode ? `subinventories:${organizationCode}` : null
  return useCachedFetch(
    key,
    () => referenceApi.getSubinventories(organizationCode),
    [organizationCode],
    Boolean(organizationCode),
  )
}

// Transfer-line Destination Subinventory. Backend scopes results to the current user's assigned
// destinations (unrestricted for ADMIN); this hook does no filtering of its own.
export function useDestinationSubinventories(organizationCode) {
  const key = organizationCode ? `destinationSubinventories:${organizationCode}` : null
  return useCachedFetch(
    key,
    () => referenceApi.getDestinationSubinventories(organizationCode),
    [organizationCode],
    Boolean(organizationCode),
  )
}

// Dashboard "More Filters" only (Phase 3): loads SOURCE-eligible subinventories (the `isSource`
// flag on /api/reference/subinventories) for several organizations at once, mirroring
// useDestinationSubinventoriesByOrganizations below so the Source Subinventory select can group
// options by organization without requiring an Organization filter to already be selected.
export function useSourceSubinventoriesByOrganizations(organizationCodes) {
  const key = organizationCodes.join(',')
  const [state, setState] = useState({ dataByOrg: EMPTY_DESTINATIONS_BY_ORG, loading: true, error: null })

  useEffect(() => {
    if (organizationCodes.length === 0) {
      setState({ dataByOrg: EMPTY_DESTINATIONS_BY_ORG, loading: false, error: null })
      return
    }
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    Promise.all(
      organizationCodes.map((code) =>
        referenceApi.getSubinventories(code).then((data) => [code, data.filter((s) => s.isSource)]),
      ),
    )
      .then((entries) => {
        if (cancelled) return
        setState({ dataByOrg: Object.fromEntries(entries), loading: false, error: null })
      })
      .catch((error) => {
        if (cancelled) return
        setState({ dataByOrg: EMPTY_DESTINATIONS_BY_ORG, loading: false, error })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}

// Admin user-definition screen only: loads destination subinventories for several organizations
// at once (one small request per org) so the assignment UI can group choices by organization.
export function useDestinationSubinventoriesByOrganizations(organizationCodes) {
  const key = organizationCodes.join(',')
  const [state, setState] = useState({ dataByOrg: EMPTY_DESTINATIONS_BY_ORG, loading: true, error: null })

  useEffect(() => {
    if (organizationCodes.length === 0) {
      setState({ dataByOrg: EMPTY_DESTINATIONS_BY_ORG, loading: false, error: null })
      return
    }
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    Promise.all(
      organizationCodes.map((code) => referenceApi.getDestinationSubinventories(code).then((data) => [code, data])),
    )
      .then((entries) => {
        if (cancelled) return
        setState({ dataByOrg: Object.fromEntries(entries), loading: false, error: null })
      })
      .catch((error) => {
        if (cancelled) return
        setState({ dataByOrg: EMPTY_DESTINATIONS_BY_ORG, loading: false, error })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}
