import type { BankCard } from '../types'

const text = new TextEncoder()
const decoder = new TextDecoder()

function bytesToB64(bytes: Uint8Array): string {
  let raw = ''
  for (const b of bytes) raw += String.fromCharCode(b)
  return btoa(raw)
}

function b64ToBytes(value: string): Uint8Array {
  const raw = atob(value)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', text.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  const saltBytes = new Uint8Array(salt)
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 120_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function sealCards(passphrase: string, cards: BankCard[], salt?: Uint8Array): Promise<{ salt: string; payload: string }> {
  const nextSalt = salt ?? crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(passphrase, nextSalt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, text.encode(JSON.stringify(cards))))
  const packed = new Uint8Array(iv.length + cipher.length)
  packed.set(iv, 0)
  packed.set(cipher, iv.length)
  return { salt: bytesToB64(nextSalt), payload: bytesToB64(packed) }
}

export async function wrapText(secret: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(password, salt)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, text.encode(secret)))
  const packed = new Uint8Array(salt.length + iv.length + cipher.length)
  packed.set(salt, 0)
  packed.set(iv, salt.length)
  packed.set(cipher, salt.length + iv.length)
  return bytesToB64(packed)
}

export async function unwrapText(wrapped: string, password: string): Promise<string> {
  const packed = b64ToBytes(wrapped)
  const salt = packed.slice(0, 16)
  const iv = packed.slice(16, 28)
  const cipher = packed.slice(28)
  const key = await deriveKey(password, salt)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return decoder.decode(plain)
}

export async function openCards(passphrase: string, saltB64: string, payload: string): Promise<BankCard[]> {
  const salt = b64ToBytes(saltB64)
  const packed = b64ToBytes(payload)
  const key = await deriveKey(passphrase, salt)
  const iv = packed.slice(0, 12)
  const cipher = packed.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  const parsed = JSON.parse(decoder.decode(plain)) as BankCard[]
  if (!Array.isArray(parsed)) throw new Error('دادهٔ گاوصندوق نامعتبر است')
  return parsed
}

export function maskPan(pan: string): string {
  const digits = pan.replace(/\D/g, '')
  const last = digits.slice(-4)
  return last ? `•••• ${last}` : '••••'
}

export function validateCard(input: Pick<BankCard, 'bankName' | 'holder' | 'pan' | 'expiry' | 'cvv'>): string | null {
  if (!input.bankName.trim()) return 'نام بانک الزامی است'
  if (!input.holder.trim()) return 'نام صاحب کارت الزامی است'
  const pan = input.pan.replace(/\D/g, '')
  if (pan.length !== 16) return 'شماره کارت باید ۱۶ رقم باشد'
  if (!/^\d{2}\/\d{2}$/.test(input.expiry.trim())) return 'تاریخ انقضا نامعتبر است'
  if (!/^\d{3,4}$/.test(input.cvv.trim())) return 'CVV نامعتبر است'
  return null
}
