import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolveAutoSelectedSourceSubinventory, applyOrgChange } from '../src/utils/movementRequestHeader.js'
import { resolveAutoSelectedDestinationSubinventory } from '../src/utils/lineDestinationSubinventory.js'

/**
 * Phase G5A — single-option auto-selection for MR Header Source Subinventory and Transfer-line
 * Destination Subinventory. Same dependency-free Node test-runner convention as every prior phase
 * (movementRequestHeaderPhaseE2.test.js, movementRequestItemUomPhaseE3.test.js): pure-function
 * extraction + source-structure checks in place of a rendering framework.
 *
 * Real production fixtures used throughout (read-only investigation, see G5A investigation report):
 *   GENERAL STORE org  -> 1 Source Subinventory
 *   MEDICAL_CONSUMABLE org -> 1 Source Subinventory, and user 1224 has exactly 1 authorized
 *     Destination Subinventory there
 *   DRUG org -> 2 Source Subinventories, and user 1224 has 0 authorized Destination Subinventories
 *     there
 */

const ONE_SOURCE = [{ code: 'GENRL_MAIN', name: 'General Main Store', isSource: true }]
const TWO_SOURCES = [
  { code: 'DRUG_MAIN', name: 'Drug Main', isSource: true },
  { code: 'INPHR_DRUG', name: 'Inpharmacy Drug', isSource: true },
]
const ONE_DESTINATION = [{ code: 'MED_MAIN', name: 'Medical Main Store' }]
const TWO_DESTINATIONS = [
  { code: 'ER_DRUG', name: 'ER Drug' },
  { code: 'ICU_DRUG', name: 'ICU Drug' },
]

describe('A/B/C — Source Subinventory: option-count behavior when the field is empty', () => {
  test('A. 0 options -> stays null, no auto-select', () => {
    assert.equal(resolveAutoSelectedSourceSubinventory(null, [], false), null)
  })

  test('B. 1 option (real GENERAL STORE case) + empty -> auto-selects it', () => {
    assert.equal(resolveAutoSelectedSourceSubinventory(null, ONE_SOURCE, false), 'GENRL_MAIN')
  })

  test('C. 2+ options (real DRUG org case) + empty -> stays null, user must choose', () => {
    assert.equal(resolveAutoSelectedSourceSubinventory(null, TWO_SOURCES, false), null)
  })
})

describe('D — Source Subinventory: an existing value is NEVER overwritten', () => {
  test('a manually-selected value is preserved even though exactly 1 (different) option exists', () => {
    const result = resolveAutoSelectedSourceSubinventory('DRUG_MAIN', ONE_SOURCE, false)
    assert.equal(result, 'DRUG_MAIN')
    assert.notEqual(result, ONE_SOURCE[0].code)
  })

  test('an existing value is preserved even when the option list is now empty (e.g. still loading/stale)', () => {
    assert.equal(resolveAutoSelectedSourceSubinventory('DRUG_MAIN', [], false), 'DRUG_MAIN')
  })
})

describe('E — Source Subinventory: organization change clears then re-resolves', () => {
  test('applyOrgChange clears the old Source (unchanged G2 behavior)', () => {
    const prevHeader = { inventoryOrganization: 'DRUG', sourceSubinventory: 'DRUG_MAIN' }
    const nextHeader = { inventoryOrganization: 'GENERAL', sourceSubinventory: 'DRUG_MAIN' }
    const result = applyOrgChange(prevHeader, nextHeader)
    assert.equal(result.header.sourceSubinventory, null)
    assert.equal(result.shouldClearLines, true)
  })

  test('after the clear, the new organization (1 Source) auto-selects', () => {
    const cleared = applyOrgChange(
      { inventoryOrganization: 'DRUG', sourceSubinventory: 'DRUG_MAIN' },
      { inventoryOrganization: 'GENERAL', sourceSubinventory: 'DRUG_MAIN' },
    ).header
    const resolved = resolveAutoSelectedSourceSubinventory(cleared.sourceSubinventory, ONE_SOURCE, false)
    assert.equal(resolved, 'GENRL_MAIN')
  })

  test('after the clear, the new organization (2 Sources) stays empty', () => {
    const cleared = applyOrgChange(
      { inventoryOrganization: 'GENERAL', sourceSubinventory: 'GENRL_MAIN' },
      { inventoryOrganization: 'DRUG', sourceSubinventory: 'GENRL_MAIN' },
    ).header
    const resolved = resolveAutoSelectedSourceSubinventory(cleared.sourceSubinventory, TWO_SOURCES, false)
    assert.equal(resolved, null)
  })

  test('after the clear, an organization with 0 Sources stays empty', () => {
    const cleared = applyOrgChange(
      { inventoryOrganization: 'DRUG', sourceSubinventory: 'DRUG_MAIN' },
      { inventoryOrganization: 'MEDICAL_CONSUMABLE', sourceSubinventory: 'DRUG_MAIN' },
    ).header
    const resolved = resolveAutoSelectedSourceSubinventory(cleared.sourceSubinventory, [], false)
    assert.equal(resolved, null)
  })
})

describe('F — Source Subinventory: Edit/historical preservation', () => {
  test('a genuine historical value (from toEditHeaderFormState) is never overwritten even with 1 option available', () => {
    const historicalValue = 'DRUG_MAIN' // e.g. deriveHeaderSourceSubinventory's single-line-agreement case
    assert.equal(resolveAutoSelectedSourceSubinventory(historicalValue, ONE_SOURCE, false), 'DRUG_MAIN')
  })

  test('a genuine multi-line conflict (MR-000039-style) is NOT silently resolved even with exactly 1 option now available', () => {
    // hasConflict=true is the toEditHeaderFormState sourceSubinventoryConflict flag - conflicting
    // historical lines are real data the user must consciously resolve, not an absence of data.
    const result = resolveAutoSelectedSourceSubinventory(null, ONE_SOURCE, true)
    assert.equal(result, null)
  })
})

