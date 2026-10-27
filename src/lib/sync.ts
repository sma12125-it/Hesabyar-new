import { getSupabaseSettings } from './supabaseClient'

export interface CloudSession {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  userId: string
  email: string
}

export interface CloudSnapshot<T> {
  updatedAt: number
  data: T
}

const SESSION_KEY = 'hy-cloud-session'

export function supabaseConfig(): { url: string; key: string } {
  const settings = getSupabaseSettings()
  return { url: settings.url, key: settings.anonKey }
}

export function loadSession(): CloudSession | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CloudSession
    if (!parsed?.accessToken || !parsed.userId || parsed.accessToken === 'server_cloud_sync_token') return null
    return parsed
  } catch {
    return null
  }
}

export function saveSession(session: CloudSession | null) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  if (!session) localStorage.removeItem(SESSION_KEY)
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event('hy-cloud-session'))
}

const listeners = new Set<() => void>()
let mute = 0

export function onLocalChange(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyLocalChange() {
  if (mute > 0) return
  localStorage.setItem('hy-cloud-dirty', '1')
  listeners.forEach((listener) => listener())
}

export async function withoutSync<T>(run: () => Promise<T>): Promise<T> {
  mute += 1
  try {
    return await run()
  } finally {
    mute -= 1
  }
}

export function cloudDirty() {
  return localStorage.getItem('hy-cloud-dirty') === '1'
}

export function clearCloudDirty() {
  localStorage.removeItem('hy-cloud-dirty')
}

export function notifyUser(message: string) {
  window.dispatchEvent(new CustomEvent('hy-notice', { detail: { message } }))
}

export async function ensureSession(): Promise<CloudSession | null> {
  const session = loadSession()
  if (!session) return null

  if (session.refreshToken && session.expiresAt && session.expiresAt * 1000 - Date.now() > 60_000) {
    return session
  }

  if (!session.refreshToken) return session
  return (await refreshWithToken(session)) ?? session
}

/** Ask Supabase for a new access token even when the stored one has not expired yet. */
export async function refreshSessionNow(): Promise<CloudSession | null> {
  const session = loadSession()
  if (!session) return null
  if (!session.refreshToken) return session
  return (await refreshWithToken(session)) ?? session
}

async function refreshWithToken(session: CloudSession): Promise<CloudSession | null> {
  const cfg = supabaseConfig()
  try {
    const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    })
    const json = await readJson(res)
    const accessToken = typeof json.access_token === 'string' ? json.access_token : ''
    if (res.ok && accessToken) {
      const next: CloudSession = {
        ...session,
        accessToken,
        refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : session.refreshToken,
        expiresAt: expiryFrom(json, session.expiresAt),
      }
      saveSession(next)
      return next
    }
  } catch {
    // Keep this account. A failed refresh must not sign in as someone else.
  }
  return null
}

/** Revoke this device's Supabase session. Local scope leaves the account's other devices signed in. */
export async function signOutCloud(scope: 'local' | 'global' = 'local'): Promise<void> {
  const session = loadSession()
  const cfg = supabaseConfig()
  const token = session?.accessToken
  if (token) {
    try {
      await fetch(`${cfg.url}/auth/v1/logout?scope=${scope}`, {
        method: 'POST',
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    } catch {
      // Offline sign-out still clears this device.
    }
  }
  try {
    const { getSupabaseClient } = await import('./supabaseClient')
    await getSupabaseClient().auth.signOut({ scope })
  } catch {
    // The stored client session is removed below even if the call fails.
  }
  clearSupabaseAuthStorage()
}

function clearSupabaseAuthStorage() {
  if (typeof localStorage === 'undefined') return
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key && key.startsWith('sb-') && key.includes('auth')) keys.push(key)
  }
  for (const key of keys) localStorage.removeItem(key)
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error('پاسخ ابر نامعتبر بود')
  }
}

