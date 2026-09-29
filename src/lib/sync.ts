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

const CLOUD_URL = 'https://yiluruldxtgfuxqwosri.supabase.co'
const CLOUD_KEY = 'sb_publishable_tHV7NoCAC-3czs4yMG1Z7Q_bg05S1MI'

export function supabaseConfig(): { url: string; key: string } {
  return { url: CLOUD_URL, key: CLOUD_KEY }
}

export function loadSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as CloudSession) : null
  } catch {
    return null
  }
}

export function saveSession(session: CloudSession | null) {
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
  if (session.refreshToken && session.expiresAt && session.expiresAt * 1000 - Date.now() > 60_000) return session
  if (!session.refreshToken) return session
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  })
  const json = await readJson(res)
  const accessToken = typeof json.access_token === 'string' ? json.access_token : ''
  if (!res.ok || !accessToken) {
    saveSession(null)
    throw new Error('نشست ابری تمام شد. دوباره از تنظیمات وارد شوید')
  }
  const next: CloudSession = {
    ...session,
    accessToken,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : session.refreshToken,
    expiresAt: expiryFrom(json, session.expiresAt),
  }
  saveSession(next)
  return next
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

export async function pushSnapshot<T>(session: CloudSession, snapshot: CloudSnapshot<T>): Promise<void> {
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}/rest/v1/snapshots`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ user_id: session.userId, updated_at: new Date(snapshot.updatedAt).toISOString(), payload: snapshot.data }),
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 401) {
      saveSession(null)
      throw new Error('نشست ابری تمام شد. دوباره از تنظیمات وارد شوید')
    }
    throw new Error(text.replace(/<[^>]+>/g, '').slice(0, 160) || 'ارسال به ابر ناموفق بود')
  }
}

export async function pullSnapshot<T>(session: CloudSession): Promise<CloudSnapshot<T> | null> {
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}/rest/v1/snapshots?user_id=eq.${session.userId}&select=updated_at,payload`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${session.accessToken}` },
  })
  if (!res.ok) {
    if (res.status === 401) {
      saveSession(null)
      throw new Error('نشست ابری تمام شد. دوباره از تنظیمات وارد شوید')
    }
    throw new Error('دریافت از ابر ناموفق بود')
  }
  const rows = (await res.json()) as Array<{ updated_at: string; payload: T }>
  const row = rows[0]
  if (!row) return null
  return { updatedAt: Date.parse(row.updated_at), data: row.payload }
}
