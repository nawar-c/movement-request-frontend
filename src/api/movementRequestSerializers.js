// Pure request-body builders — no apiClient/network dependency, so they're directly unit-testable
// with Node's built-in test runner (unlike movementRequestsApi.js, which imports config.js's
// import.meta.env and therefore can't run outside a Vite context).

export function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

// Transaction type is derived and owned entirely by the backend (per item chargeable flag +
// organization). The line schema rejects transactionType/transactionTypeId as unrecognized keys
// on create/update, so they must never be sent — only read back from server responses for display.
export function serializeLineForApi(line) {
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
//
// costCenter is likewise never sent (Phase E1): the backend resolves it from the authenticated
// creator's configured Cost Center on create (resolveCreateCostCenter) and unconditionally strips
// any client-sent value from a PATCH before it's ever merged/persisted
// (stripClientCostCenterFromPatch) — the client is no longer authoritative for this field at all,
// so there is nothing correct to serialize here even as a fallback.
export function serializeHeaderForApi(header) {
  return {
    inventoryOrganization: header.inventoryOrganization || undefined,
    requiredDate: header.requiredDate || undefined,
    description: header.description || undefined,
  }
}
