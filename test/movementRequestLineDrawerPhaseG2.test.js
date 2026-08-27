import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Phase G2 — Line drawer responsiveness. Same dependency-free Node test-runner convention as
 * E1-E4/G1: source-structure checks in place of a rendering framework, since LineEditDrawer.jsx
 * can't be imported or rendered under plain Node (it imports hooks that transitively depend on
 * config.js's import.meta.env).
 *
 * G2's fix is presentation-only (a scoped CSS modifier + 3 className additions) - these tests exist
 * primarily to prove NOTHING else changed: the E1-E4 business-logic boundary (Source/Requester
 * removal, UOM branching, Destination Account/Subinventory rules) and the shared .form-grid base
 * rule/breakpoints (used by MovementRequestHeaderForm.jsx, which G2 must not affect) are all
 * asserted unchanged.
 */

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function drawerSource() {
  return readSource('../src/components/movement-request/LineEditDrawer.jsx')
}

function cssSource() {
  return readSource('../src/styles/index.css')
}

function serializersSource() {
  return readSource('../src/api/movementRequestSerializers.js')
}

// ---------------------------------------------------------------------------------------------
// A — form-grid--drawer applied to all 3 drawer grids
// ---------------------------------------------------------------------------------------------
describe('A — all 3 drawer form-grid wrappers use the new modifier', () => {
  test('exactly 3 occurrences of "form-grid form-grid--drawer" (Item & Quantity, Source & Destination, Additional Details)', () => {
    const source = drawerSource()
    const matches = source.match(/className="form-grid form-grid--drawer"/g) || []
    assert.equal(matches.length, 3)
  })

  test('no plain, unmodified "form-grid" wrapper remains in the drawer', () => {
    const source = drawerSource()
    assert.doesNotMatch(source, /className="form-grid"(?!\s*form-grid--drawer)/)
    // stronger check: every className="form-grid ..." occurrence includes the drawer modifier
    const allFormGridAttrs = source.match(/className="form-grid[^"]*"/g) || []
    assert.ok(allFormGridAttrs.length > 0)
    for (const attr of allFormGridAttrs) {
      assert.match(attr, /form-grid--drawer/, `expected every form-grid usage in the drawer to include form-grid--drawer, got: ${attr}`)
    }
  })
})

// ---------------------------------------------------------------------------------------------
// B — .form-grid--drawer sets a fixed 2-column layout
// ---------------------------------------------------------------------------------------------
describe('B — .form-grid--drawer CSS rule', () => {
  test('sets grid-template-columns: repeat(2, 1fr), unconditionally (no media query wrapping it)', () => {
    const css = cssSource()
    const ruleMatch = css.match(/\.form-grid--drawer\s*\{\s*grid-template-columns:\s*repeat\(2,\s*1fr\);\s*\}/)
    assert.ok(ruleMatch, '.form-grid--drawer rule not found or does not match the expected fixed 2-column shape')
  })

  test('the rule is defined exactly once', () => {
    const css = cssSource()
    const occurrences = css.match(/\.form-grid--drawer\s*\{/g) || []
    assert.equal(occurrences.length, 1)
  })
})

// ---------------------------------------------------------------------------------------------
// C — shared .form-grid base rule and breakpoints are unchanged (regression guard)
// ---------------------------------------------------------------------------------------------
describe('C — .form-grid base rule and existing breakpoints are untouched', () => {
  test('base .form-grid is still 3 columns, unmodified', () => {
    const css = cssSource()
    assert.match(css, /\.form-grid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(3,\s*1fr\);\s*gap:\s*16px 20px;\s*\}/)
  })

  test('the existing 900px breakpoint (2 columns) is still present, unchanged', () => {
    const css = cssSource()
    assert.match(css, /@media \(max-width: 900px\) \{\s*\.form-grid \{\s*grid-template-columns: repeat\(2, 1fr\);\s*\}\s*\}/)
  })

  test('the existing 620px breakpoint (1 column) is still present, unchanged', () => {
    const css = cssSource()
    assert.match(css, /@media \(max-width: 620px\) \{\s*\.form-grid \{\s*grid-template-columns: 1fr;\s*\}\s*\}/)
  })
})

