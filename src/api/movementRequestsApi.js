import { apiClient } from './client.js'
import { toNumberOrNull, serializeLineForApi, serializeHeaderForApi } from './movementRequestSerializers.js'

function normalizeLine(line) {
  return {
    ...line,
    requestedQuantity: toNumberOrNull(line.requestedQuantity),
    secondaryRequestedQuantity: toNumberOrNull(line.secondaryRequestedQuantity),
  }
}

function normalizeMovementRequest(mr) {
  if (!mr) return mr
  return {
    ...mr,
    lines: Array.isArray(mr.lines) ? mr.lines.map(normalizeLine) : mr.lines,
  }
}

export const movementRequestsApi = {
  list: async (params) => {
    const data = await apiClient.get('/api/movement-requests', params)
    return { ...data, items: data.items.map(normalizeMovementRequest) }
  },

  get: async (id) => {
    const data = await apiClient.get(`/api/movement-requests/${id}`)
    return normalizeMovementRequest(data)
  },

  create: async (header, lines = []) => {
    const body = {
      ...serializeHeaderForApi(header),
      lines: lines.map(serializeLineForApi),
    }
    const data = await apiClient.post('/api/movement-requests', body)
    return normalizeMovementRequest(data)
  },

  update: async (id, header, lines) => {
    const body = {
      ...serializeHeaderForApi(header),
      ...(lines ? { lines: lines.map(serializeLineForApi) } : {}),
    }
    const data = await apiClient.patch(`/api/movement-requests/${id}`, body)
    return normalizeMovementRequest(data)
  },

  submit: async (id) => {
    const data = await apiClient.post(`/api/movement-requests/${id}/submit`)
    return normalizeMovementRequest(data)
  },

  // GET-only against Oracle: refreshes oracleStatus/oracleStatusCode/oracleResponse without
  // touching localStatus, oracleHeaderId, or oracleRequestNumber.
  refreshOracleStatus: async (id) => {
    const data = await apiClient.post(`/api/movement-requests/${id}/refresh-status`)
    return normalizeMovementRequest(data)
  },
}
