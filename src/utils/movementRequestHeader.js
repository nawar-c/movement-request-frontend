import { toLocalDateInputValue, toDateInputValue } from './formatters.js'

// Cost Center is the authenticated user's configured value — never user-editable, never re-derived
// from anything the user could type. Required Date defaults to today's LOCAL calendar date (never
// toISOString(), which can shift the date across timezones). Kept in a plain .js module (not the
// .jsx page it's used from) so it's directly unit-testable with Node's built-in test runner, which
// cannot parse JSX.
export function buildInitialHeader(user) {
  return {
    inventoryOrganization: null,
    requiredDate: toLocalDateInputValue(),
    description: '',
    costCenter: user.costCenter || null,
    sourceSubinventory: null,
  }
}

export function isCostCenterMissing(user) {
  return !user.costCenter
}

// Phase E2: one Movement Request = one Source Subinventory, now a header field.
// mr.sourceSubinventory (once present) is authoritative and used as-is. Historical requests
// created before this field existed have it null — for those, fall back to the lines: if every
// existing line agrees on one sourceSubinventory, use that as a compatibility display/edit value;
// if they disagree (e.g. MR-000039: DRUG_MAIN vs INPHR_DRUG), do not invent a value — the caller
// must show `conflict` and require an explicit user selection before saving.
export function deriveHeaderSourceSubinventory(mr) {
  if (mr.sourceSubinventory) {
    return { value: mr.sourceSubinventory, conflict: false }
  }
  const distinct = [...new Set((mr.lines || []).map((line) => line.sourceSubinventory).filter(Boolean))]
  if (distinct.length === 1) {
    return { value: distinct[0], conflict: false }
  }
  if (distinct.length === 0) {
    return { value: null, conflict: false }
  }
  return { value: null, conflict: true }
}

// Edit's header mapping — costCenter is the request's permanent creator-time snapshot, never
// re-resolved from the current session's user, never client-editable. Existing historical requests
// (created before per-user Cost Center configuration existed, or before Source Subinventory moved
// to the header) keep showing whatever was actually captured for them.
export function toEditHeaderFormState(mr) {
  const { value: sourceSubinventory, conflict } = deriveHeaderSourceSubinventory(mr)
  return {
    inventoryOrganization: mr.inventoryOrganization,
    requiredDate: toDateInputValue(mr.requiredDate),
    description: mr.description || '',
    costCenter: mr.costCenter,
    sourceSubinventory,
    sourceSubinventoryConflict: conflict,
  }
}

// Phase G5A: auto-select a Source Subinventory when it's the only valid option for the currently
// selected Inventory Organization AND the field is genuinely empty. Two cases deliberately do NOT
// count as "empty" here even though the field's value is falsy:
//   - an existing value is present (never overwrite a real selection, including one restored from
//     history via toEditHeaderFormState below);
//   - hasConflict is true (deriveHeaderSourceSubinventory's conflict state IS historical data — the
//     lines genuinely disagree - silently picking the org's one valid option would hide that
//     disagreement from the user instead of letting them consciously resolve it, same as before).
// 0 or 2+ options: returns the current value unchanged (null stays null) - existing required-field
// validation and the "select one" UX are untouched.
export function resolveAutoSelectedSourceSubinventory(currentValue, sourceOptions, hasConflict) {
  if (currentValue || hasConflict) return currentValue
  if (!Array.isArray(sourceOptions) || sourceOptions.length !== 1) return currentValue
  return sourceOptions[0].code
}

// Every line field (item, source/destination subinventory or account) is organization-scoped, and
// so is the header Source Subinventory — a changed organization must clear both rather than
// silently retaining a selection that may not even exist as an option for the new organization.
export function applyOrgChange(prevHeader, nextHeader) {
  if (nextHeader.inventoryOrganization === prevHeader.inventoryOrganization) {
    return { header: nextHeader, shouldClearLines: false }
  }
  return {
    header: { ...nextHeader, sourceSubinventory: null, sourceSubinventoryConflict: false },
    shouldClearLines: true,
  }
}

// Unchanged this phase — kept alongside toEditHeaderFormState purely so historical-record mapping
// (header + lines together, e.g. a pre-header-Source-Subinventory record like MR-000039) is
// testable as a pair without rendering the Edit page.
export function toEditLineFormState(line) {
  return {
    ...line,
    clientId: line.id,
    requiredDate: toDateInputValue(line.requiredDate),
  }
}
