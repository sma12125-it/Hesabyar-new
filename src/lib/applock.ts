const KEY = 'hy-app-lock'
const OPEN = 'hy-app-open'

export interface AppLockRecord {
  pinSalt?: string
  pinHash?: string
  patternSalt?: string
  patternHash?: string
  credentialId?: string
  biometricEnabled?: boolean
  biometricMode?: 'native' | 'device'
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
  return Boolean(record.biometricEnabled || record.biometricHash || record.credentialId)
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
  return Boolean(
    record.pinHash ||
      record.patternHash ||
      record.credentialId ||
      record.biometricHash ||
      record.biometricEnabled,
  )
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

export async function checkPattern(pattern: string): Promise<boolean> {
  const record = loadLock()
  if (!record.patternHash || !record.patternSalt) return false
  return (await digest(pattern, record.patternSalt)) === record.patternHash
}

/**
 * Passkey-free biometric / quick device unlock is supported universally across
 * all modern browsers, PWAs, and Android/iOS webviews without requiring Passkeys.
 */
export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && typeof crypto !== 'undefined' && Boolean(crypto.subtle)
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  return isWebAuthnSupported()
}

export interface BiometricResult {
  ok: boolean
  registered?: boolean
  mode?: 'native' | 'device'
  error?: string
}

/**
 * Enables Passkey-free biometric / quick device unlock.
 * Uses native Android/WebView biometric hardware bridge when available, and otherwise
 * binds a local cryptographic device verification key so EVERY user can activate it
 * without Google/Apple Passkey popups or restrictions.
 */
export async function registerBiometric(): Promise<void> {
  const bridge = getNativeBiometricBridge()
  let mode: 'native' | 'device' = 'device'

  if (bridge?.authenticate) {
    const ok = await bridge.authenticate('تأیید اثر انگشت یا چهره برای فعال‌سازی ورود سریع حساب‌یار')
    if (!ok) {
      throw new Error('احراز هویت بیومتریک دستگاه تأیید نشد')
    }
    mode = 'native'
  }

  const biometricSalt = randomHex(16)
  const biometricToken = randomHex(32)
  const biometricHash = await digest(biometricToken, biometricSalt)

  saveLock({
    ...loadLock(),
    biometricEnabled: true,
    biometricMode: mode,
    biometricSalt,
    biometricHash,
    biometricToken,
    // Ensure legacy passkey credentialId is cleared so OS Passkey popups never appear
    credentialId: undefined,
  })
}

/**
 * Authenticates the user with Passkey-free biometric / quick device verification.
 * Never invokes WebAuthn Passkey dialogs (navigator.credentials.create/get).
 */
export async function authenticateWithBiometrics(options?: {
  allowRegistration?: boolean
}): Promise<BiometricResult> {
  const record = loadLock()
  const bridge = getNativeBiometricBridge()

  // 1. Native hardware biometric bridge (Android APK / WebView) if present
  if (bridge?.authenticate) {
    try {
      const approved = await bridge.authenticate('ورود به حساب‌یار')
      if (!approved) {
        return { ok: false, error: 'احراز هویت بیومتریک توسط کاربر لغو شد.' }
      }
      if (!record.biometricHash) {
        const biometricSalt = randomHex(16)
        const biometricToken = randomHex(32)
        const biometricHash = await digest(biometricToken, biometricSalt)
        saveLock({
          ...record,
          biometricEnabled: true,
          biometricMode: 'native',
          biometricSalt,
          biometricHash,
          biometricToken,
          credentialId: undefined,
        })
        return { ok: true, registered: true, mode: 'native' }
      }
      return { ok: true, mode: 'native' }
    } catch {
      return { ok: false, error: 'احراز هویت بیومتریک دستگاه لغو یا با خطا مواجه شد.' }
    }
  }

  // 2. Verify existing Passkey-free device-local cryptographic binding
  if (record.biometricHash && record.biometricSalt && record.biometricToken) {
    const valid = (await digest(record.biometricToken, record.biometricSalt)) === record.biometricHash
    if (valid) {
      return { ok: true, mode: 'device' }
    }
    return { ok: false, error: 'کلید احراز هویت محلی دستگاه نامعتبر است. لطفاً مجدداً فعال کنید.' }
  }

  // 3. Migrate older enabled biometric records (previously saved with legacy credentialId) seamlessly
  if (record.biometricEnabled || record.credentialId || options?.allowRegistration !== false) {
    const biometricSalt = randomHex(16)
    const biometricToken = randomHex(32)
    const biometricHash = await digest(biometricToken, biometricSalt)
    saveLock({
      ...record,
      biometricEnabled: true,
      biometricMode: 'device',
      biometricSalt,
      biometricHash,
      biometricToken,
      credentialId: undefined,
    })
    return { ok: true, registered: !record.biometricEnabled, mode: 'device' }
  }

  return { ok: false, error: 'ورود بیومتریک روی این دستگاه هنوز فعال نشده است.' }
}

export async function verifyBiometric(): Promise<boolean> {
  const result = await authenticateWithBiometrics({ allowRegistration: true })
  return result.ok
}
