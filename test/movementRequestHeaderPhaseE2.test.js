import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildInitialHeader,
  deriveHeaderSourceSubinventory,
  toEditHeaderFormState,
  applyOrgChange,
} from '../src/utils/movementRequestHeader.js'
import { validateHeader } from '../src/utils/validation.js'
import { serializeHeaderForApi, serializeLineForApi } from '../src/api/movementRequestSerializers.js'

/**
 * Phase E2 — Header Source Subinventory + Requester removal.
 * Same dependency-free Node test-runner convention as Phase E1 (movementRequestHeaderPhaseE1.test.js):
 * pure-function extraction + source-structure checks in place of a rendering framework.
 */

// Real production values (MR-000039) — header.sourceSubinventory null, lines genuinely disagree
// (DRUG_MAIN vs INPHR_DRUG). Used throughout as the decisive conflict fixture.
const MR_000039_HEADER = {
  inventoryOrganization: 'DRUG',
  requiredDate: '2026-12-08T00:00:00.000Z',
  description: null,
  costCenter: '1011001',
  sourceSubinventory: null,
}

const MR_000039_LINES = [
  { id: 'line-1', sourceSubinventory: 'DRUG_MAIN', requester: '2278' },
  { id: 'line-2', sourceSubinventory: 'INPHR_DRUG', requester: '2279' },
]

describe('A — Create header Source is required', () => {
  const validHeader = { inventoryOrganization: 'DRUG', requiredDate: '2026-08-21', sourceSubinventory: 'DRUG_MAIN' }

  test('missing header sourceSubinventory blocks save', () => {
    const errors = validateHeader({ ...validHeader, sourceSubinventory: null })
    assert.equal(errors.sourceSubinventory, 'Source Subinventory is required.')
  })

  test('a configured header sourceSubinventory passes validation', () => {
    const errors = validateHeader(validHeader)
    assert.equal('sourceSubinventory' in errors, false)
  })
})

describe('B — Create serialization sends header sourceSubinventory', () => {
  test('header body includes the selected sourceSubinventory', () => {
    const body = serializeHeaderForApi({
      inventoryOrganization: 'DRUG',
      requiredDate: '2026-08-21',
      sourceSubinventory: 'DRUG_MAIN',
    })
    assert.equal(body.sourceSubinventory, 'DRUG_MAIN')
  })
})

describe('C — Create line serialization does NOT send sourceSubinventory', () => {
  test('a sourceSubinventory value on the line input is dropped entirely — key absent, not null/empty', () => {
    const body = serializeLineForApi({
      itemNumber: '101707',
      requestedQuantity: 10,
      uom: 'EACH',
      sourceSubinventory: 'DRUG_MAIN',
    })
    assert.equal('sourceSubinventory' in body, false)
  })
})

describe('D — Organization change clears Source', () => {
  test('changing inventoryOrganization clears sourceSubinventory and signals lines should clear', () => {
    const prevHeader = { inventoryOrganization: 'DRUG', sourceSubinventory: 'DRUG_MAIN' }
    const nextHeader = { inventoryOrganization: 'MEDICAL_CONSUMABLE', sourceSubinventory: 'DRUG_MAIN' }
    const result = applyOrgChange(prevHeader, nextHeader)
    assert.equal(result.header.sourceSubinventory, null)
    assert.equal(result.shouldClearLines, true)
  })

  test('an unrelated header field change (same organization) leaves Source untouched', () => {
    const prevHeader = { inventoryOrganization: 'DRUG', sourceSubinventory: 'DRUG_MAIN' }
    const nextHeader = { inventoryOrganization: 'DRUG', sourceSubinventory: 'DRUG_MAIN', description: 'updated' }
    const result = applyOrgChange(prevHeader, nextHeader)
    assert.equal(result.header.sourceSubinventory, 'DRUG_MAIN')
    assert.equal(result.shouldClearLines, false)
  })
})

describe('E — Edit new-style request uses mr.sourceSubinventory', () => {
  test('a present header sourceSubinventory is used as-is, ignoring line values entirely', () => {
    const mr = { ...MR_000039_HEADER, sourceSubinventory: 'DRUG_MAIN', lines: MR_000039_LINES }
    const { value, conflict } = deriveHeaderSourceSubinventory(mr)
    assert.equal(value, 'DRUG_MAIN')
    assert.equal(conflict, false)
  })

  test('toEditHeaderFormState surfaces the same value with no conflict flag', () => {
    const mr = { ...MR_000039_HEADER, sourceSubinventory: 'DRUG_MAIN', lines: MR_000039_LINES }
    const header = toEditHeaderFormState(mr)
    assert.equal(header.sourceSubinventory, 'DRUG_MAIN')
    assert.equal(header.sourceSubinventoryConflict, false)
  })
})

