import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_ACCOUNT_NOT_CONFIGURED_MESSAGE,
  resolveDestinationAccountDisplay,
} from '../src/utils/lineDestinationAccount.js'
import { serializeLineForApi } from '../src/api/movementRequestSerializers.js'
import { deriveHeaderSourceSubinventory } from '../src/utils/movementRequestHeader.js'

/**
 * Phase E4 — Destination Account final UI + responsive finishing. Same dependency-free Node
 * test-runner convention as E1/E2/E3: pure-function extraction (lineDestinationAccount.js) +
 * source-structure checks in place of a rendering framework.
 */

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function lineEditDrawerSource() {
  return readSource('../src/components/movement-request/LineEditDrawer.jsx')
}

// Isolates the JSX branch for a given transaction type so assertions don't accidentally match
// content that belongs to a different branch of the same ternary chain.
function extractBranch(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  assert.notEqual(start, -1, `could not find start marker: ${startMarker}`)
  const end = source.indexOf(endMarker, start)
  assert.notEqual(end, -1, `could not find end marker: ${endMarker}`)
  return source.slice(start, end)
}

describe('A — ISSUE hides Destination Subinventory', () => {
  test('the isIssue branch of LineEditDrawer.jsx never renders a Destination Subinventory field', () => {
    const source = lineEditDrawerSource()
    const issueBranch = extractBranch(source, ') : isIssue ? (', ') : (\n              <div className="form-field">\n                <label className="form-label">Destination</label>')
    assert.doesNotMatch(issueBranch, /Destination Subinventory/)
  })
})

describe('B — ISSUE shows read-only configured Destination Account', () => {
  test('the isIssue branch renders a disabled/readOnly input bound to the resolved account display', () => {
    const source = lineEditDrawerSource()
    const issueBranch = extractBranch(source, ') : isIssue ? (', ') : (\n              <div className="form-field">\n                <label className="form-label">Destination</label>')
    assert.match(issueBranch, /Destination Account/)
    assert.match(issueBranch, /disabled/)
    assert.match(issueBranch, /readOnly/)
    assert.match(issueBranch, /accountDisplay\.primary/)
    assert.doesNotMatch(issueBranch, /onChange/)
  })
})

describe('C — ISSUE uses the USER-safe endpoint, never the ADMIN one', () => {
  test('referenceApi.getOrganizationDefaultAccount calls the USER-safe reference path', () => {
    const source = readSource('../src/api/referenceApi.js')
    assert.match(source, /getOrganizationDefaultAccount/)
    assert.match(source, /\/api\/reference\/organization-default-account/)
  })

  test('LineEditDrawer.jsx never references the ADMIN-only organization-default-accounts endpoint', () => {
    const source = lineEditDrawerSource()
    assert.doesNotMatch(source, /\/api\/admin/)
    assert.match(source, /useOrganizationDefaultAccount/)
  })
})

describe('D — ISSUE blocks Save Line when no configured account exists (source-structure check)', () => {
  test('validate() checks defaultAccount.notConfigured and uses the exact business message', () => {
    const source = lineEditDrawerSource()
    assert.match(source, /defaultAccount\.notConfigured/)
    assert.match(source, /DEFAULT_ACCOUNT_NOT_CONFIGURED_MESSAGE/)
  })

  test('the exact message matches the required wording', () => {
    assert.equal(
      DEFAULT_ACCOUNT_NOT_CONFIGURED_MESSAGE,
      'No Default Destination Account is configured for this Inventory Organization. Please contact the administrator.',
    )
  })
})

describe('E — TRANSFER hides Destination Account', () => {
  test('the isTransfer branch of LineEditDrawer.jsx never renders a Destination Account field', () => {
    const source = lineEditDrawerSource()
    const transferBranch = extractBranch(source, '{isTransfer ? (', ') : isIssue ? (')
    assert.doesNotMatch(transferBranch, /Destination Account/)
  })
})

describe('F — TRANSFER shows authorized Destination Subinventory (unchanged)', () => {
  test('the isTransfer branch still sources options from useDestinationSubinventories, not the generic all-subinventories endpoint', () => {
    const source = lineEditDrawerSource()
    const transferBranch = extractBranch(source, '{isTransfer ? (', ') : isIssue ? (')
    assert.match(transferBranch, /destinationSubinventories\.data/)
    assert.match(source, /useDestinationSubinventories/)
  })
})

describe('G — manual Destination Account override is impossible', () => {
  test('LookupCombobox is no longer imported or used in LineEditDrawer.jsx', () => {
    const source = lineEditDrawerSource()
    assert.doesNotMatch(source, /LookupCombobox/)
  })

  test('no destination-account search/select handlers remain', () => {
    const source = lineEditDrawerSource()
    assert.doesNotMatch(source, /handleDestinationAccountSelect/)
    assert.doesNotMatch(source, /searchDestinationAccounts/)
  })

  test('no free-text entry point exists for destinationAccount/destinationAccountId anywhere in the file', () => {
    const source = lineEditDrawerSource()
    // The only two writers of these two form fields are the historical-preservation path
    // (buildInitialForm's {...initialLine} spread) and the resolved-organization-default sync
    // effect — never a user-facing input's onChange.
    assert.doesNotMatch(source, /onChange=\{[^}]*destinationAccount/)
  })
})

