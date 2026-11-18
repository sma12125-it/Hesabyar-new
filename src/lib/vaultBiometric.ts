import * as db from '../db/db'
import { unwrapText, wrapText } from './vault'

export interface VaultBiometricRecord {
  secret: string
  wrappedPhrase: string
  updatedAt: number
  isTemporaryDeviceKey?: boolean
}

const KV_KEY = 'cardVaultBio'
const LS_MIRROR_KEY = 'hy-card-vault-bio-v1'
const memFallback = new Map<string, VaultBiometricRecord | null>()

function randomSecretHex(bytesLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength))
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

function readLocalMirror(): VaultBiometricRecord | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_MIRROR_KEY) ?? localStorage.getItem(KV_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VaultBiometricRecord
    if (parsed && parsed.secret && parsed.wrappedPhrase) return parsed
  } catch {
    /* ignore */
  }
  return null
}

function writeLocalMirror(record: VaultBiometricRecord | null): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (record === null) {
      localStorage.removeItem(LS_MIRROR_KEY)
      localStorage.removeItem(KV_KEY)
    } else {
      localStorage.setItem(LS_MIRROR_KEY, JSON.stringify(record))
    }
  } catch {
    /* ignore */
  }
}

async function readRecord(): Promise<VaultBiometricRecord | null> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const rec = await db.getKv<VaultBiometricRecord | null>(KV_KEY)
      if (rec && rec.secret && rec.wrappedPhrase) {
        writeLocalMirror(rec)
        return rec
      }
    }
  } catch {
    /* fallback below */
  }
  const mirrored = readLocalMirror()
  if (mirrored) {
    try {
      if (typeof indexedDB !== 'undefined') {
        void db.setKv(KV_KEY, mirrored)
      }
    } catch {
      /* ignore */
    }
    return mirrored
  }
  return memFallback.get(KV_KEY) ?? null
}

async function writeRecord(record: VaultBiometricRecord | null): Promise<void> {
  memFallback.set(KV_KEY, record)
  writeLocalMirror(record)
  try {
    if (typeof indexedDB !== 'undefined') {
      await db.setKv(KV_KEY, record)
    }
  } catch {
    /* mirror already updated */
  }
}

/**
 * Checks whether a device-local wrapped vault key is stored on this device.
 */
export async function hasVaultBiometric(): Promise<boolean> {
  const rec = await readRecord()
  return Boolean(rec && rec.secret && rec.wrappedPhrase)
}

/**
 * Wraps the vault passphrase with a freshly generated 256-bit device-local key
 * and stores it locally (never included in cloud sync backups).
 */
export async function saveVaultBiometricPhrase(
  phrase: string,
  options?: { isTemporaryDeviceKey?: boolean },
): Promise<void> {
  const trimmed = phrase.trim()
  if (!trimmed) throw new Error('رمز گاوصندوق خالی است')
  const secret = randomSecretHex(32)
  const wrappedPhrase = await wrapText(trimmed, secret)
  await writeRecord({
    secret,
    wrappedPhrase,
    updatedAt: Date.now(),
    isTemporaryDeviceKey: Boolean(options?.isTemporaryDeviceKey),
  })
}

/**
 * Unwraps the stored vault passphrase (used after app login or biometric auth).
 */
export async function unwrapVaultBiometricPhrase(): Promise<string> {
  const rec = await readRecord()
  if (!rec || !rec.secret || !rec.wrappedPhrase) {
    throw new Error('بازگشایی بیومتریک برای گاوصندوق هنوز فعال نشده است')
  }
  return unwrapText(rec.wrappedPhrase, rec.secret)
}

/**
 * Returns the unwrapped device-local key along with whether it was a temporary
 * device key awaiting migration to the user's real account login password.
 */
export async function getVaultDeviceKeyInfo(): Promise<{
  phrase: string
  isTemporaryDeviceKey: boolean
} | null> {
  const rec = await readRecord()
  if (!rec || !rec.secret || !rec.wrappedPhrase) return null
  try {
    const phrase = await unwrapText(rec.wrappedPhrase, rec.secret)
    return {
      phrase,
      isTemporaryDeviceKey: Boolean(rec.isTemporaryDeviceKey),
    }
  } catch {
    return null
  }
}

/**
 * Ensures a device-local vault key exists when the user signs in via biometric/pattern
 * before a password-based key has been stored on this device.
 */
export async function ensureTemporaryVaultDeviceKey(): Promise<string> {
  const existing = await getVaultDeviceKeyInfo()
  if (existing?.phrase) return existing.phrase
  const generated = randomSecretHex(24)
  await saveVaultBiometricPhrase(generated, { isTemporaryDeviceKey: true })
  return generated
}

/**
 * Clears the device-local biometric vault wrap material.
 */
export async function clearVaultBiometric(): Promise<void> {
  await writeRecord(null)
}