async function authRequest(path: string, body: unknown): Promise<CloudSession> {
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}${path}`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  const accessToken = typeof json.access_token === 'string' ? json.access_token : ''
  const user = json.user as { id?: string; email?: string } | undefined
  if (!res.ok || !accessToken || !user?.id) {
    const message = json.error_description || json.msg || json.error || json.message
    throw new Error(typeof message === 'string' ? persianAuthError(message) : 'ورود به ابر ناموفق بود')
  }
  return {
    accessToken,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    expiresAt: expiryFrom(json),
    userId: user.id,
    email: user.email ?? '',
  }
}

function expiryFrom(json: Record<string, unknown>, fallback?: number) {
  if (typeof json.expires_at === 'number') return json.expires_at
  if (typeof json.expires_in === 'number') return Math.floor(Date.now() / 1000) + json.expires_in
  return fallback
}

export function signUp(email: string, password: string) {
  return authRequest('/auth/v1/signup', { email, password })
}

export function signIn(email: string, password: string) {
  return authRequest('/auth/v1/token?grant_type=password', { email, password })
}

function persianAuthError(message: string) {
  const text = message.toLowerCase()
  if (text.includes('already registered') || text.includes('already been registered')) return 'این ایمیل قبلاً ثبت شده است'
  if (text.includes('invalid login') || text.includes('invalid credentials')) return 'ایمیل یا رمز نادرست است'
  if (text.includes('password')) return 'رمز پذیرفته نشد. حداقل ۶ حرف وارد کنید'
  if (text.includes('unable to validate email')) return 'ایمیل نامعتبر است'
  return message
}

export async function requestPasswordReset(email: string) {
  const cfg = supabaseConfig()
  const redirect = 'https://sma12125-it.github.io/hesabyar/'
  const res = await fetch(`${cfg.url}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, redirect_to: redirect }),
  })
  if (!res.ok) {
    const json = await readJson(res)
    const message = json.error_description || json.msg || json.message
    throw new Error(typeof message === 'string' ? persianAuthError(message) : 'ارسال ایمیل بازیابی ناموفق بود')
  }
}

let recoveryPeek: { accessToken: string; refreshToken?: string; error?: string } | null | undefined

export function takeRecoveryFromUrl(): { accessToken: string; refreshToken?: string; error?: string } | null {
  if (recoveryPeek !== undefined) return recoveryPeek
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const accessToken = hash.get('access_token') || ''
  const type = hash.get('type') || query.get('type')
  const error = hash.get('error_description') || query.get('error_description') || ''
  if (type === 'recovery' && accessToken) {
    recoveryPeek = { accessToken, refreshToken: hash.get('refresh_token') || undefined }
    return recoveryPeek
  }
  if (error) {
    recoveryPeek = { accessToken: '', error }
    return recoveryPeek
  }
  recoveryPeek = null
  return null
}

