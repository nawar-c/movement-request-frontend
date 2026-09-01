// Movement Request — PWA Phase 2 service worker.
//
// This exists ONLY to satisfy Chrome/Edge's installability signal, which — per current evidence
// (developer.chrome.com/blog/update-install-criteria) — still requires a registered service worker
// with a fetch event listener for the install icon/prompt to appear, even though the separate
// "install from browser menu" path no longer requires one as of Chrome 108 (mobile) / 112 (desktop).
//
// It deliberately implements NO caching of any kind. Every request is passed straight through to
// the network exactly as if this file did not exist — this is a business application that must
// always reflect live data (Movement Requests, Oracle reference data, authentication), and must
// never serve a cached/stale response for any request, authenticated or not. Do not add caching,
// precaching, runtime strategies, or Workbox here without deliberately re-reviewing this file's
// entire purpose.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
