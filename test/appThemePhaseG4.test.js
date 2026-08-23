import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  THEME_STORAGE_KEY,
  VALID_THEMES,
  DEFAULT_THEME,
  isValidTheme,
  getStoredPreference,
  getSystemPrefersDark,
  resolveEffectiveTheme,
} from '../src/theme/resolveTheme.js'

/**
 * Phase G4 — Dark Mode. resolveTheme.js has zero React/apiClient dependency, so unlike most of this
 * project's UI logic, it's directly behavior-testable, not just source-structure-checkable. Every
 * other G4 file (ThemeContext.jsx, AppShell.jsx, index.html, index.css) still uses the established
 * source-structure-check convention (readFileSync + regex), since none of them can be
 * imported/rendered under plain Node.
 */

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function cssSource() {
  return readSource('../src/styles/index.css')
}

function indexHtmlSource() {
  return readSource('../index.html')
}

function themeProviderSource() {
  return readSource('../src/theme/ThemeContext.jsx')
}

function appShellSource() {
  return readSource('../src/components/layout/AppShell.jsx')
}

function appSource() {
  return readSource('../src/App.jsx')
}

// A minimal fake localStorage - Map-backed, same shape Web Storage exposes (getItem/setItem).
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  }
}

function fakeMatchMedia(matches) {
  return () => ({ matches })
}

// ---------------------------------------------------------------------------------------------
// A — valid theme values / constants
// ---------------------------------------------------------------------------------------------
describe('A — valid theme values', () => {
  test('VALID_THEMES is exactly light/dark/system', () => {
    assert.deepEqual(VALID_THEMES, ['light', 'dark', 'system'])
  })

  test('isValidTheme accepts only the 3 valid values', () => {
    assert.equal(isValidTheme('light'), true)
    assert.equal(isValidTheme('dark'), true)
    assert.equal(isValidTheme('system'), true)
    assert.equal(isValidTheme('blue'), false)
    assert.equal(isValidTheme(''), false)
    assert.equal(isValidTheme(null), false)
    assert.equal(isValidTheme(undefined), false)
  })

  test('DEFAULT_THEME is system', () => {
    assert.equal(DEFAULT_THEME, 'system')
  })

  test('THEME_STORAGE_KEY follows the existing mr_* naming convention (mr_auth_token)', () => {
    assert.equal(THEME_STORAGE_KEY, 'mr_theme')
  })
})

// ---------------------------------------------------------------------------------------------
// B — invalid/missing stored preference fallback, default behavior
// ---------------------------------------------------------------------------------------------
describe('B — getStoredPreference: invalid/missing fallback and default behavior', () => {
  test('no stored value -> DEFAULT_THEME (system)', () => {
    assert.equal(getStoredPreference(fakeStorage()), 'system')
  })

  test('a valid stored value is returned as-is', () => {
    assert.equal(getStoredPreference(fakeStorage({ mr_theme: 'dark' })), 'dark')
    assert.equal(getStoredPreference(fakeStorage({ mr_theme: 'light' })), 'light')
    assert.equal(getStoredPreference(fakeStorage({ mr_theme: 'system' })), 'system')
  })

  test('an invalid/corrupted stored value falls back to DEFAULT_THEME, not thrown', () => {
    assert.equal(getStoredPreference(fakeStorage({ mr_theme: 'purple' })), 'system')
    assert.equal(getStoredPreference(fakeStorage({ mr_theme: '' })), 'system')
  })

  test('a storage that throws on getItem (unavailable/private browsing) falls back safely, never throws', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
    }
    assert.equal(getStoredPreference(throwingStorage), 'system')
  })
})

// ---------------------------------------------------------------------------------------------
// C — prefers-color-scheme handling
// ---------------------------------------------------------------------------------------------
describe('C — getSystemPrefersDark reads prefers-color-scheme via matchMedia', () => {
  test('matches: true -> true', () => {
    assert.equal(getSystemPrefersDark(fakeMatchMedia(true)), true)
  })

  test('matches: false -> false', () => {
    assert.equal(getSystemPrefersDark(fakeMatchMedia(false)), false)
  })

  test('a matchMedia that throws (unavailable) falls back to false, never throws', () => {
    assert.equal(
      getSystemPrefersDark(() => {
        throw new Error('not supported')
      }),
      false,
    )
  })
})

