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
//
// Phase E2: sourceSubinventory is now sent once, at the header (see serializeHeaderForApi below) —
// the backend's lineSchema still accepts it per-line for deployment-transport compatibility with an
// older frontend, but the header value is authoritative and overrides it unconditionally
// (resolveHeaderSourceSubinventory), so sending a redundant/possibly-stale line value serves no
// purpose. requester is likewise no longer sent — the backend's line schema now rejects it outright
// via .strict() (Phase C removed it from the accepted contract entirely).
//
// Phase E4 (final review — corrected): destinationAccount/destinationAccountId ARE still sent.
// header.destinationAccountId is only resolved ONCE, at create time (or when the organization
// itself changes on an edit) — it is a permanent snapshot, never retroactively backfilled onto a
// request created before its organization had a configured default. Real production data (e.g.
// MR-000039) still has header.destinationAccountId = null with a real, historically-stored
// destinationAccountId on its Issue line. Since the Edit page always resends the full `lines` array
// on Save, omitting these fields here would make resolveAndValidateLines resolve
// `header.destinationAccountId ?? line.destinationAccountId` to nothing at all for such a request —
// blocking an unrelated Save with "destinationAccountId is required for Issue lines", not silent
// data loss, but a real regression. LineEditDrawer.jsx is still the only writer of these two form
// fields, and only ever from a trusted source: the line's own preserved historical snapshot
// (untouched selection) or the resolved value from the USER-safe reference endpoint
// (freshly (re-)selected item) — never free text, never a manual picker.
export function serializeLineForApi(line) {
  const quantity = toNumberOrNull(line.requestedQuantity)
  const secondaryQuantity = toNumberOrNull(line.secondaryRequestedQuantity)

  return {
    itemNumber: line.itemNumber || undefined,
    itemDescription: line.itemDescription || undefined,
    requestedQuantity: quantity ?? undefined,
    uom: line.uom || undefined,
    requiredDate: line.requiredDate || undefined,
    destinationSubinventory: line.destinationSubinventory || undefined,
    destinationAccount: line.destinationAccount || undefined,
    destinationAccountId: line.destinationAccountId || undefined,
    reason: line.reason || undefined,
    reference: line.reference || undefined,
    secondaryRequestedQuantity: secondaryQuantity ?? undefined,
    secondaryUom: line.secondaryUom || undefined,
    lotNumber: line.lotNumber || undefined,
    grade: line.grade || undefined,
    fromSerialNumber: line.fromSerialNumber || undefined,
  }
}

// Transaction Type, Destination Subinventory, and Destination Account are line-level concepts (a
// single request can mix Issue and Transfer lines) and are not part of the header contract.
// Movement Request Type (the Oracle header concept, e.g. "Requisition") is not user-selectable —
// the backend defaults it on its own when omitted, so it is intentionally never sent here.
//
// costCenter is likewise never sent (Phase E1): the backend resolves it from the authenticated
// creator's configured Cost Center on create (resolveCreateCostCenter) and unconditionally strips
// any client-sent value from a PATCH before it's ever merged/persisted
// (stripClientCostCenterFromPatch) — the client is no longer authoritative for this field at all,
// so there is nothing correct to serialize here even as a fallback.
//
// sourceSubinventory (Phase E2): one Movement Request = one Source Subinventory, sent once here at
// the header. The backend re-resolves and persists it authoritatively (resolveHeaderSourceSubinventory)
// on both create and update.
export function serializeHeaderForApi(header) {
  return {
    inventoryOrganization: header.inventoryOrganization || undefined,
    requiredDate: header.requiredDate || undefined,
    description: header.description || undefined,
    sourceSubinventory: header.sourceSubinventory || undefined,
  }
}