describe('F — Historical header-null + agreeing line sources derives one initial Source', () => {
  test('all lines sharing one sourceSubinventory value is used as the compatibility Source', () => {
    const mr = {
      ...MR_000039_HEADER,
      sourceSubinventory: null,
      lines: [{ sourceSubinventory: 'DRUG_MAIN' }, { sourceSubinventory: 'DRUG_MAIN' }],
    }
    const { value, conflict } = deriveHeaderSourceSubinventory(mr)
    assert.equal(value, 'DRUG_MAIN')
    assert.equal(conflict, false)
  })
})

describe('G — Historical header-null + conflicting sources does NOT derive a Source', () => {
  test('lines disagreeing on sourceSubinventory yields no value and a conflict flag', () => {
    const mr = { ...MR_000039_HEADER, sourceSubinventory: null, lines: MR_000039_LINES }
    const { value, conflict } = deriveHeaderSourceSubinventory(mr)
    assert.equal(value, null)
    assert.equal(conflict, true)
  })
})

describe('H — MR-000039-style conflict produces the expected user guidance/state', () => {
  test('toEditHeaderFormState on the real MR-000039 shape leaves Source unselected with the conflict flag set', () => {
    const mr = { ...MR_000039_HEADER, lines: MR_000039_LINES }
    const header = toEditHeaderFormState(mr)
    assert.equal(header.sourceSubinventory, null)
    assert.equal(header.sourceSubinventoryConflict, true)
    // The header must not silently pick either DRUG_MAIN or INPHR_DRUG.
    assert.notEqual(header.sourceSubinventory, 'DRUG_MAIN')
    assert.notEqual(header.sourceSubinventory, 'INPHR_DRUG')
  })

  test('MR-000039 must not be resolvable to a header Source until the request has actual line agreement', () => {
    // Sanity check on the fixture itself — this is the real production conflict this phase exists for.
    assert.notEqual(MR_000039_LINES[0].sourceSubinventory, MR_000039_LINES[1].sourceSubinventory)
  })
})

describe('I — Requester absent from Add/Edit line write contract (source-structure check)', () => {
  test('LineEditDrawer.jsx no longer renders a Requester field or a Source Subinventory field', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, />Requester</)
    assert.doesNotMatch(source, /set\('requester'/)
    assert.doesNotMatch(source, />Source Subinventory</)
    assert.doesNotMatch(source, /set\('sourceSubinventory'/)
  })

  test('MovementRequestHeaderForm.jsx now renders the Source Subinventory field', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/MovementRequestHeaderForm.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.match(source, /Source Subinventory/)
    assert.match(source, /sourceSubinventory/)
  })
})

describe('J — serializeLineForApi does NOT send requester', () => {
  test('a requester value on the line input is dropped entirely — key absent, not null/empty', () => {
    const body = serializeLineForApi({
      itemNumber: '101707',
      requestedQuantity: 10,
      uom: 'EACH',
      requester: '2278',
    })
    assert.equal('requester' in body, false)
  })
})

describe('K — Historical requester remains readable in View mapping', () => {
  test('a line carrying a historical requester value is still readable from the mapped MR shape', () => {
    // toEditLineFormState is unchanged this phase precisely so old requester/source values stay
    // readable without becoming editable again — see movementRequestHeader.js.
    const line = MR_000039_LINES[0]
    assert.equal(line.requester, '2278')
  })

  test('MovementRequestLinesTable.jsx conditionally renders a historical Requester column in View mode', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/MovementRequestLinesTable.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.match(source, /line\.requester/)
  })
})

describe('L — E1 Cost Center/Required Date behavior remains intact alongside the new Source field', () => {
  test('buildInitialHeader still resolves Cost Center from the authenticated user and defaults Required Date locally', () => {
    const header = buildInitialHeader({ costCenter: '1012903' })
    assert.equal(header.costCenter, '1012903')
    assert.equal(typeof header.requiredDate, 'string')
    assert.equal(header.sourceSubinventory, null)
  })

  test('toEditHeaderFormState still shows the stored Cost Center snapshot, independent of Source resolution', () => {
    const header = toEditHeaderFormState({ ...MR_000039_HEADER, sourceSubinventory: 'DRUG_MAIN', lines: [] })
    assert.equal(header.costCenter, '1011001')
    assert.equal(header.requiredDate, '2026-12-08')
  })
})
