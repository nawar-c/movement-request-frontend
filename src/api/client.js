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

const TOKEN_STORAGE_KEY = 'mr_auth_token'

export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

// Registered by AuthProvider so this module can react to session-affecting errors without
// importing React/router code directly. Handles 401 (session invalid/expired) and 403
// PASSWORD_CHANGE_REQUIRED (session valid, but must change password before continuing) —
// these are deliberately NOT treated the same way, see AuthProvider.
let authErrorHandler = null
export function setAuthErrorHandler(handler) {
  authErrorHandler = handler
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

async function request(method, path, { params, body, skipAuthHandling } = {}) {
  const url = buildUrl(path, params)

  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let response
  try {
    response = await fetch(url, {
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
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
    const apiError = new ApiError(error?.message || `Request failed with status ${response.status}.`, {
      code: error?.code,
      details: error?.details,
      status: response.status,
    })

    if (!skipAuthHandling && authErrorHandler) {
      const isSessionExpired = response.status === 401
      const isPasswordChangeRequired = response.status === 403 && error?.code === 'PASSWORD_CHANGE_REQUIRED'
      if (isSessionExpired || isPasswordChangeRequired) {
        authErrorHandler(apiError)
      }
    }

    throw apiError
  }

  return payload.data
}

export const apiClient = {
  get: (path, params, options) => request('GET', path, { params, ...options }),
  post: (path, body, options) => request('POST', path, { body, ...options }),
  patch: (path, body, options) => request('PATCH', path, { body, ...options }),
  put: (path, body, options) => request('PUT', path, { body, ...options }),
}
