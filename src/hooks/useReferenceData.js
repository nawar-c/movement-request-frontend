import { useEffect, useRef, useState } from 'react'
import { referenceApi } from '../api/referenceApi.js'

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