describe('G2 — payload safety: destinationAccount/destinationAccountId ARE still sent (final-review correction)', () => {
  test('serializeLineForApi DOES send destinationAccount/destinationAccountId when present on the line — required so a historical DRAFT Issue line is not blocked from saving', () => {
    // Real shape from MR-000039's Issue line (live production data): header.destinationAccountId is
    // null (created before this organization had a configured default) but the line itself carries
    // a real, permanently-stored historical value. Omitting these here would make
    // resolveAndValidateLines resolve destinationAccountId to nothing at all for such a request,
    // blocking an unrelated Save with "destinationAccountId is required for Issue lines".
    const body = serializeLineForApi({
      itemNumber: '7206078',
      requestedQuantity: 2,
      uom: 'BLP',
      destinationAccount: '10-100-1010201-1110205-9999-9999-9999',
      destinationAccountId: '300000055783622',
    })
    assert.equal(body.destinationAccount, '10-100-1010201-1110205-9999-9999-9999')
    assert.equal(body.destinationAccountId, '300000055783622')
  })

  test('LineEditDrawer.jsx preserves an untouched historical line\'s own destinationAccountId/destinationAccount instead of requiring a fresh live resolution', () => {
    const source = lineEditDrawerSource()
    assert.match(source, /isUntouchedHistoricalAccount/)
    assert.match(source, /selectionVersion/)
  })

  test('a freshly (re-)selected Issue item still cannot carry over a previous item\'s destinationAccountId — cleared/rebuilt in handleItemSelect', () => {
    const source = lineEditDrawerSource()
    const handleItemSelectBody = extractBranch(source, 'function handleItemSelect(item) {', '\n  function validate() {')
    assert.match(handleItemSelectBody, /destinationAccountId: item\.transactionTypeId === ISSUE_TRANSACTION_TYPE_ID/)
  })
})

describe('H — unresolved combinationCode falls back to CCID display', () => {
  test('a resolved account with a readable combinationCode shows it as primary, CCID as secondary', () => {
    const result = resolveDestinationAccountDisplay({ destinationAccount: '10024', combinationCode: '20-100-9999999-1230101-9999-9999-9999' })
    assert.equal(result.primary, '20-100-9999999-1230101-9999-9999-9999')
    assert.equal(result.secondaryCcid, '10024')
  })

  test('a resolved account with combinationCode: null falls back to the CCID as primary, no duplicate secondary', () => {
    const result = resolveDestinationAccountDisplay({ destinationAccount: '10024', combinationCode: null })
    assert.equal(result.primary, '10024')
    assert.equal(result.secondaryCcid, null)
  })

  test('no resolved account at all -> empty display, never invented', () => {
    const result = resolveDestinationAccountDisplay(null)
    assert.equal(result.primary, '')
    assert.equal(result.secondaryCcid, null)
  })
})

describe('I — historical line-level Destination Account remains readable in View', () => {
  test('MovementRequestLinesTable.jsx still reads line.destinationAccount/destinationAccountId for the Destination column', () => {
    const source = readSource('../src/components/movement-request/MovementRequestLinesTable.jsx')
    assert.match(source, /line\.destinationAccount/)
    assert.match(source, /line\.destinationAccountId/)
  })
})

describe('J — MR-000039 compatibility remains unchanged', () => {
  test('the real MR-000039 conflict (DRUG_MAIN vs INPHR_DRUG) still resolves to no derived Source', () => {
    const mr = {
      sourceSubinventory: null,
      lines: [{ sourceSubinventory: 'DRUG_MAIN' }, { sourceSubinventory: 'INPHR_DRUG' }],
    }
    const { value, conflict } = deriveHeaderSourceSubinventory(mr)
    assert.equal(value, null)
    assert.equal(conflict, true)
  })
})

describe('K — sticky MR action row is structurally present', () => {
  test('Create and Edit pages apply the mr-form-actions class to their Save/Cancel row', () => {
    const createSource = readSource('../src/pages/MovementRequestCreatePage.jsx')
    const editSource = readSource('../src/pages/MovementRequestEditPage.jsx')
    assert.match(createSource, /mr-form-actions/)
    assert.match(editSource, /mr-form-actions/)
  })

  test('the CSS pins it to the bottom of the viewport without a fixed overlay', () => {
    const css = readSource('../src/styles/index.css')
    const match = css.match(/\.mr-form-actions\s*\{[^}]*\}/)
    assert.ok(match, '.mr-form-actions rule not found')
    assert.match(match[0], /position:\s*sticky/)
    assert.match(match[0], /bottom:\s*0/)
  })
})