// ---------------------------------------------------------------------------------------------
// D — Item field keeps span-2 (now spans the full row in a 2-column grid)
// ---------------------------------------------------------------------------------------------
describe('D — Item field remains form-field--span-2', () => {
  test('the Item field wrapper is unchanged - still span-2, not widened/narrowed to a different span class', () => {
    const source = drawerSource()
    assert.match(source, /<div className="form-field form-field--span-2">/)
  })
})

// ---------------------------------------------------------------------------------------------
// D2 — Issue Destination Account also spans both columns (width-correction follow-up)
// ---------------------------------------------------------------------------------------------
describe('D2 — Issue Destination Account uses form-field--span-2 (residual overflow correction)', () => {
  test('the Issue-branch Destination Account field wrapper is form-field--span-2, giving the long combination code the full row width', () => {
    const source = drawerSource()
    assert.match(source, /\) : isIssue \? \(\s*<div className="form-field form-field--span-2">\s*<label className="form-label">\s*Destination Account/)
  })

  test('exactly 2 span-2 fields exist in total (Item, Issue Destination Account) - Transfer Destination Subinventory and every other field remain single-column', () => {
    const source = drawerSource()
    const spanCount = (source.match(/form-field--span-2/g) || []).length
    assert.equal(spanCount, 2)
  })

  test('the field is still disabled+readOnly with no onChange - only the wrapper span class changed, not the field itself', () => {
    const source = drawerSource()
    const block = source.slice(source.indexOf('Destination Account<span'), source.indexOf('errors.destinationAccount ? <div'))
    assert.match(block, /disabled/)
    assert.match(block, /readOnly/)
    assert.doesNotMatch(block, /onChange/)
  })

  test('Transfer Destination Subinventory is unaffected - still a plain single-column form-field, no span class added', () => {
    const source = drawerSource()
    const transferBlock = source.slice(source.indexOf('isTransfer ? ('), source.indexOf('isIssue ? ('))
    assert.match(transferBlock, /<div className="form-field">/)
    assert.doesNotMatch(transferBlock, /form-field--span-2/)
  })
})

