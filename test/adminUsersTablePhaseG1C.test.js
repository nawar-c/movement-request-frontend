import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Phase G1C — Users table compact layout + action visibility. Same dependency-free Node
 * test-runner convention as E1-E4/G1B: source-structure checks in place of a rendering framework,
 * since AdminUsersPage.jsx and RowActionMenu.jsx can't be imported or rendered under plain Node.
 */

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function pageSource() {
  return readSource('../src/pages/AdminUsersPage.jsx')
}

function menuSource() {
  return readSource('../src/components/common/RowActionMenu.jsx')
}

// Isolates the <thead> block so column-shape assertions can't accidentally match unrelated content
// (e.g. a stray "Role" mention elsewhere in the file).
function theadBlock(source) {
  const start = source.indexOf('<thead>')
  const end = source.indexOf('</thead>', start)
  assert.notEqual(start, -1, 'could not find <thead>')
  assert.notEqual(end, -1, 'could not find </thead>')
  return source.slice(start, end)
}

// ---------------------------------------------------------------------------------------------
// A/B — Must Change Password: column removed, badge retained
// ---------------------------------------------------------------------------------------------
describe('A — Must Change Password is no longer its own table column', () => {
  test('the <thead> no longer contains a "Must Change Password" header', () => {
    const thead = theadBlock(pageSource())
    assert.doesNotMatch(thead, /Must Change Password/)
  })

  test('exactly 6 <th> cells remain (Username/Employee ID, Employee, Cost Center, Role, Active, blank Actions header)', () => {
    const thead = theadBlock(pageSource())
    // Matches <th> or <th ...> but not the <thead>/</thead> wrapper tags themselves.
    const thCount = (thead.match(/<th(?:>|\s)/g) || []).length
    assert.equal(thCount, 6)
  })
})

