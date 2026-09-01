import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * PWA Phase 2 — installability only, no offline/business-data caching. Same dependency-free
 * Node test-runner convention as the rest of this repo: pure JSON/text assertions plus
 * source-structure checks in place of a rendering framework or a real browser/service-worker
 * runtime (neither is available to `node --test`).
 */

function readRoot(relPath) {
  return readFileSync(fileURLToPath(new URL(`../${relPath}`, import.meta.url)), 'utf8')
}

function rootPath(relPath) {
  return fileURLToPath(new URL(`../${relPath}`, import.meta.url))
}

describe('A — manifest.webmanifest', () => {
  const manifest = JSON.parse(readRoot('public/manifest.webmanifest'))

  test('name/short_name are exactly "Movement Request"', () => {
    assert.equal(manifest.name, 'Movement Request')
    assert.equal(manifest.short_name, 'Movement Request')
  })

  test('description matches the approved text exactly', () => {
    assert.equal(manifest.description, 'Inventory movement requests outside Oracle Fusion')
  })

  test('start_url and scope are origin-relative "/" — never a hardcoded hostname', () => {
    assert.equal(manifest.start_url, '/')
    assert.equal(manifest.scope, '/')
    assert.doesNotMatch(JSON.stringify(manifest), /vercel\.app|localhost|onrender\.com/)
  })

  test('id is origin-relative, not a hardcoded hostname', () => {
    assert.equal(manifest.id, '/')
  })

  test('display is standalone', () => {
    assert.equal(manifest.display, 'standalone')
  })

  test('theme_color/background_color match the existing light-mode CSS tokens, not invented colors', () => {
    const css = readRoot('src/styles/index.css')
    assert.match(css, /--color-primary: #1e5eab;/)
    assert.match(css, /--color-bg: #f4f6f8;/)
    assert.equal(manifest.theme_color, '#1e5eab')
    assert.equal(manifest.background_color, '#f4f6f8')
  })

  test('icons array has 192x192 (any), 512x512 (any), and a separate 512x512 maskable entry', () => {
    const any192 = manifest.icons.find((i) => i.sizes === '192x192')
    const any512 = manifest.icons.find((i) => i.sizes === '512x512' && i.purpose === 'any')
    const maskable512 = manifest.icons.find((i) => i.purpose === 'maskable')
    assert.ok(any192, '192x192 icon missing')
    assert.ok(any512, '512x512 any-purpose icon missing')
    assert.ok(maskable512, '512x512 maskable icon missing')
    assert.equal(maskable512.sizes, '512x512')
    assert.equal(any192.type, 'image/png')
  })

  test('every icon src referenced in the manifest actually exists on disk', () => {
    for (const icon of manifest.icons) {
      assert.ok(existsSync(rootPath(`public${icon.src}`)), `missing icon file: ${icon.src}`)
    }
  })
})

describe('B — index.html PWA metadata', () => {
  const html = readRoot('index.html')

  test('links the manifest', () => {
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/)
  })

  test('theme-color meta matches the manifest value', () => {
    assert.match(html, /<meta name="theme-color" content="#1e5eab" \/>/)
  })

  test('favicon and apple-touch-icon links are present', () => {
    assert.match(html, /<link rel="icon" type="image\/x-icon" href="\/favicon\.ico" \/>/)
    assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/)
  })

  test('the pre-existing anti-flash theme script is untouched by this phase', () => {
    assert.match(html, /Phase G4 anti-flash/)
    assert.match(html, /var KEY = 'mr_theme';/)
  })

  test('all favicon/icon/apple-touch-icon files referenced from index.html exist on disk', () => {
    const hrefs = [...html.matchAll(/href="(\/[^"]+\.(?:ico|png|webmanifest))"/g)].map((m) => m[1])
    assert.ok(hrefs.length >= 4, 'expected at least manifest + favicon.ico + 2 png icon links')
    for (const href of hrefs) {
      assert.ok(existsSync(rootPath(`public${href}`)), `missing referenced file: ${href}`)
    }
  })
})

describe('C — service worker: installability signal only, zero business-data caching', () => {
  const sw = readRoot('public/sw.js')

  test('registers a fetch event listener (required for the install icon/prompt per current Chromium evidence)', () => {
    assert.match(sw, /addEventListener\('fetch',/)
  })

  test('the fetch handler is a pure network passthrough — respondWith(fetch(...)), no caches.match fallback', () => {
    const fetchHandlerMatch = sw.match(/addEventListener\('fetch',[^]*?\}\)/)
    assert.ok(fetchHandlerMatch, 'fetch handler body not found')
    assert.match(fetchHandlerMatch[0], /respondWith\(fetch\(event\.request\)\)/)
  })

  test('REGRESSION GUARDRAIL: no caching API is used anywhere in the service worker', () => {
    // Strip // line comments first so this file's own doc comments (which deliberately warn future
    // editors not to add Workbox/caching here) are never mistaken for actual usage.
    const codeOnly = sw
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n')
    assert.doesNotMatch(codeOnly, /caches\.open/)
    assert.doesNotMatch(codeOnly, /caches\.match/)
    assert.doesNotMatch(codeOnly, /cache\.put/)
    assert.doesNotMatch(codeOnly, /cache\.add/)
    assert.doesNotMatch(codeOnly, /workbox/i)
    assert.doesNotMatch(codeOnly, /importScripts/)
  })

  test('REGRESSION GUARDRAIL: no reference to the backend API host or /api/ path exists in the service worker (nothing is ever specifically targeted for caching)', () => {
    assert.doesNotMatch(sw, /onrender\.com/)
    assert.doesNotMatch(sw, /\/api\//)
  })
})

describe('D — service worker registration: production-only, non-blocking', () => {
  const src = readRoot('src/registerServiceWorker.js')

  test('registration is guarded behind import.meta.env.PROD — never runs against the Vite dev server', () => {
    assert.match(src, /if \(!import\.meta\.env\.PROD\) return/)
  })

  test('registers exactly "/sw.js"', () => {
    assert.match(src, /navigator\.serviceWorker\.register\('\/sw\.js'\)/)
  })

  test('a registration failure is swallowed, never thrown — installability is a progressive enhancement, must never break the app', () => {
    assert.match(src, /\.catch\(/)
  })

  test('main.jsx calls registerServiceWorker() after rendering the app', () => {
    const main = readRoot('src/main.jsx')
    assert.match(main, /import \{ registerServiceWorker \} from '\.\/registerServiceWorker\.js'/)
    assert.match(main, /registerServiceWorker\(\)/)
  })
})

describe('E — no new runtime dependency was introduced for this phase', () => {
  test('package.json dependencies/devDependencies are unchanged from the approved baseline (no vite-plugin-pwa/workbox added)', () => {
    const pkg = JSON.parse(readRoot('package.json'))
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    assert.ok(!('vite-plugin-pwa' in allDeps), 'vite-plugin-pwa should not be a dependency for this minimal-risk implementation')
    assert.ok(!Object.keys(allDeps).some((d) => /workbox/i.test(d)), 'no workbox package should be a dependency')
  })
})
