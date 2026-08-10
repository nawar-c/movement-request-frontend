import { API_BASE_URL } from '../config.js'

export class ApiError extends Error {
  constructor(message, { code, details, status } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code || 'UNKNOWN_ERROR'
    this.details = details || null
    this.status = status
  }
}

function buildUrl(path, params) {
  const url = new URL(path.replace(/^\//, ''), API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      url.searchParams.set(key, value)
    })
  }
  return url.toString()
}

async function request(method, path, { params, body } = {}) {
  const url = buildUrl(path, params)

  let response
  try {
    response = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', {
      code: 'NETWORK_ERROR',
    })
  }

  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw new ApiError('The server returned an unexpected response.', {
        code: 'PARSE_ERROR',
        status: response.status,
      })
    }
  }

  if (!response.ok || !payload || payload.success === false) {
    const error = payload?.error
    throw new ApiError(error?.message || `Request failed with status ${response.status}.`, {
      code: error?.code,
      details: error?.details,
      status: response.status,
    })
  }

  return payload.data
}

export const apiClient = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
}
