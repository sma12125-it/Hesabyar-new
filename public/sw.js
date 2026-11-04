/**
 * HesabYar Offline-First Native Service Worker (v5)
 * Caches all application code, styles, fonts, and assets locally on device
 * so the web application runs completely offline without network connectivity.
 */

const CACHE = 'hesabyar-v5-offline-native'

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        try {
          await cache.addAll(PRECACHE_ASSETS)
        } catch (err) {
          console.warn('[SW] Core precache partial fallback:', err)
        }
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isDocumentRequest(request) {
  if (request.mode === 'navigate') return true
  try {
    const url = new URL(request.url)
    return url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')
  } catch {
    return false
  }
}

async function cachedIndex() {
  const cache = await caches.open(CACHE)
  const scope = self.registration.scope
  return (
    (await cache.match(scope)) ||
    (await cache.match(new URL('index.html', scope).href)) ||
    (await cache.match('/')) ||
    (await cache.match('/index.html')) ||
    null
  )
}

/**
 * Cache-First with background revalidation (Stale-While-Revalidate)
 * Perfect for JS bundles, CSS, icons, and fonts for immediate offline native speed.
 */
async function cacheFirstWithRevalidate(request) {
  const cache = await caches.open(CACHE)
  const cachedResponse = await cache.match(request)

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok && networkResponse.type !== 'opaque') {
        cache.put(request, networkResponse.clone()).catch(() => {})
      }
      return networkResponse
    })
    .catch(() => null)

  return cachedResponse || (await fetchPromise)
}

/**
 * Network-First with Cache fallback for navigation & HTML document requests
 */
async function networkFirstDocument(request) {
  try {
    const fresh = await fetch(request, { cache: 'reload' })
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE)
      cache.put(request, fresh.clone()).catch(() => {})
      return fresh
    }
  } catch {
    // Offline or network error
  }

  const cached = (await caches.match(request)) || (await cachedIndex())
  if (cached) return cached

  return new Response(
    '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"/><title>حساب‌یار - حالت آفلاین</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;"><h2>حالت آفلاین</h2><p>برنامه در حافظه دستگاه موجود است. لطفاً صفحه را رفرش کنید.</p></body></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // 1. External Fonts (Google Fonts, Vazirmatn webfonts) -> Cache First
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirstWithRevalidate(request))
    return
  }

  // Allow same-origin requests only for application shell
  if (url.origin !== self.location.origin) return

  // 2. Navigation / Document requests -> Network first with cached index fallback
  if (isDocumentRequest(request)) {
    event.respondWith(networkFirstDocument(request))
    return
  }

  // 3. Static Assets: JS, CSS, fonts, images -> Cache first with revalidation
  const isStaticAsset =
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webmanifest')

  if (isStaticAsset) {
    event.respondWith(cacheFirstWithRevalidate(request))
    return
  }

  // 4. API endpoints -> Network first, offline json fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({
              success: false,
              offline: true,
              error: 'عدم دسترسی به اینترنت (حالت آفلاین فعال است)',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            },
          ),
      ),
    )
    return
  }

  // Fallback default
  event.respondWith(cacheFirstWithRevalidate(request))
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRECACHE_ALL_ASSETS' && Array.isArray(event.data.urls)) {
    caches.open(CACHE).then((cache) => {
      event.data.urls.forEach((u) => {
        fetch(u)
          .then((res) => {
            if (res && res.ok) cache.put(u, res)
          })
          .catch(() => {})
      })
    })
  }
})
