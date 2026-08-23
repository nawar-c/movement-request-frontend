// Pure, dependency-free theme-resolution logic (Phase G4) — no React, no apiClient, so it's
// directly unit-testable with Node's built-in test runner, the same convention used throughout this
// project (movementRequestHeader.js, lineItemUom.js, adminUsersList.js).
//
// index.html's anti-flash script cannot import this module — it must stay a single synchronous,
// blocking, non-`type="module"` inline <script> in <head> so it runs before the browser's first
// paint (a deferred module script could still allow a flash). It therefore re-implements the exact
// same resolveEffectiveTheme() rule directly in vanilla JS. Kept deliberately tiny (one ternary) so
// the two copies are trivially easy to eyeball for drift, and test/appThemePhaseG4.test.js asserts
// both copies resolve identically for every (preference, systemPrefersDark) combination.

export const THEME_STORAGE_KEY = 'mr_theme'
export const VALID_THEMES = ['light', 'dark', 'system']
export const DEFAULT_THEME = 'system'

export function isValidTheme(value) {
  return VALID_THEMES.includes(value)
}

// storage is injectable (defaults to window.localStorage) so this is testable without a browser,
// and so ThemeProvider/index.html's script both tolerate localStorage being unavailable (private
// browsing, quota, disabled) by falling back to DEFAULT_THEME rather than throwing.
export function getStoredPreference(storage = window.localStorage) {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY)
    return isValidTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function getSystemPrefersDark(matchMediaFn = window.matchMedia) {
  try {
    return matchMediaFn('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

// The single rule both index.html's inline script and ThemeProvider apply: an explicit light/dark
// preference always wins; 'system' (or anything else, defensively) follows the live OS signal.
export function resolveEffectiveTheme(preference, systemPrefersDark) {
  if (preference === 'dark') return 'dark'
  if (preference === 'light') return 'light'
  return systemPrefersDark ? 'dark' : 'light'
}