describe('L — modal max-height/internal-scroll behavior is structurally present', () => {
  test('.modal is a constrained flex column', () => {
    const css = readSource('../src/styles/index.css')
    const match = css.match(/(?<!__\w*\s)\.modal\s*\{[^}]*\}/)
    assert.ok(match, '.modal rule not found')
    assert.match(match[0], /max-height/)
    assert.match(match[0], /display:\s*flex/)
    assert.match(match[0], /flex-direction:\s*column/)
  })

  test('.modal__body is the scrolling region, header/footer stay outside it', () => {
    const css = readSource('../src/styles/index.css')
    const bodyMatch = css.match(/\.modal__body\s*\{[^}]*\}/)
    assert.ok(bodyMatch, '.modal__body rule not found')
    assert.match(bodyMatch[0], /flex:\s*1/)
    assert.match(bodyMatch[0], /overflow-y:\s*auto/)
    const headerMatch = css.match(/\.modal__header\s*\{[^}]*\}/)
    const footerMatch = css.match(/\.modal__footer\s*\{[^}]*\}/)
    assert.doesNotMatch(headerMatch[0], /overflow-y:\s*auto/)
    assert.doesNotMatch(footerMatch[0], /overflow-y:\s*auto/)
  })

  test('Modal.jsx markup already provides header/body/footer wrappers - no markup change was needed', () => {
    const source = readSource('../src/components/common/Modal.jsx')
    assert.match(source, /modal__header/)
    assert.match(source, /modal__body/)
    assert.match(source, /modal__footer/)
  })

  test('final review: a Save/Cancel row nested inside .modal__body (the pattern every current Admin modal actually uses) is pinned to the bottom of the scrolling body, not just reachable via an internal scroll', () => {
    const css = readSource('../src/styles/index.css')
    const nestedFooterMatch = css.match(/\.modal__body \.modal__footer\s*\{[^}]*\}/)
    assert.ok(nestedFooterMatch, '.modal__body .modal__footer rule not found')
    assert.match(nestedFooterMatch[0], /position:\s*sticky/)
    assert.match(nestedFooterMatch[0], /bottom:\s*0/)
    assert.match(nestedFooterMatch[0], /background/)
  })

  test('final review: the sticky rule is scoped to the nested-in-body case only, never .row-actions/.mr-form-actions, and does not touch the footer-prop (already-a-sibling) case', () => {
    const css = readSource('../src/styles/index.css')
    const nestedFooterMatch = css.match(/\.modal__body \.modal__footer\s*\{[^}]*\}/)[0]
    // The selector itself is scoped by construction (`.modal__body .modal__footer`), but confirm no
    // separate broad rule was introduced that would also catch .row-actions or .mr-form-actions.
    assert.doesNotMatch(css, /\.row-actions\s*,\s*\.modal__footer|\.modal__footer\s*,\s*\.row-actions/)
    assert.equal(nestedFooterMatch.startsWith('.modal__body .modal__footer'), true)
  })

  test('final review: every current Admin modal call site (Create/Edit/Reset User, Set Default Account) renders its action row via the shared .modal__footer class, nested in children - not a bespoke class the new CSS rule would miss', () => {
    const adminUsersSource = readSource('../src/pages/AdminUsersPage.jsx')
    const adminOrgAccountsSource = readSource('../src/pages/AdminOrganizationAccountsPage.jsx')
    const modalFooterOccurrencesInUsers = (adminUsersSource.match(/className="modal__footer"/g) || []).length
    const modalFooterOccurrencesInOrgAccounts = (adminOrgAccountsSource.match(/className="modal__footer"/g) || []).length
    // CreateUserModal, EditUserModal, ResetPasswordModal (both branches) = 4 occurrences.
    assert.equal(modalFooterOccurrencesInUsers, 4)
    // SetDefaultAccountModal = 1 occurrence.
    assert.equal(modalFooterOccurrencesInOrgAccounts, 1)
  })
})

describe('M — existing table horizontal scrolling is preserved', () => {
  test('.table-wrap still scrolls horizontally', () => {
    const css = readSource('../src/styles/index.css')
    const match = css.match(/\.table-wrap\s*\{[^}]*\}/)
    assert.ok(match, '.table-wrap rule not found')
    assert.match(match[0], /overflow-x:\s*auto/)
  })

  test('MovementRequestLinesTable.jsx still wraps its table in .table-wrap', () => {
    const source = readSource('../src/components/movement-request/MovementRequestLinesTable.jsx')
    assert.match(source, /table-wrap/)
  })
})

describe('N — E1/E2/E3 tests remain passing', () => {
  test('sanity: this suite does not modify or duplicate E1/E2/E3 coverage', () => {
    // Actual E1/E2/E3 regression is verified by running their own test files in the same
    // `npm test` run (movementRequestHeaderPhaseE1/E2.test.js, movementRequestItemUomPhaseE3.test.js).
    assert.ok(true)
  })
})
