const KEY = 'hy-app-lock'
const OPEN = 'hy-app-open'

export interface AppLockRecord {
  pinSalt?: string
  pinHash?: string
  patternSalt?: string
  patternHash?: string
  credentialId?: string
  biometricEnabled?: boolean
  biometricMode?: 'native' | 'platform' | 'device'
  biometricSalt?: string
  biometricHash?: string
  biometricToken?: string
}

interface NativeBiometricBridge {
  authenticate?: (reason?: string) => boolean | Promise<boolean>
  isAvailable?: () => boolean | Promise<boolean>
}

function getNativeBiometricBridge(): NativeBiometricBridge | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    HesabyarBiometric?: NativeBiometricBridge
    AndroidBiometric?: NativeBiometricBridge
  }
  return w.HesabyarBiometric ?? w.AndroidBiometric ?? null
}

function bytesToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let raw = ''
  for (let i = 0; i < bytes.length; i += 1) {
    raw += String.fromCharCode(bytes[i]!)
  }
  return btoa(raw)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value)
  const buf = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i)
  }
  return out
}

function isValidRpId(hostname: string): boolean {
  if (!hostname) return false
  if (hostname === 'localhost') return true
  // Reject IPv4 / IPv6 literals — WebAuthn rpId must be a valid domain or localhost
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) return false
  return hostname.includes('.')
}

function isInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top
  } catch {
    return true
  }
}

function mapBiometricError(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  const msg = err instanceof Error ? err.message : String(err || '')
  const lower = msg.toLowerCase()

  if (
    name === 'SecurityError' ||
    lower.includes('permissions policy') ||
    lower.includes('publickey-credentials') ||
    lower.includes('iframe') ||
    lower.includes('not allowed in this document') ||
    lower.includes('cross-origin')
  ) {
    return 'مرورگر در حالت پیش‌نمایش (iframe) اجازه دسترسی به حسگر اثر انگشت/چهره را نمی‌دهد. لطفاً برنامه را در تب مستقل مرورگر باز کنید یا از پین / الگو استفاده کنید.'
  }

  if (name === 'NotAllowedError' || name === 'AbortError') {
    if (isInsideIframe()) {
      return 'درخواست حسگر بیومتریک لغو شد یا در حالت پیش‌نمایش (iframe) توسط مرورگر مسدود است. برنامه را در تب مستقل مرورگر باز کنید یا از پین / الگو استفاده کنید.'
    }
    return 'احراز هویت اثر انگشت یا تشخیص چهره توسط کاربر لغو شد یا زمان آن به پایان رسید.'
  }

  if (name === 'NotSupportedError' || name === 'InvalidStateError') {
    return 'حسگر اثر انگشت یا تشخیص چهره روی این دستگاه/مرورگر در دسترس نیست. می‌توانید از پین ۴ رقمی یا الگو استفاده کنید.'
  }

  return msg || 'احراز هویت بیومتریک با خطا مواجه شد.'
}

export function loadLock(): AppLockRecord {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as AppLockRecord
  } catch {
    return {}
  }
}

export function saveLock(record: AppLockRecord) {
  localStorage.setItem(KEY, JSON.stringify(record))
}

/**
 * True ONLY when real hardware biometric authentication (native BiometricPrompt bridge
 * or a registered device-bound platform authenticator credentialId) is active.
 * Legacy/simulated `device` mode without a real hardware credential is intentionally NOT active.
 */
export function isBiometricActive(record = loadLock()): boolean {
  if (record.biometricEnabled === false) return false
  if (record.biometricMode === 'native' && Boolean(getNativeBiometricBridge()?.authenticate)) {
    return true
  }
  return Boolean(record.credentialId)
}

export function setBiometricActive(enabled: boolean) {
  const current = loadLock()
  saveLock({
    ...current,
    biometricEnabled: enabled,
    ...(enabled
      ? {}
      : {
          credentialId: undefined,
          biometricMode: undefined,
          biometricSalt: undefined,
          biometricHash: undefined,
          biometricToken: undefined,
        }),
  })
}

export function lockEnabled(record = loadLock()): boolean {
  return Boolean(record.pinHash || record.patternHash || isBiometricActive(record))
}

export function isSessionOpen(): boolean {
  return sessionStorage.getItem(OPEN) === '1'
}

export function markSessionOpen() {
  sessionStorage.setItem(OPEN, '1')
}

export function clearLock() {
  localStorage.removeItem(KEY)
  sessionStorage.removeItem(OPEN)
}

