import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildInitialHeader,
  isCostCenterMissing,
  toEditHeaderFormState,
  toEditLineFormState,
} from '../src/utils/movementRequestHeader.js'
import { toLocalDateInputValue } from '../src/utils/formatters.js'
import { serializeHeaderForApi } from '../src/api/movementRequestSerializers.js'

/**
 * Phase E1 — Movement Request header foundation (Cost Center, Required Date).
 * Dependency-free Node test-runner tests, same DI-free/pure-function-extraction convention already
 * used on the backend (movementRequestHeaderPhaseB.test.js) — no new npm dependency, no rendering
 * framework. Component-rendering facts (e.g. "the Cost Center input is disabled/readOnly in the
 * DOM") that genuinely need a browser/DOM are instead covered by a source-structure check below
 * plus live read-only production validation (see the Phase E1 report), not invented here.
 */

// Real production values, fetched read-only during Phase E investigation/validation — used as
// fixtures so these tests are grounded in actual historical data shapes, not invented ones.
const MR_000039_HEADER = {
  inventoryOrganization: 'DRUG',
  requiredDate: '2026-12-08T00:00:00.000Z',
  description: null,
  costCenter: '1011001',
  sourceSubinventory: null, // pre-header-Source-Subinventory record — untouched this phase
}

const MR_000039_LINE_1 = {
  id: 'line-1-id',
  lineNumber: 1,
  itemNumber: '7206078',
  sourceSubinventory: 'DRUG_MAIN', // legacy line-level source — untouched this phase
  destinationAccount: '10-100-1010201-1110205-9999-9999-9999',
  transactionType: 'Movement Request Issue',
  requester: '2278', // legacy value — untouched this phase
  requiredDate: '2026-12-08T00:00:00.000Z',
}

describe('A/C — buildInitialHeader / isCostCenterMissing (Create)', () => {
  test('A. a configured Cost Center is used for the initial Create display value', () => {
    const header = buildInitialHeader({ costCenter: '1012903' })
    assert.equal(header.costCenter, '1012903')
  })

  test('C. no configured Cost Center -> isCostCenterMissing is true (blocks Create)', () => {
    assert.equal(isCostCenterMissing({ costCenter: null }), true)
    assert.equal(isCostCenterMissing({ costCenter: undefined }), true)
    assert.equal(isCostCenterMissing({ costCenter: '' }), true)
  })

  test('C. a configured Cost Center -> isCostCenterMissing is false (does not block Create)', () => {
    assert.equal(isCostCenterMissing({ costCenter: '1012903' }), false)
  })
})

describe('B — Cost Center is not editable on Create/Edit (source-structure check)', () => {
  test('MovementRequestHeaderForm.jsx renders Cost Center as a disabled/readOnly input, not a search/select control', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/MovementRequestHeaderForm.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.match(source, /Cost Center/)
    assert.match(source, /disabled/)
    assert.match(source, /readOnly/)
    // No lookup/search infrastructure for Cost Center remains in this component at all.
    assert.doesNotMatch(source, /LookupCombobox/)
    assert.doesNotMatch(source, /searchCostCenters/)
  })
})

describe('D — toEditHeaderFormState (Edit) always shows the stored snapshot', () => {
  test('the stored request Cost Center is used, independent of any "current user" concept — the function accepts no user/session argument at all', () => {
    const header = toEditHeaderFormState(MR_000039_HEADER)
    assert.equal(header.costCenter, '1011001')
    // Proof there is no session/user parameter this could have come from instead.
    assert.equal(toEditHeaderFormState.length, 1)
  })

  test('a different "current" user Cost Center has no bearing — toEditHeaderFormState only ever reads mr.costCenter', () => {
    const header = toEditHeaderFormState({ ...MR_000039_HEADER, costCenter: 'STORED-CC-DIFFERENT-FROM-SESSION-USER' })
    assert.equal(header.costCenter, 'STORED-CC-DIFFERENT-FROM-SESSION-USER')
  })
})

describe('E — serializeHeaderForApi never sends costCenter (create or update)', () => {
  test('a spoofed/attempted costCenter on the input header is dropped entirely — the key is absent, not null/empty', () => {
    const body = serializeHeaderForApi({
      inventoryOrganization: 'DRUG',
      requiredDate: '2026-08-20',
      description: 'test',
      costCenter: 'SPOOFED-CC-999',
    })
    assert.equal('costCenter' in body, false)
  })

  test('other header fields still serialize normally', () => {
    // sourceSubinventory is intentionally included here (Phase E2: header-level Source
    // Subinventory) — see test/movementRequestHeaderPhaseE2.test.js item B for its dedicated
    // coverage. This test's own concern (costCenter never appearing) is unaffected.
    const body = serializeHeaderForApi({
      inventoryOrganization: 'DRUG',
      requiredDate: '2026-08-20',
      description: 'test',
      sourceSubinventory: 'DRUG_MAIN',
    })
    assert.deepEqual(body, {
      inventoryOrganization: 'DRUG',
      requiredDate: '2026-08-20',
      description: 'test',
      sourceSubinventory: 'DRUG_MAIN',
    })
  })
})

describe('F/G — toLocalDateInputValue (Required Date default)', () => {
  test('F. buildInitialHeader defaults Required Date to local today', () => {
    const header = buildInitialHeader({ costCenter: '1012903' })
    assert.equal(header.requiredDate, toLocalDateInputValue())
  })

  test('G. timezone-safe: a near-midnight LOCAL time returns that same local calendar date, not a UTC-shifted one', () => {
    // new Date(year, monthIndex, day, hour, minute) sets LOCAL components directly, regardless of
    // the runner's own timezone — mirrors the backend's own resolveRequiredDateDefault test
    // technique exactly (movementRequestHeaderPhaseB.test.js), proving this doesn't go through UTC.
    const nearMidnightLocal = new Date(2026, 5, 15, 23, 45) // June 15, 2026, 23:45 local
    assert.equal(toLocalDateInputValue(nearMidnightLocal), '2026-06-15')
  })

  test('G. single-digit month/day are zero-padded', () => {
    const jan5 = new Date(2026, 0, 5)
    assert.equal(toLocalDateInputValue(jan5), '2026-01-05')
  })
})

describe('H — Edit preserves the stored Required Date (no regression)', () => {
  test('MR-000039\'s real stored requiredDate maps to the exact calendar date, unshifted', () => {
    const header = toEditHeaderFormState(MR_000039_HEADER)
    assert.equal(header.requiredDate, '2026-12-08')
  })
})

describe('I — historical request mapping remains readable', () => {
  test('a pre-header-Source-Subinventory record (header.sourceSubinventory: null) maps without crashing', () => {
    assert.doesNotThrow(() => toEditHeaderFormState(MR_000039_HEADER))
    const header = toEditHeaderFormState(MR_000039_HEADER)
    assert.equal(header.inventoryOrganization, 'DRUG')
    assert.equal(header.costCenter, '1011001')
  })

  test('a legacy line carrying requester/sourceSubinventory maps without crashing and preserves those legacy fields untouched (removal is a later phase, not this one)', () => {
    assert.doesNotThrow(() => toEditLineFormState(MR_000039_LINE_1))
    const line = toEditLineFormState(MR_000039_LINE_1)
    assert.equal(line.requester, '2278')
    assert.equal(line.sourceSubinventory, 'DRUG_MAIN')
    assert.equal(line.requiredDate, '2026-12-08')
  })
})