// ---------------------------------------------------------------------------------------------
// D/E/F/G — Light/Dark/System selection, effective theme resolution
// ---------------------------------------------------------------------------------------------
describe('D — Light selection: effective theme is always light, regardless of system', () => {
  test('preference=light, system=dark -> light (explicit wins)', () => {
    assert.equal(resolveEffectiveTheme('light', true), 'light')
  })
  test('preference=light, system=light -> light', () => {
    assert.equal(resolveEffectiveTheme('light', false), 'light')
  })
})

describe('E — Dark selection: effective theme is always dark, regardless of system', () => {
  test('preference=dark, system=light -> dark (explicit wins)', () => {
    assert.equal(resolveEffectiveTheme('dark', false), 'dark')
  })
  test('preference=dark, system=dark -> dark', () => {
    assert.equal(resolveEffectiveTheme('dark', true), 'dark')
  })
})

describe('F — System selection: effective theme follows the live system signal', () => {
  test('preference=system, system prefers dark -> dark', () => {
    assert.equal(resolveEffectiveTheme('system', true), 'dark')
  })
  test('preference=system, system prefers light -> light', () => {
    assert.equal(resolveEffectiveTheme('system', false), 'light')
  })
})

describe('G — live OS-theme-change handling in System mode (via resolveEffectiveTheme, called again with the new signal)', () => {
  test('changing systemPrefersDark while preference stays "system" changes the resolved effective theme', () => {
    assert.equal(resolveEffectiveTheme('system', false), 'light')
    assert.equal(resolveEffectiveTheme('system', true), 'dark')
  })

  test('changing systemPrefersDark while preference is an explicit light/dark has NO effect on the resolved theme', () => {
    assert.equal(resolveEffectiveTheme('dark', false), 'dark')
    assert.equal(resolveEffectiveTheme('dark', true), 'dark')
    assert.equal(resolveEffectiveTheme('light', false), 'light')
    assert.equal(resolveEffectiveTheme('light', true), 'light')
  })

  test('ThemeContext.jsx actually subscribes to the OS change event, not just resolves a static value once', () => {
    const source = themeProviderSource()
    assert.match(source, /mql\.addEventListener\('change', handleChange\)/)
    assert.match(source, /mql\.removeEventListener\('change', handleChange\)/, 'listener must be cleaned up on unmount')
  })
})

