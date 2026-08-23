import { useEffect, useState } from 'react'
import { ThemeContext } from './themeContext.js'
import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  getStoredPreference,
  getSystemPrefersDark,
  resolveEffectiveTheme,
} from './resolveTheme.js'

// Deliberately separate from AuthContext/AuthProvider (see auth/AuthContext.jsx) — theme has no
// conceptual link to a session, and must apply on the unauthenticated /login page too, which is
// only possible if it doesn't live inside auth state. Mounted outside/above AuthProvider in
// App.jsx for exactly that reason.
export function ThemeProvider({ children }) {
  // Lazy initializers read from localStorage/matchMedia synchronously on the very first render -
  // not in a useEffect (which runs after paint). This must resolve to the exact same value
  // index.html's inline anti-flash script already applied to <html data-theme="..."> before React
  // ever mounted, so this is a no-op re-application, never a second visible flash.
  const [preference, setPreferenceState] = useState(() => getStoredPreference())
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => getSystemPrefersDark())

  const effectiveTheme = resolveEffectiveTheme(preference, systemPrefersDark)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  // Live OS-preference changes while the app is open. The listener stays registered regardless of
  // the current preference - resolveEffectiveTheme already ignores systemPrefersDark whenever
  // preference is an explicit 'light'/'dark', so switching away from System naturally stops the OS
  // signal from having any visible effect without needing to tear the listener down and re-add it;
  // switching back to System resumes following it immediately, using whatever the OS's current
  // state already is.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange(event) {
      setSystemPrefersDark(event.matches)
    }
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  function setPreference(next) {
    setPreferenceState(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // localStorage may be unavailable (private browsing, quota, disabled) - the in-memory
      // selection still applies for this session, it just won't persist across a reload.
    }
  }

  const value = { preference, effectiveTheme, setPreference, defaultTheme: DEFAULT_THEME }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
