// PWA Phase 2 — registers the pure-passthrough service worker (public/sw.js) so Chrome/Edge treat
// this app as installable. Only registered for a production build: Vite's own dev server already
// does its own module serving/HMR, and a service worker sitting in front of that in dev mode is a
// well-known source of confusing stale-module bugs unrelated to anything this app controls. This
// has no effect on business behavior either way — the service worker itself caches nothing (see
// public/sw.js) — this guard exists purely to keep local development friction-free.
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is a progressive enhancement — a registration failure (e.g. an unsupported
      // browser edge case) must never break the application itself.
    })
  })
}