async function digest(value: string, saltValue: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${saltValue}:${value}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(byteLength = 16): string {
  return [...crypto.getRandomValues(new Uint8Array(byteLength))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function setPin(pin: string) {
  const pinSalt = randomHex(16)
  const pinHash = await digest(pin, pinSalt)
  saveLock({ ...loadLock(), pinSalt, pinHash })
}

export function clearPin() {
  const current = loadLock()
  saveLock({ ...current, pinSalt: undefined, pinHash: undefined })
}

export async function checkPin(pin: string): Promise<boolean> {
  const record = loadLock()
  if (!record.pinHash || !record.pinSalt) return false
  return (await digest(pin, record.pinSalt)) === record.pinHash
}

export async function setPattern(pattern: string) {
  const patternSalt = randomHex(16)
  const patternHash = await digest(pattern, patternSalt)
  saveLock({ ...loadLock(), patternSalt, patternHash })
}

export function clearPattern() {
  const current = loadLock()
  saveLock({ ...current, patternSalt: undefined, patternHash: undefined })
}

export async function checkPattern(pattern: string): Promise<boolean> {
  const record = loadLock()
  if (!record.patternHash || !record.patternSalt) return false
  return (await digest(pattern, record.patternSalt)) === record.patternHash
}

/**
 * Checks whether the current browser/runtime exposes a real biometric API:
 * either native Android/WebView BiometricPrompt bridge or WebAuthn platform authenticator.
 */
export function isWebAuthnSupported(): boolean {
  if (getNativeBiometricBridge()?.authenticate) return true
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return Boolean(
    'PublicKeyCredential' in window &&
      typeof window.PublicKeyCredential !== 'undefined' &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function' &&
      typeof navigator.credentials.get === 'function',
  )
}

/**
 * Checks whether the device has an actual user-verifying hardware biometric sensor
 * (Touch ID, Face ID, Android Fingerprint/Face, Windows Hello) or native bridge.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  const bridge = getNativeBiometricBridge()
  if (bridge?.authenticate) {
    if (typeof bridge.isAvailable === 'function') {
      try {
        return Boolean(await bridge.isAvailable())
      } catch {
        return false
      }
    }
    return true
  }
  if (!isWebAuthnSupported()) return false
  try {
    const pkc = window.PublicKeyCredential as unknown as {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
    }
    if (typeof pkc?.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return Boolean(await pkc.isUserVerifyingPlatformAuthenticatorAvailable())
    }
    return false
  } catch {
    return false
  }
}

export interface BiometricResult {
  ok: boolean
  registered?: boolean
  mode?: 'native' | 'platform'
  error?: string
}

/**
 * Enrolls REAL hardware biometric authentication:
 * 1. Native Android/WebView BiometricPrompt when available.
 * 2. Device-bound, NON-DISCOVERABLE platform authenticator (residentKey: 'discouraged',
 *    requireResidentKey: false, authenticatorAttachment: 'platform', userVerification: 'required')
 *    so the OS invokes the local fingerprint/Face ID/Windows Hello sensor directly without
 *    requiring a cloud-synced Passkey.
 *
 * NEVER falls back to fake/simulated unlock without real hardware verification.
 */
export async function registerBiometric(): Promise<void> {
  const bridge = getNativeBiometricBridge()
  if (bridge?.authenticate) {
    const ok = await bridge.authenticate('تأیید اثر انگشت یا تشخیص چهره برای فعال‌سازی ورود به حساب‌یار')
    if (!ok) {
      throw new Error('احراز هویت اثر انگشت یا چهره تأیید نشد.')
    }
    saveLock({
      ...loadLock(),
      biometricEnabled: true,
      biometricMode: 'native',
      credentialId: undefined,
      biometricSalt: undefined,
      biometricHash: undefined,
      biometricToken: undefined,
    })
    return
  }

  if (!isWebAuthnSupported()) {
    throw new Error('مرورگر این دستگاه از احراز هویت بیومتریک (اثر انگشت / چهره) پشتیبانی نمی‌کند. لطفاً از پین سریع یا الگو استفاده کنید.')
  }

  const available = await isPlatformAuthenticatorAvailable()
  if (!available) {
    throw new Error('حسگر اثر انگشت، تشخیص چهره یا قفل بیومتریک روی این دستگاه فعال نیست. ابتدا قفل اثر انگشت/چهره گوشی را فعال کنید یا از پین سریع استفاده کنید.')
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const userId = crypto.getRandomValues(new Uint8Array(16))
    const hostname = typeof window !== 'undefined' ? window.location?.hostname || '' : ''

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'حساب‌یار',
          ...(isValidRpId(hostname) ? { id: hostname } : {}),
        },
        user: {
          id: userId,
          name: 'hesabyar-device-user',
          displayName: 'کاربر حساب‌یار',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'discouraged',
          requireResidentKey: false,
          userVerification: 'required',
        },
        attestation: 'none',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    if (!credential || !credential.rawId || credential.rawId.byteLength === 0) {
      throw new Error('ثبت حسگر اثر انگشت/چهره تکمیل نشد.')
    }

    saveLock({
      ...loadLock(),
      credentialId: bytesToBase64(credential.rawId),
      biometricEnabled: true,
      biometricMode: 'platform',
      biometricSalt: undefined,
      biometricHash: undefined,
      biometricToken: undefined,
    })
  } catch (err) {
    throw new Error(mapBiometricError(err))
  }
}

/**
 * Performs REAL hardware biometric verification (fingerprint / Face ID / Windows Hello).
 * NEVER succeeds without actual OS/hardware user verification.
 */
export async function authenticateWithBiometrics(options?: {
  allowRegistration?: boolean
}): Promise<BiometricResult> {
  const record = loadLock()
  const bridge = getNativeBiometricBridge()

  // 1. Native hardware biometric bridge (Android APK / WebView)
  if (bridge?.authenticate) {
    try {
      const approved = await bridge.authenticate('تأیید اثر انگشت یا چهره برای ورود به حساب‌یار')
      if (!approved) {
        return { ok: false, error: 'احراز هویت اثر انگشت یا چهره لغو شد.' }
      }
      if (record.biometricMode !== 'native' || !record.biometricEnabled) {
        saveLock({
          ...record,
          biometricEnabled: true,
          biometricMode: 'native',
          credentialId: undefined,
          biometricSalt: undefined,
          biometricHash: undefined,
          biometricToken: undefined,
        })
        return { ok: true, registered: true, mode: 'native' }
      }
      return { ok: true, mode: 'native' }
    } catch (err) {
      return { ok: false, error: mapBiometricError(err) }
    }
  }

  // 2. Real hardware platform authenticator (WebAuthn local device biometric)
  if (!isWebAuthnSupported()) {
    return {
      ok: false,
      error: 'مرورگر این دستگاه از احراز هویت بیومتریک پشتیبانی نمی‌کند. لطفاً با رمز حساب، پین یا الگو وارد شوید.',
    }
  }

  // If not yet enrolled with a real hardware credential
  if (!record.credentialId) {
    if (options?.allowRegistration) {
      try {
        await registerBiometric()
        return { ok: true, registered: true, mode: 'platform' }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'ثبت بیومتریک ناموفق بود.' }
      }
    }
    return {
      ok: false,
      error: 'ورود با اثر انگشت یا چهره هنوز روی این دستگاه ثبت نشده است. لطفاً ابتدا از تنظیمات امنیت آن را فعال کنید.',
    }
  }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const hostname = typeof window !== 'undefined' ? window.location?.hostname || '' : ''
    const credIdBytes = base64ToBytes(record.credentialId)

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        ...(isValidRpId(hostname) ? { rpId: hostname } : {}),
        allowCredentials: [
          {
            id: credIdBytes,
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential | null

    if (!assertion) {
      return { ok: false, error: 'احراز هویت اثر انگشت یا چهره تأیید نشد.' }
    }

    // When AuthenticatorAssertionResponse provides authenticatorData, verify User Verified (UV) flag (bit 2 = 0x04)
    const resp = assertion.response as AuthenticatorAssertionResponse | undefined
    if (resp?.authenticatorData && resp.authenticatorData.byteLength >= 33) {
      const flags = new Uint8Array(resp.authenticatorData)[32]!
      const userVerified = (flags & 0x04) !== 0
      if (!userVerified) {
        return { ok: false, error: 'تأیید اثر انگشت یا چهره توسط دستگاه انجام نشد.' }
      }
    }

    return { ok: true, mode: 'platform' }
  } catch (err) {
    return { ok: false, error: mapBiometricError(err) }
  }
}

export async function verifyBiometric(): Promise<boolean> {
  const result = await authenticateWithBiometrics({ allowRegistration: false })
  return result.ok
}
