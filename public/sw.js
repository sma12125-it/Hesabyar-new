const CACHE = 'hesabyar-v4'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function isIndexPath(url) {
  const path = url.pathname
  return path.endsWith('/index.html') || path.endsWith('/')
}

function isDocumentRequest(request) {
  if (request.mode === 'navigate') return true
  try {
    return isIndexPath(new URL(request.url))
  } catch {
    return false
  }
}

async function cachedIndex() {
  const cache = await caches.open(CACHE)
  const scope = self.registration.scope
  return (await cache.match(scope)) || (await cache.match(new URL('index.html', scope).href)) || null
}

async function storeOk(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return
  try {
    const cache = await caches.open(CACHE)
    await cache.put(new Request(request.url), response.clone())
  } catch {
    // Ignore quota and opaque-response failures.
  }
}

async function networkFirst(request) {
  const documentRequest = isDocumentRequest(request)
  try {
    const fresh = await fetch(request, documentRequest ? { cache: 'reload' } : undefined)
    if (fresh && fresh.ok) {
      await storeOk(request, fresh)
      return fresh
    }
    const cached = (await caches.match(request)) || (documentRequest ? await cachedIndex() : null)
    if (cached) return cached
    return fresh
  } catch (err) {
    const cached = (await caches.match(request)) || (documentRequest ? await cachedIndex() : null)
    if (cached) return cached
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
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
  if (url.origin !== self.location.origin) return
  event.respondWith(networkFirst(request))
})
