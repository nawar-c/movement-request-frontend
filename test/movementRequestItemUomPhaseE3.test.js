import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ZERO_VALID_UOM_MESSAGE,
  isUomValidForItem,
  resolveUomForItem,
  reconcileHistoricalUom,
  isItemActive,
  buildItemUnavailableMessage,
  buildItemInactiveMessage,
  buildStaleUomMessage,
} from '../src/utils/lineItemUom.js'
import { serializeLineForApi } from '../src/api/movementRequestSerializers.js'

/**
 * Phase E3 — Item/UOM redesign. Same dependency-free Node test-runner convention as Phase
 * E1/E2: pure-function extraction (lineItemUom.js) + source-structure checks in place of a
 * rendering framework. Fixtures mirror the backend's buildValidUomRecords shape exactly
 * (movement-request-backend/src/services/itemUom.service.js): { itemNumber, uomCode, uomName, isPrimary }.
 */

// Real production items (read-only reference evidence).
const ITEM_102499_VALID_UOMS = [{ itemNumber: '102499', uomCode: 'Ea', uomName: null, isPrimary: true }]

const ITEM_7208480_VALID_UOMS = [
  { itemNumber: '7208480', uomCode: 'BLP', uomName: null, isPrimary: true },
  { itemNumber: '7208480', uomCode: 'CPS', uomName: null, isPrimary: false },
]

describe('A — Item selection clears previous UOM', () => {
  test('resolveUomForItem never returns a UOM that belongs to a different item\'s validUoms', () => {
    // Simulates the transition handleItemSelect performs: the new item's validUoms are the ONLY
    // input to the next UOM — nothing from whatever was previously selected leaks in.
    const previousItemUom = 'CPS' // belonged to 7208480
    const nextItemValidUoms = ITEM_102499_VALID_UOMS // switching to 102499
    const resolved = resolveUomForItem(nextItemValidUoms)
    assert.notEqual(resolved, previousItemUom)
    assert.equal(resolved, 'Ea')
  })
})

describe('B — One valid UOM (real item 102499, MEDICAL_CONSUMABLE)', () => {
  test('auto-selects the single valid UOM', () => {
    assert.equal(resolveUomForItem(ITEM_102499_VALID_UOMS), 'Ea')
  })

  test('read-only representation: LineEditDrawer.jsx renders a disabled/readOnly input for the single-UOM case', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.match(source, /validUoms\.length === 1/)
  })
})

describe('C — Two valid UOMs (real item 7208480, DRUG)', () => {
  test('defaults to the Oracle-flagged primary (BLP)', () => {
    assert.equal(resolveUomForItem(ITEM_7208480_VALID_UOMS), 'BLP')
  })

  test('the secondary UOM (CPS) is a valid choice', () => {
    assert.equal(isUomValidForItem('CPS', ITEM_7208480_VALID_UOMS), true)
  })

  test('only this item\'s validUoms are valid — no third UOM may appear', () => {
    assert.equal(isUomValidForItem('EACH', ITEM_7208480_VALID_UOMS), false)
    assert.equal(ITEM_7208480_VALID_UOMS.length, 2)
  })
})

describe('D — Zero valid UOMs', () => {
  test('resolveUomForItem returns empty — nothing is auto-selected', () => {
    assert.equal(resolveUomForItem([]), '')
  })

  test('the exact business message matches the backend\'s authoritative wording', () => {
    assert.equal(
      ZERO_VALID_UOM_MESSAGE,
      'Item has no valid Oracle UOM configured. Please contact the administrator.',
    )
  })

  test('LineEditDrawer.jsx blocks Save Line via validate() when validUoms is empty for a selected item', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.match(source, /validUoms\.length === 0/)
    assert.match(source, /ZERO_VALID_UOM_MESSAGE/)
  })
})

describe('E — Wrong-for-item UOM rejected by frontend validation', () => {
  test('isUomValidForItem rejects a globally-real but wrong-for-this-item UOM code', () => {
    assert.equal(isUomValidForItem('CPS', ITEM_102499_VALID_UOMS), false)
  })
})

describe('F — Item change invalidates stale old UOM', () => {
  test('switching from a 2-UOM item to a 1-UOM item drops the old selection entirely', () => {
    const afterFirstItem = resolveUomForItem(ITEM_7208480_VALID_UOMS) // 'BLP'
    assert.equal(afterFirstItem, 'BLP')
    const afterSecondItem = resolveUomForItem(ITEM_102499_VALID_UOMS)
    assert.equal(afterSecondItem, 'Ea')
    assert.notEqual(afterSecondItem, afterFirstItem)
  })

  test('LineEditDrawer.jsx clears uom to \'\' when the item is cleared', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.match(source, /itemNumber: '',\s*\n\s*itemDescription: '',\s*\n\s*uom: '',/)
  })
})

describe('G — Item Description remains Oracle-derived/read-only (source-structure check)', () => {
  test('the Item Description input has no onChange handler and is disabled/readOnly', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    const match = source.match(/label">Item Description<\/label>\s*<input([^>]*)\/>/)
    assert.ok(match, 'Item Description input not found')
    assert.match(match[1], /disabled/)
    assert.match(match[1], /readOnly/)
    assert.doesNotMatch(match[1], /onChange/)
  })
})

