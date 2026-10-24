import { toWesternDigits } from './money'
import type { Account, BankCard, DongEvent, DongExpenseItem, DongMemberLink } from '../types'

/** Latin handle: a letter, then 2–19 letters, digits, or underscores (3–20 total). */
export const HANDLE_PATTERN = /^[a-z][a-z0-9_]{2,19}$/

const RESERVED_HANDLES = new Set(['admin', 'hesabyar', 'support', 'root', 'null', 'owner', 'system'])

const SECRET_KEYS = new Set(['cvv', 'cvv2', 'pin', 'password', 'secondpassword', 'otp', 'passphrase'])

export const MIGRATION_HINT =
  'جدول‌های پروفایل و اشتراک هنوز در Supabase ساخته نشده‌اند. فایل supabase/migrations/20261024_profiles_and_sharing.sql را در SQL Editor اجرا کنید.'

export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUrl: string
  handle: string
  displayName: string
  about: string
  updatedAt: number
}

export interface PublicHandle {
  handle: string
  displayName: string
}

export interface SharedAssetView {
  id: string
  kind: 'card' | 'account'
  localId: string
  handle: string
  displayName: string
  payload: Record<string, unknown>
  updatedAt: string
  mine: boolean
}

export function emptyProfile(): UserProfile {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatarUrl: '',
    handle: '',
    displayName: '',
    about: '',
    updatedAt: 0,
  }
}

export function normalizeHandle(raw: string): string {
  return toWesternDigits(raw).trim().replace(/^@+/, '').toLowerCase()
}

export function handleError(raw: string): string | null {
  const handle = normalizeHandle(raw)
  if (!handle) return 'شناسه را وارد کنید'
  if (!HANDLE_PATTERN.test(handle)) {
    return 'شناسه باید با حرف انگلیسی شروع شود و ۳ تا ۲۰ نویسه (حرف، عدد یا _) باشد'
  }
  if (RESERVED_HANDLES.has(handle)) return 'این شناسه قابل انتخاب نیست'
  return null
}

export function normalizePhone(raw: string): string {
  let digits = toWesternDigits(raw).replace(/\D/g, '')
  if (digits.startsWith('98') && digits.length === 12) digits = `0${digits.slice(2)}`
  return digits
}

export function phoneError(raw: string): string | null {
  const phone = normalizePhone(raw)
  if (!phone) return null
  if (!/^09\d{9}$/.test(phone)) return 'شماره موبایل را با ۰۹ و ۱۱ رقم وارد کنید'
  return null
}

export function contactEmailError(raw: string): string | null {
  const email = raw.trim()
  if (!email) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'ایمیل تماس معتبر نیست'
  return null
}

export function validateProfile(profile: UserProfile): string | null {
  const phone = phoneError(profile.phone)
  if (phone) return phone
  const email = contactEmailError(profile.email)
  if (email) return email
  if (profile.handle.trim()) {
    const handle = handleError(profile.handle)
    if (handle) return handle
  }
  return null
}

