import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Phase G3 — Navigation / App Shell polish. Same dependency-free Node test-runner convention as
 * E1-E4/G1/G2: source-structure checks in place of a rendering framework, since AppShell.jsx can't
 * be imported/rendered under plain Node (useAuth() needs AuthContext/router context, and
 * transitively api/client.js's import.meta.env).
 */

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function appShellSource() {
  return readSource('../src/components/layout/AppShell.jsx')
}

function cssSource() {
  return readSource('../src/styles/index.css')
}

function packageJson() {
  return JSON.parse(readSource('../package.json'))
}

// ---------------------------------------------------------------------------------------------
// 1/2 — NavLink used, Movement Requests uses prefix matching (no `end`)
// ---------------------------------------------------------------------------------------------
describe('1/2 — NavLink is used; Movement Requests uses prefix matching', () => {
  test('imports NavLink from react-router-dom, not Link', () => {
    const source = appShellSource()
    assert.match(source, /import \{ NavLink, Outlet \} from 'react-router-dom'/)
    assert.doesNotMatch(source, /\bLink,|\{ Link \}/, 'the plain Link component must no longer be imported/used')
  })

  test('the Movement Requests NavLink has no `end` prop - prefix matching keeps it active for the whole section', () => {
    const source = appShellSource()
    const brandMatch = source.match(/<NavLink to="\/movement-requests" className=\{brandLinkClassName\}[^>]*>/)
    assert.ok(brandMatch, 'Movement Requests NavLink not found')
    assert.doesNotMatch(brandMatch[0], /\bend\b/, 'Movement Requests must NOT use `end` - it needs prefix matching across list/new/view/edit')
  })
})

// ---------------------------------------------------------------------------------------------
// 3/4/5 — /movement-requests/new, /movement-requests/:id, /movement-requests/:id/edit all stay
// in the Movement Requests active section (a direct consequence of prefix matching + the actual
// route tree in App.jsx - verified here that the route tree itself still nests all 4 under the
// same /movement-requests prefix, so NavLink's default matching genuinely covers them).
// ---------------------------------------------------------------------------------------------
describe('3/4/5 — all 4 Movement Request routes remain under the /movement-requests prefix (App.jsx unchanged)', () => {
  test('App.jsx still defines all 4 routes as /movement-requests or /movement-requests/... (no route path changed by G3)', () => {
    const appSource = readSource('../src/App.jsx')
    assert.match(appSource, /path="\/movement-requests"/)
    assert.match(appSource, /path="\/movement-requests\/new"/)
    assert.match(appSource, /path="\/movement-requests\/:id\/edit"/)
    assert.match(appSource, /path="\/movement-requests\/:id"/)
  })
})

// ---------------------------------------------------------------------------------------------
// 6 — Dashboard uses exact matching
// ---------------------------------------------------------------------------------------------
describe('6 — Dashboard uses exact (end) matching', () => {
  test('the Dashboard NavLink has the `end` prop', () => {
    const source = appShellSource()
    assert.match(source, /<NavLink to="\/dashboard" end className=\{navLinkClassName\}>/)
  })
})

// ---------------------------------------------------------------------------------------------
// 7 — each ADMIN nav item uses exact (end) matching
// ---------------------------------------------------------------------------------------------
describe('7 — each ADMIN nav item uses exact (end) matching', () => {
  test('Users, Approval Rules, Org Accounts, and Admin (Master Data Sync) NavLinks all have `end`', () => {
    const source = appShellSource()
    assert.match(source, /<NavLink to="\/admin\/users" end className=\{navLinkClassName\}>/)
    assert.match(source, /<NavLink to="\/admin\/approval-rules" end className=\{navLinkClassName\}>/)
    assert.match(source, /<NavLink to="\/admin\/organization-default-accounts" end className=\{navLinkClassName\}>/)
    assert.match(source, /<NavLink to="\/admin\/master-data-sync" end className=\{navLinkClassName\}>/)
  })
})

// ---------------------------------------------------------------------------------------------
// 8 — ADMIN visibility condition unchanged
// ---------------------------------------------------------------------------------------------
describe('8 — ADMIN link visibility condition is unchanged', () => {
  test('isAdmin is still derived from user?.role === \'ADMIN\', and the 4 admin links are still gated behind it', () => {
    const source = appShellSource()
    assert.match(source, /const isAdmin = user\?\.role === 'ADMIN'/)
    assert.match(source, /\{isAdmin \? \(/)
  })
})

// ---------------------------------------------------------------------------------------------
// 9/10 — Oracle badge removed, no replacement badge introduced
// ---------------------------------------------------------------------------------------------
describe('9/10 — Oracle: Mock badge removed, no replacement introduced', () => {
  test('"Oracle: Mock" text is completely absent from AppShell.jsx', () => {
    const source = appShellSource()
    assert.doesNotMatch(source, /Oracle: Mock/)
    assert.doesNotMatch(source, /Oracle integration mode/)
  })

  test('the now-unused .app-topbar__env class is removed from both the component and the stylesheet - genuinely unused, not left as dead CSS', () => {
    const source = appShellSource()
    const css = cssSource()
    assert.doesNotMatch(source, /app-topbar__env/)
    assert.doesNotMatch(css, /\.app-topbar__env/)
  })

  test('no replacement environment/mode badge was introduced (no new span/badge referencing environment, mode, or Oracle in the topbar)', () => {
    const source = appShellSource()
    assert.doesNotMatch(source, /[Ee]nvironment/)
    assert.doesNotMatch(source, /ORACLE_SERVICE_IMPL/)
  })
})

// ---------------------------------------------------------------------------------------------
// 11 — DashboardIcon no longer rendered/imported by AppShell (but untouched in icons.jsx)
// ---------------------------------------------------------------------------------------------
describe('11 — DashboardIcon removed from AppShell only, not from the shared icon file', () => {
  test('AppShell.jsx no longer imports or renders DashboardIcon', () => {
    const source = appShellSource()
    assert.doesNotMatch(source, /DashboardIcon/)
  })

  test('DashboardIcon is still exported from icons.jsx, untouched - it may be reused elsewhere later', () => {
    const iconsSource = readSource('../src/components/common/icons.jsx')
    assert.match(iconsSource, /export function DashboardIcon\(props\) \{/)
  })

  test('no other icon import was added to AppShell.jsx in its place', () => {
    const source = appShellSource()
    assert.doesNotMatch(source, /from '\.\.\/common\/icons\.jsx'/)
  })
})

// ---------------------------------------------------------------------------------------------
// 12 — active-state CSS uses only existing design tokens
// ---------------------------------------------------------------------------------------------
describe('12 — active-state CSS uses only existing design tokens, no new colors', () => {
  test('.app-topbar__nav-link--active uses var(--color-primary) and font-weight 600, no literal hex/rgb colors', () => {
    const css = cssSource()
    const ruleMatch = css.match(/\.app-topbar__nav-link--active \{([^}]*)\}/)
    assert.ok(ruleMatch, 'active nav-link rule not found')
    const body = ruleMatch[1]
    assert.match(body, /color: var\(--color-primary\)/)
    assert.match(body, /font-weight: 600/)
    assert.match(body, /border-bottom-color: var\(--color-primary\)/)
    assert.doesNotMatch(body, /#[0-9a-fA-F]{3,6}/, 'no new literal hex color introduced')
    assert.doesNotMatch(body, /rgb\(/, 'no new literal rgb color introduced')
  })

  test('.app-topbar__brand--active likewise uses only var(--color-primary), no new colors, and does not redefine font-weight/size (brand identity preserved)', () => {
    const css = cssSource()
    const ruleMatch = css.match(/\.app-topbar__brand--active \{([^}]*)\}/)
    assert.ok(ruleMatch, 'active brand rule not found')
    const body = ruleMatch[1]
    assert.match(body, /color: var\(--color-primary\)/)
    assert.doesNotMatch(body, /font-weight/, 'brand keeps its own weight - only color/border change on active')
    assert.doesNotMatch(body, /font-size/)
  })

  test('the border-bottom is reserved (transparent) on the base rules, not just added on --active, so no layout shift occurs when toggling active state', () => {
    const css = cssSource()
    const brandBase = css.match(/\.app-topbar__brand \{([^}]*)\}/)[1]
    const navBase = css.match(/\.app-topbar__nav-link \{([^}]*)\}/)[1]
    assert.match(brandBase, /border-bottom: 2px solid transparent/)
    assert.match(navBase, /border-bottom: 2px solid transparent/)
  })
})

// ---------------------------------------------------------------------------------------------
// 13 — no new navigation icon library/dependency
// ---------------------------------------------------------------------------------------------
describe('13 — no new icon library or dependency was introduced', () => {
  test('package.json dependencies/devDependencies are unchanged by G3 (no icon package added)', () => {
    const pkg = packageJson()
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    const iconLikeDeps = Object.keys(allDeps).filter((name) => /icon/i.test(name))
    assert.deepEqual(iconLikeDeps, [], 'no icon-named package should have been added')
  })
})

// ---------------------------------------------------------------------------------------------
// 14 — no hamburger/collapse implementation introduced
// ---------------------------------------------------------------------------------------------
describe('14 — no hamburger/collapse navigation was introduced', () => {
  test('AppShell.jsx has no mobile-menu/hamburger/collapse state or markup', () => {
    const source = appShellSource()
    assert.doesNotMatch(source, /hamburger/i)
    assert.doesNotMatch(source, /menuOpen/i)
    assert.doesNotMatch(source, /useState/, 'AppShell remains a stateless layout component - no new local state was introduced for G3')
  })

  test('.app-topbar retains its existing single-row flex layout - no flex-wrap or collapse media query added', () => {
    const css = cssSource()
    const topbarRule = css.match(/\.app-topbar \{([^}]*)\}/)[1]
    assert.doesNotMatch(topbarRule, /flex-wrap/)
    assert.doesNotMatch(css, /@media[^{]*\{\s*\.app-topbar/, 'no responsive breakpoint was added for .app-topbar')
  })
})

// ---------------------------------------------------------------------------------------------
// 15 — existing navigation destinations/order remain unchanged
// ---------------------------------------------------------------------------------------------
describe('15 — nav destinations and order are unchanged (G5B.1 note: /reports/requests was legitimately inserted after /dashboard; all 6 original destinations keep their exact prior order)', () => {
  test('the original 6 destinations remain, in their exact original relative order, with exactly one new destination (/reports/requests) inserted right after /dashboard', () => {
    const source = appShellSource()
    const hrefs = Array.from(source.matchAll(/to="([^"]+)"/g)).map((m) => m[1])
    assert.deepEqual(hrefs, [
      '/movement-requests',
      '/dashboard',
      '/reports/requests',
      '/admin/users',
      '/admin/approval-rules',
      '/admin/organization-default-accounts',
      '/admin/master-data-sync',
    ])
  })

  test('Logout button and username display are still present, unchanged', () => {
    const source = appShellSource()
    assert.match(source, /onClick=\{logout\}/)
    assert.match(source, /\{user\?\.username \? \(/)
  })
})
