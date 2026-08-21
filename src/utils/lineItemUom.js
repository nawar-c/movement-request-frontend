// Phase E3 — Item/UOM redesign. Mirrors the backend's own authoritative rule exactly
// (buildValidUomRecords / resolveAndValidateLines in movementRequest.service.js): an item's valid
// UOMs are its Oracle Primary UOM (always exactly one) plus its Secondary UOM when Oracle's
// dual-UOM tracking is enabled for that item. Kept in a plain .js module (not the .jsx drawer it's
// used from) so it's directly unit-testable with Node's built-in test runner, which cannot parse
// JSX — same convention as movementRequestHeader.js.

// Exact wording matches the backend's authoritative message (see resolveAndValidateLines in
// movement-request-backend/src/services/movementRequest.service.js) — this is the client-side
// early-warning for the same condition, not a different message for the same problem.
export const ZERO_VALID_UOM_MESSAGE = 'Item has no valid Oracle UOM configured. Please contact the administrator.'

export function isUomValidForItem(uomCode, validUoms) {
  return Boolean(uomCode) && Array.isArray(validUoms) && validUoms.some((u) => u.uomCode === uomCode)
}

// Every item selection clears whatever UOM was previously chosen, then re-derives it purely from
// the newly selected item's own validUoms — never carried over from a previously selected,
// unrelated item. One valid UOM auto-selects; multiple default to the Oracle-flagged primary;
// zero leaves the field blank (the caller is responsible for blocking Save Line in that case).
export function resolveUomForItem(validUoms) {
  if (!validUoms || validUoms.length === 0) return ''
  if (validUoms.length === 1) return validUoms[0].uomCode
  const primary = validUoms.find((u) => u.isPrimary)
  return primary ? primary.uomCode : validUoms[0].uomCode
}

// Historical Edit re-resolution: a stored line's UOM may no longer be one of its item's currently
// valid UOMs (Oracle data can change over time). It must never be silently kept as if still fine —
// clear it and require the user to explicitly re-select before the line can be saved. View mode is
// unaffected by this — it is only ever called from the editable Line drawer, never from the
// read-only Lines table.
export function reconcileHistoricalUom(storedUom, validUoms) {
  if (isUomValidForItem(storedUom, validUoms)) {
    return { uom: storedUom, invalid: false }
  }
  return { uom: '', invalid: true }
}

// Fail-closed — matches the backend's authoritative MR-write gate exactly, not the read/search
// reference endpoint's own (fail-open) filter. See resolveAndValidateLines in
// movement-request-backend/src/services/movementRequest.service.js: only a literal 'Active' is
// accepted; Inactive, null, and undefined are all rejected there ("is not active or its status
// could not be determined" — confirmed via that service's own explicit unresolved-status fixture,
// DEMO-DRUG-ITEM-NULLSTATUS, and its Phase C final-pre-commit-review test coverage). The read/browse
// reference endpoint (reference.controller.js's getItems) deliberately stays fail-open for a missing
// status — that leniency exists to keep search/browse resilient to occasional incomplete Oracle
// metadata, and does not extend to this line-save gate, which exists specifically to stop the user
// before Save Line rather than let the backend be the only place this is ever caught.
export function isItemActive(item) {
  return item.itemStatus === 'Active'
}

// Exact wording mirrors the backend's authoritative message content (see above) — the client-side
// early-warning for the same condition, not a different message for the same problem.
export function buildItemInactiveMessage(itemNumber) {
  return `Item "${itemNumber}" is not active or its status could not be determined.`
}

export function buildItemUnavailableMessage(itemNumber) {
  return `Item "${itemNumber}" could not be found. Please select a different item.`
}

export function buildStaleUomMessage(storedUom, validUoms) {
  const options = validUoms.map((u) => u.uomCode).join(', ') || 'none available'
  return `The previously selected UOM "${storedUom}" is no longer valid for this item. Please select one of: ${options}.`
}
