import { useCallback, useEffect, useState } from 'react'
import { movementRequestsApi } from '../api/movementRequestsApi.js'

export function useMovementRequest(id) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    return movementRequestsApi
      .get(id)
      .then((mr) => setData(mr))
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
