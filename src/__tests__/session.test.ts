import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureSession, loadSession, saveSession, signOutCloud } from '../lib/sync'

vi.mock('../lib/supabaseClient', () => ({
  getSupabaseClient: () => ({ auth: { signOut: async () => ({ error: null }) } }),
  getSupabaseSettings: () => ({ url: 'https://example.supabase.co', anonKey: 'anon', isCustom: false }),
}))

function installBrowser() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  const sessionStore = new Map<string, string>()
  const sessionStorage = {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      sessionStore.set(key, value)
    },
    removeItem: (key: string) => {
      sessionStore.delete(key)
    },
  }
  Object.assign(globalThis, {
    localStorage,
    sessionStorage,
    window: { localStorage, sessionStorage, dispatchEvent: () => true },
  })
  return { store }
}

describe('account session', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stays signed out until an account is stored', () => {
    installBrowser()
    expect(loadSession()).toBeNull()
    saveSession({
      accessToken: 'token-a',
      userId: 'user-a',
      email: 'a@example.com',
    })
    expect(loadSession()?.email).toBe('a@example.com')
    saveSession(null)
    expect(loadSession()).toBeNull()
  })

  it('ignores the old shared placeholder session', () => {
    const { store } = installBrowser()
    store.set(
      'hy-cloud-session',
      JSON.stringify({
        accessToken: 'server_cloud_sync_token',
        userId: 'hesabyar_main_user',
        email: 'SMA12125@gmail.com',
      }),
    )
    expect(loadSession()).toBeNull()
  })

  it('does not sign a signed-out browser into a shared account', async () => {
    installBrowser()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(ensureSession()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks Supabase to revoke this device session', async () => {
    const { store } = installBrowser()
    saveSession({
      accessToken: 'token-a',
      refreshToken: 'refresh-a',
      userId: 'user-a',
      email: 'a@example.com',
    })
    store.set('sb-project-auth-token', '{"access_token":"token-a"}')
    const fetchMock = vi.fn(async () => new Response('', { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await signOutCloud('local')

    expect(fetchMock).toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/auth/v1/logout?scope=local')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-a')
    expect(store.has('sb-project-auth-token')).toBe(false)
  })
})
