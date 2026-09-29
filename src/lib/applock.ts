const KEY = 'hy-app-lock'
const OPEN = 'hy-app-open'

export interface AppLockRecord {
  pinSalt?: string
  pinHash?: string
  patternSalt?: string
  patternHash?: string
  credentialId?: string
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

export function lockEnabled(record = loadLock()): boolean {
  return Boolean(record.pinHash || record.patternHash || record.credentialId)
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

function randomChallenge(): BufferSource {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export async function registerBiometric(): Promise<void> {
  if (!window.PublicKeyCredential) throw new Error('این گوشی قفل اثر انگشت یا چهره ندارد')
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'حساب‌یار' },
      user: { id: randomChallenge(), name: 'hesabyar', displayName: 'حساب‌یار' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('ثبت بیومتریک لغو شد')
  const raw = new Uint8Array(credential.rawId)
  let binary = ''
  for (const byte of raw) binary += String.fromCharCode(byte)
  saveLock({ ...loadLock(), credentialId: btoa(binary) })
}

export async function verifyBiometric(): Promise<boolean> {
  const record = loadLock()
  if (!record.credentialId) return false
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ type: 'public-key', id: Uint8Array.from(atob(record.credentialId), (c) => c.charCodeAt(0)).buffer as ArrayBuffer }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })
  return Boolean(credential)
}
