import * as db from '../db/db'
import { clearLock } from './applock'
import { clearCloudDirty, loadSession, saveSession, withoutSync } from './sync'

const VERIFIER = 'hy-account-verifier'
let rememberedPassword = ''

export function rememberAccountPassword(password: string) {
  rememberedPassword = password
}

export function rememberedAccountPassword() {
  return rememberedPassword
}

export function generateRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const raw = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('')
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

async function digest(value: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${value}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function savePasswordVerifier(email: string, password: string) {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const hash = await digest(password, salt)
  localStorage.setItem(VERIFIER, JSON.stringify({ email, salt, hash }))
  rememberAccountPassword(password)
}

export async function checkPasswordVerifier(password: string): Promise<boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(VERIFIER) || '') as { salt?: string; hash?: string }
    if (!saved.salt || !saved.hash) return false
    return (await digest(password, saved.salt)) === saved.hash
  } catch {
    return false
  }
}

export async function logoutCompletely() {
  await withoutSync(async () => {
    clearCloudDirty()
    localStorage.removeItem('hy-cloud-seen')
    localStorage.removeItem('hy-cloud-dirty')
    localStorage.removeItem(VERIFIER)
    clearLock()
    saveSession(null)
    rememberedPassword = ''
    await db.clearAllData()
  })
  window.location.reload()
}

export function hasCloudAccount() {
  return Boolean(loadSession())
}