export function displayNameOf(profile: Pick<UserProfile, 'displayName' | 'firstName' | 'lastName' | 'handle'>): string {
  const chosen = profile.displayName.trim()
  if (chosen) return chosen
  const full = `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim()
  if (full) return full
  const handle = normalizeHandle(profile.handle)
  if (handle) return handle
  return 'کاربر حسابیار'
}

export function profileFromRow(row: unknown): UserProfile | null {
  if (!row || typeof row !== 'object') return null
  const rec = row as Record<string, unknown>
  const updated = typeof rec.updated_at === 'string' ? Date.parse(rec.updated_at) : Number(rec.updatedAt ?? 0)
  return {
    firstName: text(rec.first_name ?? rec.firstName),
    lastName: text(rec.last_name ?? rec.lastName),
    email: text(rec.email),
    phone: text(rec.phone),
    avatarUrl: text(rec.avatar_url ?? rec.avatarUrl),
    handle: text(rec.handle),
    displayName: text(rec.display_name ?? rec.displayName),
    about: text(rec.about),
    updatedAt: Number.isFinite(updated) ? updated : 0,
  }
}

export function profileToRow(profile: UserProfile, userId: string): Record<string, unknown> {
  const handle = normalizeHandle(profile.handle)
  return {
    user_id: userId,
    first_name: profile.firstName.trim(),
    last_name: profile.lastName.trim(),
    email: profile.email.trim(),
    phone: normalizePhone(profile.phone),
    avatar_url: profile.avatarUrl,
    handle: handle || null,
    display_name: profile.displayName.trim(),
    about: profile.about.trim(),
  }
}

/** Public lookup shape: handle and display name only. */
export function toPublicHandle(row: unknown): PublicHandle | null {
  if (!row || typeof row !== 'object') return null
  const rec = row as Record<string, unknown>
  const handle = text(rec.handle)
  if (!handle) return null
  const named = text(rec.display_name ?? rec.displayName)
  return { handle, displayName: named || handle }
}

export function stripSecrets(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const clean: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.has(key.toLowerCase())) continue
    clean[key] = item
  }
  return clean
}

export function shareableCard(card: BankCard): Record<string, unknown> {
  return stripSecrets({
    bankName: card.bankName,
    holder: card.holder,
    pan: card.pan,
    expiry: card.expiry,
    sheba: card.sheba,
    accountNumber: card.accountNumber ?? '',
    note: card.note,
  })
}

export function shareableAccount(account: Account): Record<string, unknown> {
  return {
    name: account.name,
    type: account.type,
    accountNumber: account.accountNumber ?? '',
    balance: account.balance,
  }
}

export function presentSharedAsset(row: unknown, myUserId: string): SharedAssetView | null {
  if (!row || typeof row !== 'object') return null
  const rec = row as Record<string, unknown>
  const kind = rec.kind === 'card' || rec.kind === 'account' ? rec.kind : null
  const id = text(rec.id)
  const localId = text(rec.local_id ?? rec.localId)
  const handle = text(rec.handle)
  if (!kind || !id || !localId || !handle) return null
  const ownerId = text(rec.owner_id ?? rec.ownerId)
  return {
    id,
    kind,
    localId,
    handle,
    displayName: text(rec.display_name ?? rec.displayName) || handle,
    payload: stripSecrets(rec.payload),
    updatedAt: text(rec.updated_at ?? rec.updatedAt),
    mine: Boolean(myUserId) && ownerId === myUserId,
  }
}

export function explainCloudError(status: number, body: string): string {
  const missing =
    status === 404 ||
    /PGRST202|PGRST205|42P01|42883|does not exist|schema cache|Could not find the/i.test(body)
  if (missing) return MIGRATION_HINT
  if (/JWT|PGRST301|Invalid API key/i.test(body)) {
    return 'نشست ابری معتبر نیست. از تنظیمات دوباره وارد حساب شوید.'
  }
  if (/23505|duplicate key|profiles_handle/i.test(body)) return 'این شناسه قبلاً گرفته شده'
  try {
    const json = JSON.parse(body) as { message?: string; error_description?: string }
    const message = json.message || json.error_description
    if (typeof message === 'string' && message.trim() && message.length < 200 && !/relation |function /i.test(message)) {
      return message.trim()
    }
  } catch {
    // The body was not JSON.
  }
  return 'ارتباط با ابر برقرار نشد'
}

export function isSharedDong(event: Pick<DongEvent, 'remoteId' | 'shareRole' | 'memberLinks'> | undefined): boolean {
  if (!event) return false
  return Boolean(event.remoteId || event.shareRole === 'member' || (event.memberLinks && event.memberLinks.length > 0))
}

export function isDongGuest(event: Pick<DongEvent, 'shareRole'> | undefined): boolean {
  return event?.shareRole === 'member'
}

export function stampDongExpenses(prev: DongExpenseItem[] | undefined, next: DongExpenseItem[], now: number): DongExpenseItem[] {
  const prior = new Map((prev ?? []).map((item) => [item.id, item]))
  return next.map((item) => {
    const old = prior.get(item.id)
    if (!old) return { ...item, updatedAt: item.updatedAt ?? now }
    if (expenseSig(old) === expenseSig(item)) return { ...item, updatedAt: old.updatedAt }
    return { ...item, updatedAt: now }
  })
}

export function collectDeletedExpenseIds(existing: DongEvent | undefined, expenses: DongExpenseItem[]): string[] | undefined {
  if (!existing || !isSharedDong(existing)) return undefined
  const kept = new Set(expenses.map((item) => item.id))
  const removed = existing.expenses.filter((item) => !kept.has(item.id)).map((item) => item.id)
  const ids = [...new Set([...(existing.deletedExpenseIds ?? []), ...removed])]
  return ids.length ? ids : existing.deletedExpenseIds
}

export function dongFromRemote(
  row: {
    id: string
    owner_id: string
    local_id: string
    title?: string
    payload?: Partial<DongEvent> | null
    updated_at?: string
  },
  myUserId: string,
): DongEvent {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const member = row.owner_id !== myUserId
  const remoteUpdated = row.updated_at ? Date.parse(row.updated_at) : Number.NaN
  const updatedAt = Number.isFinite(remoteUpdated) ? remoteUpdated : payload.updatedAt
  return {
    ...payload,
    id: member ? `shared_${row.id}` : row.local_id,
    title: row.title || payload.title || 'دونگ',
    date: payload.date || '',
    participants: payload.participants ?? [],
    expenses: payload.expenses ?? [],
    createdAt: payload.createdAt ?? (updatedAt || Date.now()),
    updatedAt,
    remoteId: row.id,
    shareRole: member ? 'member' : 'owner',
  }
}

/**
 * Shared events merge expense by expense so a member can add a cost
 * without wiping the owner's members, groups, or مادرخرج.
 * An event that was never shared still follows last-write-wins.
 */
export function mergeSharedDong(local: DongEvent, incoming: DongEvent): DongEvent {
  if (!isSharedDong(local) && !isSharedDong(incoming)) {
    const localTime = local.updatedAt ?? local.createdAt ?? 0
    const incomingTime = incoming.updatedAt ?? incoming.createdAt ?? 0
    return incomingTime >= localTime ? incoming : local
  }
  const structure = pickStructure(local, incoming)
  const expenses = mergeExpenses(local, incoming)
  const links = pickLinks(local, incoming)
  return {
    ...structure,
    id: local.id,
    createdAt: local.createdAt,
    expenses: expenses.expenses,
    deletedExpenseIds: expenses.deletedExpenseIds.length ? expenses.deletedExpenseIds : undefined,
    memberLinks: links,
    linksUpdatedAt: Math.max(local.linksUpdatedAt ?? 0, incoming.linksUpdatedAt ?? 0) || undefined,
    remoteId: local.remoteId || incoming.remoteId,
    shareRole: local.shareRole === 'member' || incoming.shareRole === 'member' ? 'member' : local.shareRole ?? incoming.shareRole,
    updatedAt: Math.max(local.updatedAt ?? 0, incoming.updatedAt ?? 0),
    structureUpdatedAt: structure.structureUpdatedAt ?? structure.updatedAt,
  }
}

function pickStructure(local: DongEvent, incoming: DongEvent): DongEvent {
  const localOwner = local.shareRole !== 'member'
  const incomingOwner = incoming.shareRole !== 'member'
  if (incomingOwner && !localOwner) return incoming
  if (localOwner && !incomingOwner) return local
  const localTime = local.structureUpdatedAt ?? local.updatedAt ?? 0
  const incomingTime = incoming.structureUpdatedAt ?? incoming.updatedAt ?? 0
  return incomingTime >= localTime ? incoming : local
}

function pickLinks(local: DongEvent, incoming: DongEvent): DongMemberLink[] | undefined {
  const localTime = local.linksUpdatedAt ?? 0
  const incomingTime = incoming.linksUpdatedAt ?? 0
  if (incomingTime > localTime) return incoming.memberLinks
  if (localTime > incomingTime) return local.memberLinks
  return local.memberLinks ?? incoming.memberLinks
}

function mergeExpenses(local: DongEvent, incoming: DongEvent): { expenses: DongExpenseItem[]; deletedExpenseIds: string[] } {
  const deleted = new Set([...(local.deletedExpenseIds ?? []), ...(incoming.deletedExpenseIds ?? [])])
  const map = new Map<string, DongExpenseItem>()
  const localNewer = (local.updatedAt ?? 0) >= (incoming.updatedAt ?? 0)
  const ordered = localNewer ? [local, incoming] : [incoming, local]
  for (const event of ordered) {
    for (const item of event.expenses ?? []) {
      if (!item?.id || deleted.has(item.id)) continue
      const prev = map.get(item.id)
      if (!prev || (item.updatedAt ?? 0) > (prev.updatedAt ?? 0)) map.set(item.id, item)
    }
  }
  return { expenses: [...map.values()], deletedExpenseIds: [...deleted] }
}

function expenseSig(item: DongExpenseItem): string {
  return JSON.stringify({
    title: item.title,
    amount: item.amount,
    paidById: item.paidById,
    splitAmongIds: item.splitAmongIds,
    splitMode: item.splitMode ?? 'equal',
    customShares: item.customShares ?? null,
    date: item.date ?? '',
  })
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
