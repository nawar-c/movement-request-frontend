import { apiClient } from './client.js'

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

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

function serializeLineForApi(line) {
  const quantity = toNumberOrNull(line.requestedQuantity)
  const secondaryQuantity = toNumberOrNull(line.secondaryRequestedQuantity)

  return {
    itemNumber: line.itemNumber || undefined,
    itemDescription: line.itemDescription || undefined,
    requestedQuantity: quantity ?? undefined,
    uom: line.uom || undefined,
    requiredDate: line.requiredDate || undefined,
    transactionType: line.transactionType || undefined,
    sourceSubinventory: line.sourceSubinventory || undefined,
    sourceLocator: line.sourceLocator || undefined,
    destinationSubinventory: line.destinationSubinventory || undefined,
    destinationLocator: line.destinationLocator || undefined,
    destinationAccount: line.destinationAccount || undefined,
    requester: line.requester || undefined,
    reason: line.reason || undefined,
    reference: line.reference || undefined,
    secondaryRequestedQuantity: secondaryQuantity ?? undefined,
    secondaryUom: line.secondaryUom || undefined,
    lotNumber: line.lotNumber || undefined,
    grade: line.grade || undefined,
    fromSerialNumber: line.fromSerialNumber || undefined,
  }
}

function serializeHeaderForApi(header) {
  return {
    inventoryOrganization: header.inventoryOrganization || undefined,
    movementRequestType: header.movementRequestType || undefined,
    transactionType: header.transactionType || undefined,
    requiredDate: header.requiredDate || undefined,
    description: header.description || undefined,
    sourceSubinventory: header.sourceSubinventory || undefined,
    destinationSubinventory: header.destinationSubinventory || undefined,
    destinationAccount: header.destinationAccount || undefined,
    costCenter: header.costCenter || undefined,
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
}