describe('G/H/I — Destination Subinventory (Transfer): option-count behavior when the field is empty', () => {
  test('G. 0 authorized destinations (real user-1224-in-DRUG case) -> stays empty', () => {
    assert.equal(resolveAutoSelectedDestinationSubinventory('', []), '')
  })

  test('G2. 0 authorized destinations with a null current value also stays empty (not accidentally coerced)', () => {
    assert.equal(resolveAutoSelectedDestinationSubinventory(null, []), null)
  })

  test('H. exactly 1 authorized destination (real user-1224-in-MEDICAL_CONSUMABLE case) + empty -> auto-selects', () => {
    assert.equal(resolveAutoSelectedDestinationSubinventory('', ONE_DESTINATION), 'MED_MAIN')
  })

  test('I. 2+ authorized destinations + empty -> stays empty, user chooses normally', () => {
    assert.equal(resolveAutoSelectedDestinationSubinventory('', TWO_DESTINATIONS), '')
  })
})

describe('J — Destination Subinventory: an existing historical value is NEVER overwritten', () => {
  test('a historical Transfer line destination is preserved even though exactly 1 (different) option is authorized now', () => {
    const result = resolveAutoSelectedDestinationSubinventory('ER_DRUG', ONE_DESTINATION)
    assert.equal(result, 'ER_DRUG')
    assert.notEqual(result, ONE_DESTINATION[0].code)
  })
})

describe('K — Destination Subinventory: re-resolution/context change while empty', () => {
  test('re-evaluating with a freshly loaded single-option list (e.g. after organizationCode changes) auto-selects', () => {
    // Simulates the effect re-running in LineEditDrawer.jsx once destinationSubinventories.data
    // finishes loading for a (possibly new) organizationCode while the field is still empty.
    const afterOrgSwitch = resolveAutoSelectedDestinationSubinventory('', ONE_DESTINATION)
    assert.equal(afterOrgSwitch, 'MED_MAIN')
  })

  test('re-evaluating an already-resolved value against the same single option is a stable no-op', () => {
    const first = resolveAutoSelectedDestinationSubinventory('', ONE_DESTINATION)
    const second = resolveAutoSelectedDestinationSubinventory(first, ONE_DESTINATION)
    assert.equal(second, first)
  })
})

describe('L — Issue behavior unchanged (source-structure check)', () => {
  test('the Destination Subinventory auto-select effect is guarded by isTransfer and never runs for Issue lines', () => {
    const path = fileURLToPath(new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.match(source, /if \(!isTransfer\) return/)
  })

  test('Destination Account (Issue) resolution logic and messaging are untouched by this phase', () => {
    const path = fileURLToPath(new URL('../src/utils/lineDestinationAccount.js', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.match(source, /DEFAULT_ACCOUNT_NOT_CONFIGURED_MESSAGE/)
    assert.doesNotMatch(source, /resolveAutoSelected/)
  })
})

describe('M — zero-destination hint/validation preserved (source-structure check)', () => {
  test('LineEditDrawer.jsx still renders the "No destination subinventories assigned" hint', () => {
    const path = fileURLToPath(new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.match(source, /No destination subinventories assigned for this organization\./)
  })

  test('LineEditDrawer.jsx still requires Destination Subinventory for Transfer lines in validate()', () => {
    const path = fileURLToPath(new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.match(source, /Destination Subinventory is required for Transfer lines\./)
  })
})

describe('N — Implementation architecture: no auto-select logic leaked into shared components', () => {
  test('ReferenceSelect.jsx has no knowledge of option count or auto-selection', () => {
    const path = fileURLToPath(new URL('../src/components/common/ReferenceSelect.jsx', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /resolveAutoSelected/)
    assert.doesNotMatch(source, /options\.length/)
  })

  test('LookupCombobox.jsx has no knowledge of single-result auto-selection', () => {
    const path = fileURLToPath(new URL('../src/components/common/LookupCombobox.jsx', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /resolveAutoSelected/)
  })

  test('the Source auto-select resolver is wired into MovementRequestHeaderForm.jsx, not a shared component', () => {
    const path = fileURLToPath(new URL('../src/components/movement-request/MovementRequestHeaderForm.jsx', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.match(source, /resolveAutoSelectedSourceSubinventory/)
  })

  test('the Destination auto-select resolver is wired into LineEditDrawer.jsx, not a shared component', () => {
    const path = fileURLToPath(new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.match(source, /resolveAutoSelectedDestinationSubinventory/)
  })
})

describe('O — Regression boundary: unrelated fields have no new auto-select behavior', () => {
  test('Reason, Secondary UOM, Cost Center, Item search remain plain user-driven selects (no resolveAutoSelected reference anywhere near them)', () => {
    const path = fileURLToPath(new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url))
    const source = readFileSync(path, 'utf8')
    // Reason and Secondary UOM sections must not gain any resolver call - only the one Destination
    // Subinventory effect (already asserted above) introduces resolveAutoSelected* in this file.
    const occurrences = (source.match(/resolveAutoSelected\w+/g) || []).length
    assert.equal(occurrences, 2, 'expected exactly 2 references: the import and its single call site')
  })

  test('AdminUsersPage.jsx (Role/Active/Is Nurse/Cost Center/Destination assignments) is untouched by this phase', () => {
    const path = fileURLToPath(new URL('../src/pages/AdminUsersPage.jsx', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /resolveAutoSelected/)
  })
})
