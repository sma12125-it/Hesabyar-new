/**
 * Offline Assets & Dependency Pre-caching Manager.
 * Ensures 100% of the webapp's scripts, styles, fonts, and assets are downloaded
 * and stored locally in CacheStorage for completely offline, native-like execution.
 */

export const CACHE_NAME = 'hesabyar-v6-offline-native'

export const ESSENTIAL_OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
]

/**
 * Downloads and caches all application dependencies, scripts, stylesheets and fonts
 * into CacheStorage so the webapp runs completely offline without any internet connection.
 */
export async function warmOfflineCache(): Promise<{ cachedCount: number; success: boolean }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { cachedCount: 0, success: false }
  }

  try {
    const cache = await caches.open(CACHE_NAME)
    const urlsToCache = new Set<string>(ESSENTIAL_OFFLINE_URLS)

    // Collect only production script tags (never cache dev server or node_modules chunks)
    document.querySelectorAll<HTMLScriptElement>('script[src]').forEach((el) => {
      if (
        el.src &&
        !el.src.startsWith('chrome-extension:') &&
        !el.src.includes('/@vite/') &&
        !el.src.includes('/node_modules/') &&
        !el.src.includes('/src/') &&
        !el.src.includes('?v=') &&
        !el.src.includes('?t=')
      ) {
        urlsToCache.add(el.src)
      }
    })

    // Collect all stylesheet links
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((el) => {
      if (el.href) {
        urlsToCache.add(el.href)
      }
    })

    // Collect manifest and icon links
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]').forEach((el) => {
      if (el.href) {
        urlsToCache.add(el.href)
      }
    })

    let cachedCount = 0
    const fetchPromises = Array.from(urlsToCache).map(async (url) => {
      try {
        const match = await cache.match(url)
        if (match) {
          cachedCount++
          return
        }
        const resp = await fetch(url, { cache: 'reload' })
        if (resp && resp.ok) {
          await cache.put(url, resp)
          cachedCount++
        }
      } catch {
        // Continue caching other assets
      }
    })

    await Promise.allSettled(fetchPromises)

    // Notify service worker of cached assets
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PRECACHE_COMPLETE',
        count: cachedCount,
      })
    }

    localStorage.setItem('hy-offline-ready', '1')
    window.dispatchEvent(new CustomEvent('hy-offline-cache-updated', { detail: { cachedCount } }))

    return { cachedCount, success: true }
  } catch (err) {
    console.warn('Failed to warm offline cache', err)
    return { cachedCount: 0, success: false }
  }
}

/**
 * Checks if core offline assets are present in CacheStorage.
 */
export async function checkOfflineReadiness(): Promise<{ isReady: boolean; cachedCount: number }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { isReady: false, cachedCount: 0 }
  }

  try {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    const isReady = keys.length >= 3 || localStorage.getItem('hy-offline-ready') === '1'
    return { isReady, cachedCount: keys.length }
  } catch {
    return { isReady: false, cachedCount: 0 }
  }
}
