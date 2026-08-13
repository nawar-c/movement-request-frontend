import { useEffect, useRef, useState } from 'react'
import { referenceApi } from '../api/referenceApi.js'

const MIN_CHARS = 3
const DEBOUNCE_MS = 300

export function useDebouncedItemSearch(organizationCode, term) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  useEffect(() => {
    const trimmed = term.trim()

    if (trimmed.length < MIN_CHARS) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)

    const timeout = setTimeout(() => {
      // The backend owns case normalization for description search.
      referenceApi
        .searchItems(organizationCode, trimmed)
        .then((data) => {
          if (currentRequest !== requestId.current) return
          setResults(data)
          setLoading(false)
        })
        .catch((err) => {
          if (currentRequest !== requestId.current) return
          setError(err)
          setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [organizationCode, term])

  return { results, loading, error, minChars: MIN_CHARS }
}