export function clearRecoveryFromUrl() {
  if (!window.location.hash.includes('access_token')) return
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

export async function userFromToken(accessToken: string): Promise<{ id: string; email: string }> {
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${accessToken}` },
  })
  const json = await readJson(res)
  const id = typeof json.id === 'string' ? json.id : ''
  const email = typeof json.email === 'string' ? json.email : ''
  if (!res.ok || !id) throw new Error('نشست بازیابی نامعتبر است')
  return { id, email }
}

export async function updatePassword(accessToken: string, password: string) {
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: cfg.key, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const json = await readJson(res)
    const message = json.error_description || json.msg || json.message
    throw new Error(typeof message === 'string' ? persianAuthError(message) : 'تغییر رمز ناموفق بود')
  }
}

async function rpc(name: string, body: unknown, accessToken?: string) {
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${accessToken || cfg.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const json = await readJson(res).catch(() => ({} as Record<string, unknown>))
    const message = json.message || json.error_description || json.msg
    throw new Error(typeof message === 'string' ? message : 'بازیابی ناموفق بود')
  }
}

export function saveRecoveryCode(session: CloudSession, code: string) {
  return rpc('set_recovery_code', { p_code: code }, session.accessToken)
}

export function recoverWithCode(email: string, code: string, password: string) {
  return rpc('recover_with_code', { p_email: email, p_code: code, p_password: password })
}

export class SnapshotConflictError extends Error {
  constructor() {
    super('نسخهٔ ابر هم‌زمان تغییر کرد')
    this.name = 'SnapshotConflictError'
  }
}

/** Remembers whether the optional `push_snapshot` RPC is installed (see supabase/migrations). */
let rpcAvailable: boolean | null = null

/**
 * Push a merged snapshot. Returns the version (ms) the cloud now holds, using the
 * server's `updated_at` when it gives one back, so devices do not depend on their own clocks.
 *
 * `baseVersion` is the cloud version the merge was built on. When the optional SQL
 * function is installed the server rejects the write if someone pushed in between
 * (SnapshotConflictError) and the caller pulls, merges, and tries again.
 */
export async function pushSnapshot<T>(
  session: CloudSession,
  snapshot: CloudSnapshot<T>,
  baseVersion?: number | null,
): Promise<number> {
  let serverSyncOk = false
  let version = snapshot.updatedAt

  // 1. App server copy (per authenticated user).
  try {
    const sRes = await fetch('/api/v1/sync/snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ updatedAt: snapshot.updatedAt, data: snapshot.data }),
    })
    if (sRes.ok) serverSyncOk = true
  } catch {
    // app server unreachable
  }

  // 2. Supabase.
  const cfg = supabaseConfig()
  const headers = {
    apikey: cfg.key,
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  }
  try {
    if (rpcAvailable !== false) {
      const rpcRes = await fetch(`${cfg.url}/rest/v1/rpc/push_snapshot`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_payload: snapshot.data,
          p_base: baseVersion ? new Date(baseVersion).toISOString() : null,
        }),
      })
      if (rpcRes.ok) {
        rpcAvailable = true
        const result = (await rpcRes.json()) as { ok?: boolean; updated_at?: string } | Array<{ ok?: boolean; updated_at?: string }>
        const row = Array.isArray(result) ? result[0] : result
        if (row && row.ok === false) throw new SnapshotConflictError()
        const serverTime = row?.updated_at ? Date.parse(row.updated_at) : NaN
        return Number.isFinite(serverTime) ? serverTime : version
      }
      if (rpcRes.status === 404 || rpcRes.status === 400) rpcAvailable = false
    }

    let res = await fetch(`${cfg.url}/rest/v1/snapshots?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        user_id: session.userId,
        updated_at: new Date(snapshot.updatedAt).toISOString(),
        payload: snapshot.data,
      }),
    })
    if (!res.ok && res.status !== 401) {
      const patchRes = await fetch(`${cfg.url}/rest/v1/snapshots?user_id=eq.${session.userId}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          updated_at: new Date(snapshot.updatedAt).toISOString(),
          payload: snapshot.data,
        }),
      })
      if (patchRes.ok) res = patchRes
    }
    if (res.ok) {
      try {
        const rows = (await res.json()) as Array<{ updated_at?: string }>
        const serverTime = rows?.[0]?.updated_at ? Date.parse(rows[0].updated_at) : NaN
        if (Number.isFinite(serverTime)) version = serverTime
      } catch {
        // no body
      }
      return version
    }
  } catch (err) {
    if (err instanceof SnapshotConflictError) throw err
    // Supabase unreachable
  }

  if (serverSyncOk) return version
  throw new Error('ارسال به ابر ناموفق بود')
}

/**
 * Read the cloud copy. When both the app server and Supabase hold one, they are merged
 * row by row instead of picking one by clock, so neither can hide rows of the other.
 */
export async function pullSnapshot<T>(session: CloudSession): Promise<CloudSnapshot<T> | null> {
  let serverSnapshot: CloudSnapshot<T> | null = null

  try {
    const sRes = await fetch('/api/v1/sync/snapshot', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    if (sRes.ok) {
      const json = await sRes.json()
      if (json.success && json.data) {
        serverSnapshot = { updatedAt: Number(json.updatedAt) || 0, data: json.data as T }
      }
    }
  } catch {
    // app server unreachable
  }

  const cfg = supabaseConfig()
  let supabaseSnapshot: CloudSnapshot<T> | null = null
  let supabaseFailed = false
  try {
    const res = await fetch(`${cfg.url}/rest/v1/snapshots?user_id=eq.${session.userId}&select=updated_at,payload`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${session.accessToken}` },
    })
    if (res.ok) {
      const rows = (await res.json()) as Array<{ updated_at: string; payload: T }>
      const row = rows[0]
      if (row && row.payload) supabaseSnapshot = { updatedAt: Date.parse(row.updated_at) || 0, data: row.payload }
    } else supabaseFailed = true
  } catch {
    supabaseFailed = true
  }

  if (serverSnapshot && supabaseSnapshot) {
    const { mergePayload } = await import('./syncMerge')
    const { merged } = mergePayload(
      supabaseSnapshot.data as unknown as Record<string, unknown>,
      serverSnapshot.data as unknown as Record<string, unknown>,
    )
    // The Supabase version is the one conflict checks run against.
    return { updatedAt: supabaseSnapshot.updatedAt, data: merged as unknown as T }
  }
  if (!serverSnapshot && !supabaseSnapshot && supabaseFailed) {
    throw new Error('دریافت از ابر ناموفق بود')
  }
  return supabaseSnapshot || serverSnapshot || null
}
