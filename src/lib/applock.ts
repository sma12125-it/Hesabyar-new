const KEY = 'hy-app-lock'
const OPEN = 'hy-app-open'

export interface AppLockRecord {
  pinSalt?: string
  pinHash?: string
  patternSalt?: string
  patternHash?: string
  credentialId?: string
  biometricEnabled?: boolean
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

export function isBiometricActive(record = loadLock()): boolean {
  if (record.biometricEnabled === false) return false
  return Boolean(record.biometricEnabled || record.credentialId)
}

export function setBiometricActive(enabled: boolean) {
  const current = loadLock()
  saveLock({
    ...current,
    biometricEnabled: enabled,
    ...(enabled ? {} : { credentialId: undefined }),
  })
}

export function lockEnabled(record = loadLock()): boolean {
  return Boolean(record.pinHash || record.patternHash || record.credentialId || record.biometricEnabled)
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

async function digest(value: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${value}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function salt(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function setPin(pin: string) {
  const pinSalt = salt()
  const pinHash = await digest(pin, pinSalt)
  saveLock({ ...loadLock(), pinSalt, pinHash })
}

export async function checkPin(pin: string): Promise<boolean> {
  const record = loadLock()
  if (!record.pinHash || !record.pinSalt) return false
  return (await digest(pin, record.pinSalt)) === record.pinHash
}

export async function setPattern(pattern: string) {
  const patternSalt = salt()
  const patternHash = await digest(pattern, patternSalt)
  saveLock({ ...loadLock(), patternSalt, patternHash })
}

export async function checkPattern(pattern: string): Promise<boolean> {
  const record = loadLock()
  if (!record.patternHash || !record.patternSalt) return false
  return (await digest(pattern, record.patternSalt)) === record.patternHash
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential && navigator.credentials)
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    }
    return true
  } catch {
    return false
  }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function randomChallenge(): BufferSource {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export interface BiometricResult {
  ok: boolean
  registered?: boolean
  error?: string
}

export async function registerBiometric(): Promise<void> {
  if (!isWebAuthnSupported()) throw new Error('این مرورگر یا دستگاه از قفل اثر انگشت یا چهره پشتیبانی نمی‌کند')
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'حساب‌یار' },
      user: { id: randomChallenge(), name: 'hesabyar', displayName: 'حساب‌یار' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('ثبت بیومتریک لغو شد')
  const b64 = bufferToBase64(credential.rawId)
  saveLock({ ...loadLock(), credentialId: b64, biometricEnabled: true })
}

export async function authenticateWithBiometrics(options?: {
  allowRegistration?: boolean
}): Promise<BiometricResult> {
  if (!isWebAuthnSupported()) {
    return { ok: false, error: 'مرورگر یا دستگاه شما از احراز هویت بیومتریک (WebAuthn) پشتیبانی نمی‌کند.' }
  }

  const record = loadLock()

  // 1. If a credential is registered, prompt navigator.credentials.get
  if (record.credentialId) {
    try {
      const rawId = base64ToBuffer(record.credentialId)
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: randomChallenge(),
          allowCredentials: [
            {
              type: 'public-key',
              id: rawId,
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
          timeout: 60_000,
        },
      })
      if (credential) {
        return { ok: true }
      }
      return { ok: false, error: 'احراز هویت بیومتریک تأیید نشد.' }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string }
      if (e?.name === 'NotAllowedError') {
        return { ok: false, error: 'احراز هویت بیومتریک توسط کاربر لغو شد یا دسترسی داده نشد.' }
      }
      if (e?.name === 'SecurityError') {
        return { ok: false, error: 'احراز هویت بیومتریک در این محیط امنیتی مجاز نیست.' }
      }
      // If credential verification failed (e.g. credential removed from device), allow re-registration if requested
      if (options?.allowRegistration === false) {
        return { ok: false, error: e?.message || 'اعتبارسنجی بیومتریک با خطا مواجه شد.' }
      }
    }
  }

  // 2. If no credential exists or registration is permitted, create and register
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'حساب‌یار' },
        user: { id: randomChallenge(), name: 'hesabyar', displayName: 'حساب‌یار' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null

    if (!credential) {
      return { ok: false, error: 'ثبت بیومتریک انجام نشد.' }
    }

    const b64 = bufferToBase64(credential.rawId)
    saveLock({ ...loadLock(), credentialId: b64, biometricEnabled: true })
    return { ok: true, registered: true }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e?.name === 'NotAllowedError') {
      return { ok: false, error: 'احراز هویت بیومتریک لغو شد.' }
    }
    if (e?.name === 'SecurityError') {
      return { ok: false, error: 'احراز هویت بیومتریک در این پنجره مجاز نیست.' }
    }
    return {
      ok: false,
      error: e?.message || 'حسگر بیومتریک دستگاه در دسترس نیست. می‌توانید با رمز یا الگو وارد شوید.',
    }
  }
}

export async function verifyBiometric(): Promise<boolean> {
  const result = await authenticateWithBiometrics({ allowRegistration: true })
  return result.ok
}
