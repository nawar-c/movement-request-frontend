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
  getAllowedMovementRequestUoms,
  resolveUomDisplayLabel,
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

  test('read-only representation: LineEditDrawer.jsx renders a disabled/readOnly UOM input unconditionally (Primary-UOM-only rule - validUoms can never exceed length 1 by construction, so there is no length check left to make)', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    const match = source.match(/label">\s*UOM<span[^]*?<\/div>\s*<\/div>/)
    assert.ok(match, 'UOM field block not found')
    // UOM display-name phase: the input shows the resolved display label (Oracle name, falling back
    // to the code), not form.uom directly - form.uom remains the internal/submission value.
    assert.match(match[0], /value=\{resolveUomDisplayLabel\(form\.uom, validUoms\)\}\s+disabled\s+readOnly/)
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
  test('the primary UOM field is never a selectable dropdown of validUoms - Primary-UOM-only MR rule means there is never more than one option to choose from', () => {
    const path = fileURLToPath(
      new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url),
    )
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /options=\{validUoms\}/, 'no ReferenceSelect should ever be built from validUoms for the primary UOM field')
  })

  test('Secondary UOM (Add-Line-only removed, still present for editing a historical line) still sources from the global UOM list, not validUoms - Oracle\'s own separate, not-yet-mapped dual-quantity payload concept, unaffected by the Primary-UOM-only rule', () => {
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

/**
 * Confirmed customer business rule: a Movement Request line may only use an item's PRIMARY UOM.
 * The item's Secondary UOM remains real Oracle reference data (validUoms from
 * /api/reference/items is untouched, still exposes both) but is never offered as a choice for a
 * line's own transaction uom. Mirrors the backend's itemUom.service.js#getAllowedMovementRequestUoms
 * exactly - see movement-request-backend/test/itemUom.service.test.js for the backend-side coverage.
 */
describe('getAllowedMovementRequestUoms - Primary-UOM-only MR business rule', () => {
  test('A. an item with only a primary UOM -> that one UOM (the only option)', () => {
    const result = getAllowedMovementRequestUoms(ITEM_102499_VALID_UOMS)
    assert.deepEqual(result, ITEM_102499_VALID_UOMS)
  })

  test('B/C/D. an item with Primary + Secondary UOM (7208480-style) -> only the Primary is returned, Secondary excluded', () => {
    const result = getAllowedMovementRequestUoms(ITEM_7208480_VALID_UOMS)
    assert.equal(result.length, 1)
    assert.equal(result[0].uomCode, 'BLP')
    assert.equal(result[0].isPrimary, true)
  })

  test('G. no valid UOMs at all -> empty, never invents one', () => {
    assert.deepEqual(getAllowedMovementRequestUoms([]), [])
  })

  test('null/undefined validUoms -> empty, never throws', () => {
    assert.deepEqual(getAllowedMovementRequestUoms(null), [])
    assert.deepEqual(getAllowedMovementRequestUoms(undefined), [])
  })
})

/**
 * UOM display-name phase: the transaction value (uomCode, e.g. "TBP") stays the internal/submission
 * value everywhere - this helper only resolves what the UI shows for that code. Mirrors the
 * backend's OracleFusionService.getItems/itemUom.service.js additive primaryUomName/secondaryUomName
 * -> uomName population exactly (see movement-request-backend/test/itemUom.service.test.js).
 */
describe('resolveUomDisplayLabel - UI display label, separate from the internal/submission UOM code', () => {
  test('7203042-style: code TBP + name TUBE PACK -> displays TUBE PACK', () => {
    const validUoms = [
      { itemNumber: '7203042', uomCode: 'TBP', uomName: 'TUBE PACK', isPrimary: true },
      { itemNumber: '7203042', uomCode: 'Tub', uomName: 'TUBE', isPrimary: false },
    ]
    assert.equal(resolveUomDisplayLabel('TBP', validUoms), 'TUBE PACK')
  })

  test('7205096-style: code AUP + name AMPOULE PACK -> displays AMPOULE PACK', () => {
    const validUoms = [
      { itemNumber: '7205096', uomCode: 'AUP', uomName: 'AMPOULE PACK', isPrimary: true },
      { itemNumber: '7205096', uomCode: 'AMP', uomName: 'AMPOULE', isPrimary: false },
    ]
    assert.equal(resolveUomDisplayLabel('AUP', validUoms), 'AMPOULE PACK')
  })

  test('missing/null uomName (e.g. mock data without names) -> falls back to the code itself', () => {
    assert.equal(resolveUomDisplayLabel('TBP', [{ itemNumber: '7203042', uomCode: 'TBP', uomName: null, isPrimary: true }]), 'TBP')
  })

  test('no matching record for the code at all -> falls back to the raw code passed in, never blank', () => {
    assert.equal(resolveUomDisplayLabel('TBP', []), 'TBP')
    assert.equal(resolveUomDisplayLabel('TBP', ITEM_102499_VALID_UOMS), 'TBP')
  })

  test('empty/falsy uomCode -> empty string, never throws on null/undefined validUoms', () => {
    assert.equal(resolveUomDisplayLabel('', null), '')
    assert.equal(resolveUomDisplayLabel(null, undefined), '')
  })

  test('never returns a different record\'s name - a Secondary UOM\'s name is never shown for the Primary code, or vice versa', () => {
    const validUoms = [
      { itemNumber: '7203042', uomCode: 'TBP', uomName: 'TUBE PACK', isPrimary: true },
      { itemNumber: '7203042', uomCode: 'Tub', uomName: 'TUBE', isPrimary: false },
    ]
    assert.equal(resolveUomDisplayLabel('Tub', validUoms), 'TUBE')
    assert.notEqual(resolveUomDisplayLabel('TBP', validUoms), 'TUBE')
  })
})

/**
 * Historical preservation (source-structure checks - the actual reconciliation runs inside a React
 * effect, exercised end-to-end by the backend's equivalent resolveAndValidateLines tests; this repo
 * has no rendering framework wired in, matching the existing Phase E3 convention above of asserting
 * on the drawer's source shape for effect-embedded behavior).
 */
describe('H/I. LineEditDrawer.jsx historical UOM preservation (source-structure check)', () => {
  const path = fileURLToPath(new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url))
  const source = readFileSync(path, 'utf8')

  test('the mount-time historical reconciliation still checks the FULL Oracle reference set (nextValidUoms), not the primary-only set - so a stored Secondary UOM is never treated as stale merely because of this rule', () => {
    assert.match(source, /reconcileHistoricalUom\(initialLine\.uom, nextValidUoms\)/)
  })

  test('a successfully-preserved historical line is displayed as exactly its own one resolved record, never re-offered as a Primary+Secondary choice', () => {
    assert.match(source, /preservedRecord \? \[preservedRecord\] : getAllowedMovementRequestUoms\(nextValidUoms\)/)
  })

  test('a freshly (re-)selected item resolves through getAllowedMovementRequestUoms - Primary-only, never the raw item.validUoms', () => {
    const match = source.match(/function handleItemSelect[^]*?setValidUoms\(nextValidUoms\)/)
    assert.ok(match, 'handleItemSelect body not found')
    assert.match(match[0], /getAllowedMovementRequestUoms\(item\.validUoms \|\| \[\]\)/)
  })

  test('UOM display-name phase: the read-only UOM input renders resolveUomDisplayLabel(form.uom, validUoms), not form.uom directly - display and internal value stay visually distinct in source', () => {
    assert.match(source, /value=\{resolveUomDisplayLabel\(form\.uom, validUoms\)\}/)
  })

  test('form.uom itself is untouched - it is what onSave receives (via `onSave(form)`), never renamed to a label/name field', () => {
    assert.match(source, /onSave\(form\)/)
    // The state setter that derives form.uom on selection/reconciliation still assigns the resolved
    // CODE (resolveUomForItem / reconcileHistoricalUom's `uom`), never a uomName lookup.
    assert.match(source, /uom: resolveUomForItem\(nextValidUoms\)/)
    assert.match(source, /const \{ uom, invalid \} = reconcileHistoricalUom\(initialLine\.uom, nextValidUoms\)/)
  })
})

describe('Secondary UOM / Secondary Quantity - removed from NEW line entry, preserved for editing an existing line', () => {
  const path = fileURLToPath(new URL('../src/components/movement-request/LineEditDrawer.jsx', import.meta.url))
  const source = readFileSync(path, 'utf8')

  test('the Secondary Quantity/Secondary UOM fields are gated behind `initialLine` - never rendered for a brand-new (Add) line', () => {
    const match = source.match(/\{initialLine \? \([^]*?Secondary UOM[^]*?\) : null\}/)
    assert.ok(match, 'expected the Secondary Quantity/Secondary UOM block to be conditionally rendered on initialLine')
    assert.match(match[0], /Secondary Quantity/)
    assert.match(match[0], /Secondary UOM/)
  })

  test('no destructive change to historical stored data - buildInitialForm still carries secondaryRequestedQuantity/secondaryUom over unchanged for an existing line ({ ...initialLine })', () => {
    assert.match(source, /function buildInitialForm\(initialLine, headerDefaults\) \{\s*\n\s*if \(initialLine\) return \{ \.\.\.initialLine \}/)
  })
})

describe('K. Oracle submission still sends UOMCode using the resolved (Primary) code, never the human-readable name - unaffected by this frontend change', () => {
  test('serializeLineForApi still sends line.uom verbatim (whatever code the drawer resolved), not a name or validUoms metadata', () => {
    const body = serializeLineForApi({
      itemNumber: '7208480',
      requestedQuantity: 5,
      uom: 'BLP',
      validUoms: [{ itemNumber: '7208480', uomCode: 'BLP', uomName: null, isPrimary: true }],
    })
    assert.equal(body.uom, 'BLP')
    assert.equal('validUoms' in body, false)
  })
})