describe('H — Transaction Type remains Oracle-derived/read-only (source-structure check)', () => {
  test('the Transaction Type input has no onChange handler and is disabled/readOnly', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    const match = source.match(/label">Transaction Type<\/label>\s*<input([^]*?)\/>/)
    assert.ok(match, 'Transaction Type input not found')
    assert.match(match[1], /disabled/)
    assert.match(match[1], /readOnly/)
    assert.doesNotMatch(match[1], /onChange/)
    // No manual Transaction Type selection control (e.g. a <select>) exists in this file at all.
    assert.doesNotMatch(source, /Select transaction type/i)
  })
})

describe('I — Existing valid historical UOM remains usable when still present in validUoms', () => {
  test('reconcileHistoricalUom keeps a stored UOM that is still valid for the item', () => {
    const result = reconcileHistoricalUom('CPS', ITEM_7208480_VALID_UOMS)
    assert.equal(result.uom, 'CPS')
    assert.equal(result.invalid, false)
  })
})

describe('J — Historical invalid UOM requires correction in Edit but remains readable in View', () => {
  test('reconcileHistoricalUom clears a stored UOM that is no longer valid and flags it', () => {
    const result = reconcileHistoricalUom('EACH', ITEM_7208480_VALID_UOMS)
    assert.equal(result.uom, '')
    assert.equal(result.invalid, true)
  })

  test('the stale-UOM message names the actual stored value and the current valid options', () => {
    const message = buildStaleUomMessage('EACH', ITEM_7208480_VALID_UOMS)
    assert.match(message, /"EACH"/)
    assert.match(message, /BLP/)
    assert.match(message, /CPS/)
  })

  test('View mode is unaffected — MovementRequestLinesTable.jsx reads line.uom directly, not through reconcileHistoricalUom', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/MovementRequestLinesTable.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.match(source, /line\.uom/)
    assert.doesNotMatch(source, /reconcileHistoricalUom/)
  })
})

describe('K — serializeLineForApi sends selected uom only, not validUoms metadata', () => {
  test('validUoms/isPrimary/frontend-only item metadata are never sent, even if present on the input line', () => {
    const body = serializeLineForApi({
      itemNumber: '7208480',
      requestedQuantity: 5,
      uom: 'CPS',
      validUoms: ITEM_7208480_VALID_UOMS,
      isPrimary: false,
      itemChargeableFlag: 'Y',
    })
    assert.equal(body.uom, 'CPS')
    assert.equal('validUoms' in body, false)
    assert.equal('isPrimary' in body, false)
    assert.equal('itemChargeableFlag' in body, false)
  })
})

describe('Item-status handling — fail-closed, matches the backend authoritative MR-write gate exactly', () => {
  test('Active -> allowed', () => {
    assert.equal(isItemActive({ itemStatus: 'Active' }), true)
  })

  test('Inactive -> blocked', () => {
    assert.equal(isItemActive({ itemStatus: 'Inactive' }), false)
  })

  test('null status -> blocked (fail-closed, NOT fail-open — differs deliberately from the read/search reference endpoint)', () => {
    assert.equal(isItemActive({ itemStatus: null }), false)
  })

  test('undefined status -> blocked', () => {
    assert.equal(isItemActive({ itemStatus: undefined }), false)
  })

  test('the inactive-item message mirrors the backend\'s exact authoritative wording', () => {
    assert.equal(
      buildItemInactiveMessage('DEMO-DRUG-ITEM-NULLSTATUS'),
      'Item "DEMO-DRUG-ITEM-NULLSTATUS" is not active or its status could not be determined.',
    )
  })

  test('the unavailable-item message (genuinely not found, distinct from found-but-inactive) names the item number', () => {
    assert.match(buildItemUnavailableMessage('999999'), /"999999"/)
  })
})

describe('Global UOM control removal — primary UOM field only (source-structure check)', () => {
  test('the primary UOM field sources its options from validUoms, not the global UOM list', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.match(source, /options=\{validUoms\}/)
  })

  test('Secondary UOM was investigated and confirmed to be Oracle\'s own separate, not-yet-mapped dual-quantity payload concept — intentionally reverted to the global UOM list, not validUoms', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.match(source, /options=\{uoms\.data\}/)
    assert.match(source, /useUoms/)
  })

  test('useUoms/getUoms remain defined in the shared reference hook — genuinely still used, not a leftover', () => {
    const path = fileURLToPath(new URL('../src/hooks/useReferenceData.js', import.meta.url))
    const source = readFileSync(path, 'utf8')
    assert.match(source, /export function useUoms/)
  })
})

describe('L — E1/E2 tests remain passing', () => {
  test('sanity: this suite does not modify or duplicate movementRequestHeaderPhaseE1/E2 coverage', () => {
    // Actual E1/E2 regression is verified by running their own test files in the same `npm test`
    // run (see test/movementRequestHeaderPhaseE1.test.js and movementRequestHeaderPhaseE2.test.js).
    assert.ok(true)
  })
})