// ---------------------------------------------------------------------------------------------
// E — no Source / Requester fields reintroduced (E2 boundary)
// ---------------------------------------------------------------------------------------------
describe('E — Phase E2 removals remain in effect', () => {
  // Scoped to the rendered JSX (the `return (` block) only - the file's own top-of-file doc comment
  // legitimately explains, in prose, that Source Subinventory/Requester were removed, which would
  // otherwise make a whole-file string check a false positive.
  function renderedJsx(source) {
    return source.slice(source.indexOf('return (\n    <div className="drawer-overlay"'))
  }

  test('no line-level Source Subinventory field is rendered', () => {
    const jsx = renderedJsx(drawerSource())
    assert.doesNotMatch(jsx, /Source Subinventory/)
    assert.doesNotMatch(jsx, /set\('sourceSubinventory'/)
  })

  test('no Requester field is rendered', () => {
    const jsx = renderedJsx(drawerSource())
    assert.doesNotMatch(jsx, />Requester</)
    assert.doesNotMatch(jsx, /set\('requester'/)
  })
})

// ---------------------------------------------------------------------------------------------
// F — Phase E3 UOM branching intact
// ---------------------------------------------------------------------------------------------
/**
 * Superseded by the confirmed customer Primary-UOM-only Movement Request business rule: the old
 * one/multi/zero three-way branch (which offered a Primary+Secondary dropdown when an item had
 * both) no longer exists - validUoms for the primary UOM field can never exceed length 1 now
 * (see getAllowedMovementRequestUoms in utils/lineItemUom.js), so there is nothing left to branch
 * on beyond "resolving" vs "resolved" (read-only either way). Full coverage of the new rule lives in
 * test/movementRequestItemUomPhaseE3.test.js; this block only re-confirms the G2 presentation fix
 * didn't reintroduce the old dropdown.
 */
describe('F — primary UOM field remains read-only-only (no Primary+Secondary dropdown reintroduced)', () => {
  test('the primary UOM field renders a disabled/readOnly input unconditionally once resolved - no ReferenceSelect/dropdown branch exists for it', () => {
    const source = drawerSource()
    const uomFieldBlock = source.slice(source.indexOf('UOM<span'), source.indexOf('Required Date'))
    // UOM display-name phase: the input shows the resolved display label (Oracle name, falling back
    // to the code), not form.uom directly - form.uom remains the internal/submission value.
    assert.match(uomFieldBlock, /value=\{resolveUomDisplayLabel\(form\.uom, validUoms\)\}\s+disabled\s+readOnly/)
    assert.doesNotMatch(uomFieldBlock, /options=\{validUoms\}/)
    assert.match(uomFieldBlock, /ZERO_VALID_UOM_MESSAGE/)
  })
})

describe('G — Secondary UOM still uses the global UOM source (Phase E3 final-review decision, deliberately not validUoms)', () => {
  test('Secondary UOM ReferenceSelect is bound to uoms.data (the global list), not validUoms', () => {
    const source = drawerSource()
    // Anchored on the literal JSX label, not the bare substring "Secondary UOM" - that substring
    // also appears earlier in a doc comment, which would make indexOf grab the wrong start point
    // and accidentally sweep in the primary UOM field's own options={validUoms} block.
    const secondaryBlock = source.slice(
      source.indexOf('<label className="form-label">Secondary UOM</label>'),
      source.indexOf('Lot Number'),
    )
    assert.match(secondaryBlock, /options=\{uoms\.data\}/)
    assert.doesNotMatch(secondaryBlock, /options=\{validUoms\}/)
  })
})

// ---------------------------------------------------------------------------------------------
// H — Phase E4 Destination Account / Destination Subinventory rules intact
// ---------------------------------------------------------------------------------------------
describe('H — Issue Destination Account remains read-only, no manual override', () => {
  test('the Destination Account input is still disabled+readOnly with no onChange handler', () => {
    const source = drawerSource()
    const block = source.slice(source.indexOf('Destination Account<span'), source.indexOf('errors.destinationAccount ? <div'))
    assert.match(block, /disabled/)
    assert.match(block, /readOnly/)
    assert.doesNotMatch(block, /onChange/)
  })

  test('isUntouchedHistoricalAccount / selectionVersion mechanism is unchanged', () => {
    const source = drawerSource()
    assert.match(source, /const isUntouchedHistoricalAccount = selectionVersion === 0 && Boolean\(form\.destinationAccountId \|\| form\.destinationAccount\)/)
  })
})

describe('I — Transfer Destination Subinventory behavior is unchanged', () => {
  test('Transfer still renders an editable ReferenceSelect bound to destinationSubinventories.data', () => {
    const source = drawerSource()
    const transferBlock = source.slice(source.indexOf('isTransfer ? ('), source.indexOf('isIssue ? ('))
    assert.match(transferBlock, /options=\{destinationSubinventories\.data\}/)
    assert.match(transferBlock, /onChange=\{\(v\) => set\('destinationSubinventory', v\)\}/)
  })
})

// ---------------------------------------------------------------------------------------------
// J — no serializer/API/payload changes
// ---------------------------------------------------------------------------------------------
describe('J — no serializer/API/payload changes', () => {
  test('movementRequestSerializers.js is untouched by this phase - serializeLineForApi still sends exactly the same field set', () => {
    const source = serializersSource()
    assert.match(source, /export function serializeLineForApi\(line\) \{/)
    // Scoped to serializeLineForApi's own function body only (up to its own closing brace) -
    // serializeHeaderForApi legitimately DOES send sourceSubinventory (Phase E2: sent once at the
    // header, not per line), and the doc comment directly above serializeHeaderForApi explains that
    // in prose - both would make a wider slice a false positive.
    const fnStart = source.indexOf('export function serializeLineForApi(line) {')
    const fnEnd = source.indexOf('\n}\n', fnStart)
    const lineFnBody = source.slice(fnStart, fnEnd)
    assert.doesNotMatch(lineFnBody, /sourceSubinventory/, 'line-level sourceSubinventory must still never be sent (Phase E2)')
    assert.doesNotMatch(lineFnBody, /requester:/, 'requester must still never be sent (Phase C)')
  })

  test('LineEditDrawer.jsx does not import or reference anything from movementRequestSerializers.js - it only ever hands its form state to onSave, serialization happens elsewhere, unchanged', () => {
    const source = drawerSource()
    assert.doesNotMatch(source, /movementRequestSerializers/)
  })
})