// ---------------------------------------------------------------------------------------------
// H — localStorage persistence
// ---------------------------------------------------------------------------------------------
describe('H — localStorage persistence', () => {
  test('ThemeContext.jsx writes the selected preference to localStorage under THEME_STORAGE_KEY on every change', () => {
    const source = themeProviderSource()
    assert.match(source, /window\.localStorage\.setItem\(THEME_STORAGE_KEY, next\)/)
  })

  test('a localStorage write failure (quota/private browsing) is caught, not left to crash the app', () => {
    const source = themeProviderSource()
    const setPreferenceBody = source.slice(source.indexOf('function setPreference'), source.indexOf('const value ='))
    assert.match(setPreferenceBody, /try \{/)
    assert.match(setPreferenceBody, /catch/)
  })
})

// ---------------------------------------------------------------------------------------------
// I — data-theme application
// ---------------------------------------------------------------------------------------------
describe('I — data-theme is applied to the <html> element', () => {
  test('ThemeContext.jsx sets document.documentElement data-theme to the resolved effectiveTheme', () => {
    const source = themeProviderSource()
    assert.match(source, /document\.documentElement\.setAttribute\('data-theme', effectiveTheme\)/)
  })
})

// ---------------------------------------------------------------------------------------------
// J — anti-flash initialization presence
// ---------------------------------------------------------------------------------------------
describe('J — anti-flash initialization in index.html', () => {
  test('index.html contains a plain synchronous inline script (not type="module") that sets data-theme before <body>', () => {
    const html = indexHtmlSource()
    const headEnd = html.indexOf('</head>')
    const bodyStart = html.indexOf('<body>')
    assert.ok(headEnd !== -1 && headEnd < bodyStart, 'the script must be inside <head>, before <body>')
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/)
    assert.ok(scriptMatch, 'expected a plain (non-module) inline <script> in index.html')
    assert.ok(html.indexOf(scriptMatch[0]) < bodyStart, 'the inline script must appear before <body>')
    assert.match(scriptMatch[1], /document\.documentElement\.setAttribute\('data-theme'/)
  })

  test('the inline script uses the same storage key and the same resolution rule as resolveTheme.js (duplicated on purpose, kept in sync)', () => {
    const html = indexHtmlSource()
    assert.match(html, /var KEY = 'mr_theme';/)
    assert.equal("'mr_theme'", `'${THEME_STORAGE_KEY}'`, 'sanity: THEME_STORAGE_KEY itself must equal the literal used in index.html')
    // Same 3-branch rule as resolveEffectiveTheme: dark wins if explicit dark, light wins if explicit
    // light, otherwise follow systemPrefersDark. Asserted structurally since index.html can't import
    // resolveTheme.js's actual function.
    assert.match(html, /preference === 'dark' \? 'dark' : preference === 'light' \? 'light' : \(systemPrefersDark \? 'dark' : 'light'\)/)
  })

  test('the inline script is wrapped in try/catch so a localStorage/matchMedia failure never breaks page load', () => {
    const html = indexHtmlSource()
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/)
    assert.match(scriptMatch[1], /try \{/)
    assert.match(scriptMatch[1], /catch/)
  })

  test('no unrelated logic was added to index.html - the script is theme-only', () => {
    const html = indexHtmlSource()
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/)
    assert.doesNotMatch(scriptMatch[1], /fetch\(|XMLHttpRequest|analytics|gtag/i)
  })
})

// ---------------------------------------------------------------------------------------------
// K — ThemeProvider placement
// ---------------------------------------------------------------------------------------------
describe('K — ThemeProvider placement in App.jsx', () => {
  test('ThemeProvider wraps AuthProvider (outside/above it), so theme applies to the login page too', () => {
    const source = appSource()
    const themeIndex = source.indexOf('<ThemeProvider>')
    const authIndex = source.indexOf('<AuthProvider>')
    assert.ok(themeIndex !== -1, 'ThemeProvider not found in App.jsx')
    assert.ok(authIndex !== -1, 'AuthProvider not found in App.jsx')
    assert.ok(themeIndex < authIndex, 'ThemeProvider must open before AuthProvider (i.e. wrap it, not be wrapped by it)')
  })

  test('theme state is not added to AuthContext/AuthProvider - AuthContext.jsx has zero theme-related code', () => {
    const authSource = readSource('../src/auth/AuthContext.jsx')
    assert.doesNotMatch(authSource, /theme/i)
  })

  test('route path definitions in App.jsx are unchanged by G4 (still the exact same 4 Movement Request routes + 4 admin routes)', () => {
    const source = appSource()
    assert.match(source, /path="\/movement-requests"/)
    assert.match(source, /path="\/movement-requests\/new"/)
    assert.match(source, /path="\/movement-requests\/:id\/edit"/)
    assert.match(source, /path="\/movement-requests\/:id"/)
    assert.match(source, /path="\/admin\/users"/)
    assert.match(source, /path="\/admin\/approval-rules"/)
    assert.match(source, /path="\/admin\/organization-default-accounts"/)
    assert.match(source, /path="\/admin\/master-data-sync"/)
  })
})

// ---------------------------------------------------------------------------------------------
// L — theme selector presence
// ---------------------------------------------------------------------------------------------
describe('L — theme selector control is present in AppShell', () => {
  test('renders all 3 options (Light/Dark/System) reusing the existing .preset-group/.preset-btn pattern', () => {
    const source = appShellSource()
    assert.match(source, /import \{ useTheme \} from '\.\.\/\.\.\/theme\/useTheme\.js'/)
    assert.match(source, /THEME_OPTIONS = \[\s*\{ value: 'light', label: 'Light' \},\s*\{ value: 'dark', label: 'Dark' \},\s*\{ value: 'system', label: 'System' \},\s*\]/)
    assert.match(source, /className="preset-group" role="group" aria-label="Theme"/)
    assert.match(source, /className=\{`preset-btn\$\{preference === opt\.value \? ' preset-btn--active' : ''\}`\}/)
  })

  test('the selected option is visually obvious via aria-pressed, matching the Dashboard preset control\'s own accessibility pattern', () => {
    const source = appShellSource()
    assert.match(source, /aria-pressed=\{preference === opt\.value\}/)
  })

  test('no icon package or new icon was introduced for the theme control - plain text labels only', () => {
    const source = appShellSource()
    assert.doesNotMatch(source, /Icon/, 'no icon component reference in the theme control area')
  })
})

// ---------------------------------------------------------------------------------------------
// M — no API/backend call
// ---------------------------------------------------------------------------------------------
describe('M — no API/backend call anywhere in the theme implementation', () => {
  test('resolveTheme.js, ThemeContext.jsx have no fetch/apiClient/api import statement (doc comments mentioning "no apiClient" in prose are fine - only real import/call syntax is checked)', () => {
    for (const source of [readSource('../src/theme/resolveTheme.js'), themeProviderSource()]) {
      assert.doesNotMatch(source, /^import .*apiClient/m)
      assert.doesNotMatch(source, /from '\.\.\/api\//)
      assert.doesNotMatch(source, /\bfetch\(/)
    }
  })
})

// ---------------------------------------------------------------------------------------------
// N — dark token block completeness
// ---------------------------------------------------------------------------------------------
describe('N — dark token block completeness', () => {
  function extractTokenNames(block) {
    return Array.from(block.matchAll(/--(color-[a-z0-9-]+|chart-\d|shadow-(sm|md))\s*:/g)).map((m) => m[1])
  }

  test('every color/chart/shadow token defined in the light :root also has a dark override', () => {
    const css = cssSource()
    const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n\n/* Phase G4 — dark theme'))
    const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf('}', css.indexOf(':root[data-theme="dark"]')) + 1)
    const lightTokens = new Set(extractTokenNames(lightBlock))
    const darkTokens = new Set(extractTokenNames(darkBlock))
    const missing = [...lightTokens].filter((t) => !darkTokens.has(t))
    assert.deepEqual(missing, [], `these light tokens have no dark override: ${missing.join(', ')}`)
  })

  test('the dark block does not introduce any color token absent from light (no orphaned/typo token)', () => {
    const css = cssSource()
    const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n\n/* Phase G4 — dark theme'))
    const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf('}', css.indexOf(':root[data-theme="dark"]')) + 1)
    const lightTokens = new Set(extractTokenNames(lightBlock))
    const darkTokens = new Set(extractTokenNames(darkBlock))
    const orphaned = [...darkTokens].filter((t) => !lightTokens.has(t))
    assert.deepEqual(orphaned, [], `these dark tokens don't exist in light: ${orphaned.join(', ')}`)
  })

  test('radius and font tokens are NOT redefined in dark mode - they are not color-dependent', () => {
    const css = cssSource()
    const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf('}', css.indexOf(':root[data-theme="dark"]')) + 1)
    assert.doesNotMatch(darkBlock, /--radius-/)
    assert.doesNotMatch(darkBlock, /--font-sans/)
  })
})

// ---------------------------------------------------------------------------------------------
// O — hardcoded theme-color cleanup
// ---------------------------------------------------------------------------------------------
describe('O — hardcoded theme-dependent colors were tokenized', () => {
  test('the 4 primary-derived translucent rgba(30, 94, 171, ...) literals are gone, replaced by rgba(var(--color-primary-rgb), ...)', () => {
    const css = cssSource()
    assert.doesNotMatch(css, /rgba\(30, 94, 171,/)
    // Strip /* ... */ comments first so a doc comment mentioning this same syntax as prose (explaining
    // why the token exists) is never counted as a real usage site.
    const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const primaryRgbUsages = cssWithoutComments.match(/rgba\(var\(--color-primary-rgb\),/g) || []
    assert.equal(primaryRgbUsages.length, 4, 'expected exactly 4 usages: focus outline, table row hover, preset-btn--active, activity-row--active')
  })

  test('the hardcoded #f0d9a6 warning-notice border is gone from the usage site, replaced by var(--color-warning-border) - the literal itself correctly still lives once, as that token\'s own light-mode value', () => {
    const css = cssSource()
    const inlineNoticeRule = css.match(/\.inline-notice \{[^}]*\}/)[0]
    assert.doesNotMatch(inlineNoticeRule, /#f0d9a6/)
    assert.match(inlineNoticeRule, /border: 1px solid var\(--color-warning-border\);/)
  })

  test('modal-overlay and drawer-overlay use tokens at their usage sites, not a hardcoded rgba(17, 24, 32, ...) inline - the literals correctly still live once, as those tokens\' own light-mode values', () => {
    const css = cssSource()
    const modalOverlayRule = css.match(/\.modal-overlay \{[^}]*\}/)[0]
    const drawerOverlayRule = css.match(/\.drawer-overlay \{[^}]*\}/)[0]
    assert.doesNotMatch(modalOverlayRule, /rgba\(17, 24, 32,/)
    assert.doesNotMatch(drawerOverlayRule, /rgba\(17, 24, 32,/)
    assert.match(modalOverlayRule, /background: var\(--color-overlay\);/)
    assert.match(drawerOverlayRule, /background: var\(--color-overlay-drawer\);/)
  })

  test('the light-mode token VALUES for the newly-introduced tokens exactly reproduce the original literals - light mode is visually unchanged', () => {
    const css = cssSource()
    const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n\n/* Phase G4 — dark theme'))
    assert.match(lightBlock, /--color-primary-rgb: 30, 94, 171;/)
    assert.match(lightBlock, /--color-warning-border: #f0d9a6;/)
    assert.match(lightBlock, /--color-overlay: rgba\(17, 24, 32, 0\.45\);/)
    assert.match(lightBlock, /--color-overlay-drawer: rgba\(17, 24, 32, 0\.4\);/)
  })
})

// ---------------------------------------------------------------------------------------------
// P — native color-scheme handling
// ---------------------------------------------------------------------------------------------
describe('P — native control color-scheme', () => {
  test('color-scheme: light is set on the base :root, color-scheme: dark on the dark override - native controls (date input, select, checkbox, scrollbars) follow the resolved theme', () => {
    const css = cssSource()
    const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n\n/* Phase G4 — dark theme'))
    const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf('}', css.indexOf(':root[data-theme="dark"]')) + 1)
    assert.match(lightBlock, /color-scheme: light;/)
    assert.match(darkBlock, /color-scheme: dark;/)
  })

  test('no custom native-control replacement was introduced (no custom date-picker/select/checkbox component)', () => {
    const appShell = appShellSource()
    assert.doesNotMatch(appShell, /DatePicker|CustomSelect|CustomCheckbox/)
  })
})

// ---------------------------------------------------------------------------------------------
// Q — existing G3 navigation structure unchanged
// ---------------------------------------------------------------------------------------------
describe('Q — existing G3 navigation structure is unchanged', () => {
  test('all 6 nav destinations still exist, same order, NavLink still used with the same end/prefix-matching rules', () => {
    const source = appShellSource()
    const hrefs = Array.from(source.matchAll(/to="([^"]+)"/g)).map((m) => m[1])
    assert.deepEqual(hrefs, [
      '/movement-requests',
      '/dashboard',
      '/admin/users',
      '/admin/approval-rules',
      '/admin/organization-default-accounts',
      '/admin/master-data-sync',
    ])
    assert.match(source, /<NavLink to="\/movement-requests" className=\{brandLinkClassName\}/)
    assert.doesNotMatch(source.match(/<NavLink to="\/movement-requests"[^>]*>/)[0], /\bend\b/)
    assert.match(source, /<NavLink to="\/dashboard" end/)
  })

  test('the active-state CSS rules from G3 (.app-topbar__nav-link--active, .app-topbar__brand--active) are untouched', () => {
    const css = cssSource()
    assert.match(css, /\.app-topbar__nav-link--active \{\s*color: var\(--color-primary\);\s*font-weight: 600;\s*border-bottom-color: var\(--color-primary\);\s*\}/)
    assert.match(css, /\.app-topbar__brand--active \{\s*color: var\(--color-primary\);\s*border-bottom-color: var\(--color-primary\);\s*\}/)
  })

  test('Oracle: Mock badge and DashboardIcon remain removed (G3) - G4 did not reintroduce either', () => {
    const source = appShellSource()
    assert.doesNotMatch(source, /Oracle: Mock/)
    assert.doesNotMatch(source, /DashboardIcon/)
  })
})

// ---------------------------------------------------------------------------------------------
// R — no business-logic files touched
// ---------------------------------------------------------------------------------------------
describe('R — no business-logic files were touched by G4', () => {
  test('none of the E1-E4/G1/G2 business-logic utils reference theme in any way', () => {
    const businessFiles = [
      '../src/utils/movementRequestHeader.js',
      '../src/utils/validation.js',
      '../src/utils/lineItemUom.js',
      '../src/utils/lineDestinationAccount.js',
      '../src/api/movementRequestSerializers.js',
      '../src/utils/adminUsersList.js',
    ]
    for (const file of businessFiles) {
      const source = readSource(file)
      assert.doesNotMatch(source, /theme/i, `${file} must have no theme-related reference`)
    }
  })
})
