import * as db from '../db/db'
import { unwrapText, wrapText } from './vault'

export interface VaultBiometricRecord {
  secret: string
  wrappedPhrase: string
  updatedAt: number
}

const KV_KEY = 'cardVaultBio'
const memFallback = new Map<string, VaultBiometricRecord | null>()

function randomSecretHex(bytesLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength))
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

async function readRecord(): Promise<VaultBiometricRecord | null> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const rec = await db.getKv<VaultBiometricRecord | null>(KV_KEY)
      return rec ?? null
    }
  } catch {
    /* fallback below */
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(KV_KEY)
      if (raw) return JSON.parse(raw) as VaultBiometricRecord
    } catch {
      /* ignore */
    }
  }
  return memFallback.get(KV_KEY) ?? null
}

async function writeRecord(record: VaultBiometricRecord | null): Promise<void> {
  try {
    if (typeof indexedDB !== 'undefined') {
      await db.setKv(KV_KEY, record)
      return
    }
  } catch {
    /* fallback below */
  }
  if (typeof localStorage !== 'undefined') {
    try {
      if (record === null) {
        localStorage.removeItem(KV_KEY)
      } else {
        localStorage.setItem(KV_KEY, JSON.stringify(record))
      }
    } catch {
      /* ignore */
    }
  }
  memFallback.set(KV_KEY, record)
}

/**
 * Checks whether biometric unlock for the card vault is configured on this device.
 */
export async function hasVaultBiometric(): Promise<boolean> {
  const rec = await readRecord()
  return Boolean(rec && rec.secret && rec.wrappedPhrase)
}

/**
 * Wraps the vault passphrase with a freshly generated 256-bit device-local key
 * and stores it locally (never included in cloud sync backups).
 */
export async function saveVaultBiometricPhrase(phrase: string): Promise<void> {
  const trimmed = phrase.trim()
  if (!trimmed) throw new Error('رمز گاوصندوق خالی است')
  const secret = randomSecretHex(32)
  const wrappedPhrase = await wrapText(trimmed, secret)
  await writeRecord({
    secret,
    wrappedPhrase,
    updatedAt: Date.now(),
  })
}

/**
 * Unwraps the stored vault passphrase after biometric authentication has succeeded.
 */
export async function unwrapVaultBiometricPhrase(): Promise<string> {
  const rec = await readRecord()
  if (!rec || !rec.secret || !rec.wrappedPhrase) {
    throw new Error('بازگشایی بیومتریک برای گاوصندوق هنوز فعال نشده است')
  }
  return unwrapText(rec.wrappedPhrase, rec.secret)
}

/**
 * Clears the device-local biometric vault wrap material.
 */
export async function clearVaultBiometric(): Promise<void> {
  await writeRecord(null)
}
