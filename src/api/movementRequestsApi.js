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

// Transaction type is derived and owned entirely by the backend (per item chargeable flag +
// organization). The line schema rejects transactionType/transactionTypeId as unrecognized keys
// on create/update, so they must never be sent — only read back from server responses for display.
function serializeLineForApi(line) {
  const quantity = toNumberOrNull(line.requestedQuantity)
  const secondaryQuantity = toNumberOrNull(line.secondaryRequestedQuantity)

  return {
    itemNumber: line.itemNumber || undefined,
    itemDescription: line.itemDescription || undefined,
    requestedQuantity: quantity ?? undefined,
    uom: line.uom || undefined,
    requiredDate: line.requiredDate || undefined,
    sourceSubinventory: line.sourceSubinventory || undefined,
    destinationSubinventory: line.destinationSubinventory || undefined,
    destinationAccount: line.destinationAccount || undefined,
    destinationAccountId: line.destinationAccountId || undefined,
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

// Transaction Type, Source Subinventory, Destination Subinventory, and Destination Account are
// now line-level concepts (a single request can mix Issue and Transfer lines) and are no longer
// part of the header contract. Movement Request Type (the Oracle header concept, e.g.
// "Requisition") is not user-selectable — the backend defaults it on its own when omitted, so it
// is intentionally never sent here.
function serializeHeaderForApi(header) {
  return {
    inventoryOrganization: header.inventoryOrganization || undefined,
    requiredDate: header.requiredDate || undefined,
    description: header.description || undefined,
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

  // GET-only against Oracle: refreshes oracleStatus/oracleStatusCode/oracleResponse without
  // touching localStatus, oracleHeaderId, or oracleRequestNumber.
  refreshOracleStatus: async (id) => {
    const data = await apiClient.post(`/api/movement-requests/${id}/refresh-status`)
    return normalizeMovementRequest(data)
  },
}