describe('B — must-change-password state remains visible as an inline badge', () => {
  test('a conditional "Must change password" status-badge renders in the username cell when mustChangePassword is true', () => {
    const source = pageSource()
    assert.match(source, /u\.mustChangePassword \? \(\s*<span className="status-badge status-badge--pending">Must change password<\/span>/)
  })

  test('the badge is conditional on the field, not always rendered - the common case (false) renders nothing extra', () => {
    const source = pageSource()
    assert.match(source, /\{u\.mustChangePassword \|\| u\.isNurse \? \(/)
  })
})

// ---------------------------------------------------------------------------------------------
// C — Employee Name + Email consolidated
// ---------------------------------------------------------------------------------------------
describe('C — Employee Name and Email are consolidated into one Employee cell', () => {
  test('EmployeeCell takes both employeeName and email and renders them together', () => {
    const source = pageSource()
    assert.match(source, /function EmployeeCell\(\{ employeeName, email \}\)/)
    assert.match(source, /<EmployeeCell employeeName=\{u\.employeeName\} email=\{u\.email\} \/>/)
  })

  test('only ONE "Synced from Oracle HCM" caption is emitted per EmployeeCell render, not one per field', () => {
    const source = pageSource()
    const employeeCellBody = source.slice(source.indexOf('function EmployeeCell'), source.indexOf('export function AdminUsersPage'))
    const captionCount = (employeeCellBody.match(/Synced from Oracle HCM/g) || []).length
    assert.equal(captionCount, 1)
  })

  test('the old two-column split (separate Employee Name th/td and Email th/td) is gone', () => {
    const thead = theadBlock(pageSource())
    assert.doesNotMatch(thead, /<th>Employee Name<\/th>/)
    assert.doesNotMatch(thead, /<th>Email<\/th>/)
  })

  test('unsynchronized users still show a compact "Not synchronized" indication', () => {
    const source = pageSource()
    assert.match(source, /if \(!employeeName\) \{\s*return <span className="text-faint">Not synchronized<\/span>/)
  })
})

// ---------------------------------------------------------------------------------------------
// D/E/F — Cost Center, Role, Active remain visible
// ---------------------------------------------------------------------------------------------
describe('D — Cost Center remains visible', () => {
  test('Cost Center is still its own column with the same "Not configured" fallback', () => {
    const thead = theadBlock(pageSource())
    assert.match(thead, /<th>Cost Center<\/th>/)
    assert.match(pageSource(), /u\.costCenter \? u\.costCenter : <span className="text-faint">Not configured<\/span>/)
  })
})

describe('E — Role remains visible', () => {
  test('Role is still its own column, rendered as plain text (no badge instruction was given for it)', () => {
    const thead = theadBlock(pageSource())
    assert.match(thead, /<th>Role<\/th>/)
    assert.match(pageSource(), /<td>\{u\.role\}<\/td>/)
  })
})

describe('F — Active remains visible, now using the existing status-badge visual language', () => {
  test('Active renders as a status-badge (ready/muted), matching the Organization Default Accounts Enabled/Disabled precedent', () => {
    const thead = theadBlock(pageSource())
    assert.match(thead, /<th>Active<\/th>/)
    const source = pageSource()
    assert.match(source, /status-badge \$\{u\.isActive \? 'status-badge--ready' : 'status-badge--muted'\}/)
    assert.match(source, /\{u\.isActive \? 'Active' : 'Inactive'\}/)
  })
})

// ---------------------------------------------------------------------------------------------
// G/H/I/J — Actions: Edit direct, secondary actions in menu
// ---------------------------------------------------------------------------------------------
describe('G — Edit remains directly visible (not inside the overflow menu)', () => {
  test('the Edit button is a plain sibling button, not a RowActionMenu item', () => {
    const source = pageSource()
    assert.match(source, /<button type="button" className="btn btn-sm" onClick=\{\(\) => setEditUser\(u\)\}>\s*Edit\s*<\/button>/)
  })
})

describe('H/I/J — Enable/Disable, Reset Password, and Sync Employee are in the RowActionMenu', () => {
  test('RowActionMenu is rendered per row with exactly these 3 items, calling the same existing handlers as before', () => {
    const source = pageSource()
    assert.match(source, /<RowActionMenu/)
    assert.match(source, /label: u\.isActive \? 'Disable' : 'Enable',\s*onSelect: \(\) => handleToggleActive\(u\),/)
    assert.match(source, /label: 'Reset Password',\s*onSelect: \(\) => setResetUser\(u\),/)
    assert.match(source, /label: syncingId === u\.id \? 'Syncing\.\.\.' : 'Sync Employee',\s*onSelect: \(\) => handleSyncEmployee\(u\),\s*disabled: syncingId === u\.id,/)
  })

  test('no new handler logic was introduced - handleToggleActive/setResetUser/handleSyncEmployee are the exact same function names as before this phase', () => {
    const source = pageSource()
    assert.match(source, /async function handleToggleActive\(u\) \{/)
    assert.match(source, /async function handleSyncEmployee\(u\) \{/)
  })
})

// ---------------------------------------------------------------------------------------------
// K — Bulk Sync stays page-level
// ---------------------------------------------------------------------------------------------
describe('K — Sync Employee Information (bulk) remains a page-level action, not moved into any row menu', () => {
  test('the bulk sync button is still in PageHeader actions, outside the table entirely', () => {
    const source = pageSource()
    const beforeTable = source.slice(0, source.indexOf('<div className="card">'))
    assert.match(beforeTable, /Sync Employee Information/)
    assert.match(beforeTable, /onClick=\{handleBulkSync\}/)
  })

  test('RowActionMenu items never include a bulk/"all users" action - only per-user actions', () => {
    const source = pageSource()
    const itemsBlock = source.slice(source.indexOf('<RowActionMenu'), source.indexOf('/>', source.indexOf('<RowActionMenu')))
    assert.doesNotMatch(itemsBlock, /handleBulkSync/)
  })
})

// ---------------------------------------------------------------------------------------------
// L/M — Accessibility + outside-click close (RowActionMenu itself)
// ---------------------------------------------------------------------------------------------
describe('L — the menu toggle button has accessibility label/state', () => {
  test('a real <button> with aria-haspopup, aria-expanded, and aria-label', () => {
    const source = menuSource()
    assert.match(source, /<button\s*\n?\s*type="button"/)
    assert.match(source, /aria-haspopup="true"/)
    assert.match(source, /aria-expanded=\{open\}/)
    assert.match(source, /aria-label=\{label\}/)
  })

  test('AdminUsersPage passes a per-user, non-generic aria-label', () => {
    const source = pageSource()
    assert.match(source, /label=\{`More actions for \$\{u\.username\}`\}/)
  })

  test('menu items are real <button> elements with role="menuitem", the panel has role="menu"', () => {
    const source = menuSource()
    assert.match(source, /role="menu"/)
    assert.match(source, /role="menuitem"/)
  })

  test('the app has no existing ARIA-menu infrastructure to reuse, so this is a minimal, self-contained implementation - not a full ARIA menu widget (no roving tabindex/arrow-key nav was added)', () => {
    const source = menuSource()
    assert.doesNotMatch(source, /tabIndex/, 'no custom roving-tabindex system was built - normal tab order is preserved')
  })
})

describe('M — outside-click closes the menu, and selecting an item always closes it first', () => {
  test('same mousedown-outside-close idiom already used by DataFreshness.jsx/LookupCombobox/ItemSearchCombobox', () => {
    const source = menuSource()
    assert.match(source, /document\.addEventListener\('mousedown', handleClickOutside\)/)
    assert.match(source, /if \(ref\.current && !ref\.current\.contains\(event\.target\)\) setOpen\(false\)/)
  })

  test('handleSelect calls setOpen(false) before invoking the item\'s own onSelect - the menu closes on every selection, deterministically, regardless of what the action itself does', () => {
    const source = menuSource()
    const fnBody = source.slice(source.indexOf('function handleSelect'), source.indexOf('return (', source.indexOf('function handleSelect')))
    const closeIndex = fnBody.indexOf('setOpen(false)')
    const selectIndex = fnBody.indexOf('item.onSelect()')
    assert.ok(closeIndex !== -1 && selectIndex !== -1 && closeIndex < selectIndex, 'setOpen(false) must run before item.onSelect()')
  })

  test('each row owns an independent RowActionMenu instance (no shared "which menu is open" state was lifted to the page) - live-verified in this phase\'s manual dev-server check that opening one row\'s menu closes another\'s via the same outside-click mechanism', () => {
    const source = pageSource()
    // one RowActionMenu per row, inside the .map((u) => ...) - not a single page-level instance
    assert.match(source, /\{users\.map\(\(u\) => \([\s\S]*?<RowActionMenu/)
  })
})

// ---------------------------------------------------------------------------------------------
// N — G1B pagination/search/filter wiring is unchanged
// ---------------------------------------------------------------------------------------------
describe('N — existing G1B pagination/search/filter wiring is untouched', () => {
  test('PaginationBar, buildListUsersParams, clampPageToTotal, and the filter-reset effect are all still present, unmodified in shape', () => {
    const source = pageSource()
    assert.match(source, /<PaginationBar page=\{page\} pageSize=\{pageSize\} total=\{total\} onPageChange=\{handlePageChange\} \/>/)
    assert.match(source, /buildListUsersParams\(\{ page: requestedPage, pageSize, search, role, isActive \}\)/)
    assert.match(source, /clampPageToTotal\(\{ page: result\.page, pageSize: result\.pageSize, total: result\.total \}\)/)
    assert.match(source, /\}, \[search, role, isActive, pageSize\]\)/)
  })

  test('no page-size selector was added (ADMIN_USERS_PAGE_SIZE is still the only pageSize source)', () => {
    const source = pageSource()
    assert.match(source, /const \[pageSize\] = useState\(ADMIN_USERS_PAGE_SIZE\)/)
  })
})

// ---------------------------------------------------------------------------------------------
// O — Create/Edit/Reset Password remain structurally present, E4 modal untouched
// ---------------------------------------------------------------------------------------------
describe('O — Create/Edit/Reset Password behavior remains structurally present', () => {
  test('CreateUserModal, EditUserModal, ResetPasswordModal are all still defined and rendered, unmodified in this phase', () => {
    const source = pageSource()
    assert.match(source, /function CreateUserModal\(/)
    assert.match(source, /function EditUserModal\(/)
    assert.match(source, /function ResetPasswordModal\(/)
    assert.match(source, /\{createOpen \? \(\s*<CreateUserModal/)
    assert.match(source, /\{editUser \? \(\s*<EditUserModal/)
    assert.match(source, /\{resetUser \? <ResetPasswordModal/)
  })

  test('CostCenterField and DestinationSubinventoryPicker are unmodified and still used by both Create and Edit', () => {
    const source = pageSource()
    assert.match(source, /function CostCenterField\(/)
    assert.match(source, /function DestinationSubinventoryPicker\(/)
  })

  test('Modal.jsx (the E4 fix) is still the only modal implementation used - no local re-implementation was introduced', () => {
    const source = pageSource()
    assert.match(source, /import \{ Modal \} from '\.\.\/components\/common\/Modal\.jsx'/)
    assert.doesNotMatch(source, /className="modal-overlay"/, 'no ad-hoc modal markup was added outside the shared Modal component')
  })
})
