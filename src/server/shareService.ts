import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergeSharedDong } from '../lib/profile'
import type { DongEvent, ShareAssetKind } from '../types'
import { getSupabaseServerConfig } from './auth'

export type { ShareAssetKind }

export const ALLOWED_SHARE_ASSET_KINDS = new Set<ShareAssetKind>([
  'card',
  'account',
  'installment',
  'debt',
  'cheque',
])

const SECRET_DETAIL_KEYS = new Set([
  'cvv',
  'cvv2',
  'pin',
  'password',
  'secondpassword',
  'otp',
  'passphrase',
])

export interface RegisteredProfile {
  userId: string
  fullUserId?: string
  shortUserId?: string
  handle: string
  displayName: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
  email?: string
  updatedAt: number
}

export interface SharedAssetRecord {
  id: string
  assetKind: ShareAssetKind
  assetId: string
  assetName: string
  assetDetails?: Record<string, unknown>
  ownerUserId: string
  ownerDisplayName?: string
  granteeUser: {
    userId: string
    handle: string
    displayName: string
    firstName?: string
    lastName?: string
    avatarUrl?: string
    email?: string
    sharedAt?: string
    status?: 'pending' | 'accepted' | 'rejected'
  }
  status?: 'pending' | 'accepted' | 'rejected'
  acceptedAt?: string
  sharedAt: string
  updatedAt?: string
}

export interface ServerDongRecord {
  remoteId: string
  ownerAuthId: string
  authorizedUserIds: string[]
  event: DongEvent
  updatedAt: number
}

const DATA_DIR = join(process.cwd(), 'data')
const PROFILES_PATH = join(DATA_DIR, 'profiles.json')
const SHARES_PATH = join(DATA_DIR, 'shared_assets.json')
const DONG_SHARED_PATH = join(DATA_DIR, 'dong_shared.json')

function ensureDataDir(): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
  } catch {}
}

function readJsonFile<T>(path: string, fallback: T): T {
  try {
    ensureDataDir()
    if (!existsSync(path)) return fallback
    const raw = readFileSync(path, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJsonFile<T>(path: string, data: T): void {
  try {
    ensureDataDir()
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf8')
  } catch (err) {
    console.error(`Failed to write JSON file to ${path}:`, err)
  }
}

function toWesternDigits(input: string): string {
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
}

function sanitizeAvatarUrl(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback
  const trimmed = raw.trim()
  if (!trimmed) return fallback
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed.slice(0, 2048)
  }
  return fallback
}

export function stripAssetSecrets(details: unknown): Record<string, unknown> | undefined {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return undefined
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
    if (SECRET_DETAIL_KEYS.has(k.toLowerCase())) continue
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      clean[k] = stripAssetSecrets(v)
    } else if (Array.isArray(v)) {
      clean[k] = v.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? stripAssetSecrets(item) ?? {}
          : item,
      )
    } else {
      clean[k] = v
    }
  }
  return clean
}

export function parseShareAssetKind(raw: unknown): ShareAssetKind | null {
  if (typeof raw !== 'string') return null
  const clean = raw.trim().toLowerCase() as ShareAssetKind
  return ALLOWED_SHARE_ASSET_KINDS.has(clean) ? clean : null
}

// Curated high quality authentic human portrait photos for profiles
export const REAL_AVATARS: string[] = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function collectProfileIds(p: Pick<RegisteredProfile, 'userId' | 'fullUserId' | 'shortUserId'>): Set<string> {
  const ids = new Set<string>()
  for (const raw of [p.userId, p.fullUserId, p.shortUserId]) {
    const clean = (raw || '').trim().toLowerCase()
    if (!clean) continue
    ids.add(clean)
    if (UUID_RE.test(clean)) {
      ids.add(clean.slice(0, 12))
    }
  }
  return ids
}

/**
 * Register or update a user profile in persistent server storage.
 * Matches strictly by userId / fullUserId / shortUserId so different users with a
 * colliding placeholder handle never overwrite each other's rows.
 */
export function registerUserProfile(profile: {
  userId: string
  fullUserId?: string
  shortUserId?: string
  handle?: string
  displayName?: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
  email?: string
}): RegisteredProfile {
  if (!profile.userId || typeof profile.userId !== 'string') {
    throw new Error('شناسه کاربری (userId) الزامی است')
  }

  const profiles = readJsonFile<RegisteredProfile[]>(PROFILES_PATH, [])
  const cleanUserId = toWesternDigits(profile.userId).trim()
  const cleanFullId = profile.fullUserId ? toWesternDigits(profile.fullUserId).trim() : undefined
  const cleanShortId =
    profile.shortUserId
      ? toWesternDigits(profile.shortUserId).trim()
      : UUID_RE.test(cleanUserId)
        ? cleanUserId.slice(0, 12)
        : cleanFullId && UUID_RE.test(cleanFullId)
          ? cleanFullId.slice(0, 12)
          : undefined
  const cleanHandle = toWesternDigits(profile.handle || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()

  const candidateIds = new Set(
    [cleanUserId, cleanFullId, cleanShortId].filter(Boolean).map((id) => id!.toLowerCase()),
  )

  const existingIndex = profiles.findIndex((p) => {
    const pIds = collectProfileIds(p)
    for (const id of candidateIds) {
      if (pIds.has(id)) return true
    }
    return false
  })

  const existing = existingIndex >= 0 ? profiles[existingIndex] : undefined
  const fallbackAvatar = existing?.avatarUrl || REAL_AVATARS[0]

  const updated: RegisteredProfile = {
    userId: cleanUserId,
    fullUserId: cleanFullId || existing?.fullUserId,
    shortUserId: cleanShortId || existing?.shortUserId,
    handle: cleanHandle || existing?.handle || `user_${cleanUserId.slice(0, 6)}`,
    displayName:
      (profile.displayName || '').trim() ||
      `${(profile.firstName || '').trim()} ${(profile.lastName || '').trim()}`.trim() ||
      existing?.displayName ||
      'کاربر حسابیار',
    firstName:
      profile.firstName !== undefined ? profile.firstName.trim() : existing?.firstName || '',
    lastName:
      profile.lastName !== undefined ? profile.lastName.trim() : existing?.lastName || '',
    avatarUrl: sanitizeAvatarUrl(profile.avatarUrl, fallbackAvatar),
    email: profile.email ? profile.email.trim() : existing?.email,
    updatedAt: Date.now(),
  }

  if (existingIndex >= 0) {
    profiles[existingIndex] = updated
  } else {
    profiles.push(updated)
  }

  writeJsonFile(PROFILES_PATH, profiles)
  return updated
}

/**
 * Look up a real registered profile by User ID (short or full UUID), Handle, or Email.
 * Returns null if not found (strictly no fake fallback).
 */
export function lookupUserProfile(query: string): RegisteredProfile | null {
  const clean = toWesternDigits(query).trim().replace(/^@+/, '')
  if (!clean) return null
  const cleanLower = clean.toLowerCase()

  const profiles = readJsonFile<RegisteredProfile[]>(PROFILES_PATH, [])

  const match = profiles.find((p) => {
    const ids = collectProfileIds(p)
    if (ids.has(cleanLower)) return true
    if (p.handle && p.handle.trim().toLowerCase() === cleanLower) return true
    if (p.email && p.email.trim().toLowerCase() === cleanLower) return true
    return false
  })

  return match || null
}

/**
 * Look up a registered user profile locally first, then fall back to public
 * Supabase RPCs (`lookup_profile_public` -> `lookup_handle`) so users registered
 * on any device/cloud session can always be discovered by handle or User ID.
 */
export async function lookupUserProfileWithCloud(query: string): Promise<RegisteredProfile | null> {
  const local = lookupUserProfile(query)
  if (local) return local

  if (process.env.VITEST && process.env.ENABLE_CLOUD_LOOKUP_IN_TEST !== 'true') {
    return null
  }

  const clean = toWesternDigits(query).trim().replace(/^@+/, '')
  if (!clean) return null

  const { url, anonKey } = getSupabaseServerConfig()
  if (!url || !anonKey) return null

  try {
    // 1. Try extended lookup RPC (supports @handle, full UUID, 12-char User ID prefix)
    const pubRes = await fetch(`${url}/rest/v1/rpc/lookup_profile_public`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_query: clean }),
    })

    if (pubRes.ok) {
      const rows = (await pubRes.json()) as Array<{
        user_id?: string
        handle?: string
        display_name?: string
        avatar_url?: string
      }>
      const row = Array.isArray(rows) ? rows[0] : null
      if (row && (row.user_id || row.handle)) {
        const fullId = row.user_id?.trim() || ''
        const shortId = fullId ? (UUID_RE.test(fullId) ? fullId.slice(0, 12) : fullId) : clean.toLowerCase()
        return registerUserProfile({
          userId: shortId,
          fullUserId: fullId || undefined,
          shortUserId: shortId,
          handle: row.handle || `user_${shortId.slice(0, 6)}`,
          displayName: row.display_name || row.handle || 'کاربر حسابیار',
          avatarUrl: row.avatar_url || REAL_AVATARS[0],
        })
      }
    }

    // 2. Fallback to existing Supabase `lookup_handle` RPC if query is a handle
    const handleClean = clean.toLowerCase()
    if (/^[a-z][a-z0-9_]{2,19}$/.test(handleClean)) {
      const handleRes = await fetch(`${url}/rest/v1/rpc/lookup_handle`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_handle: handleClean }),
      })
      if (handleRes.ok) {
        const rows = (await handleRes.json()) as Array<{ handle?: string; display_name?: string }>
        const row = Array.isArray(rows) ? rows[0] : null
        if (row?.handle) {
          return {
            userId: row.handle,
            handle: row.handle,
            displayName: row.display_name || row.handle,
            avatarUrl: REAL_AVATARS[0],
            updatedAt: Date.now(),
          }
        }
      }
    }
  } catch {
    // Cloud lookup unavailable; fall back cleanly to null
  }

  return null
}

/**
 * Get all shared users for a specific shareable asset.
 */
export function getAssetShares(assetKind: ShareAssetKind, assetId: string): SharedAssetRecord[] {
  const cleanId = String(assetId).trim()
  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])
  return shares.filter((s) => s.assetKind === assetKind && String(s.assetId).trim() === cleanId)
}

/**
 * Share a financial asset with another user. Enforces strict maximum of 10 users per asset.
 */
export function shareAssetWithUser(input: {
  assetKind: ShareAssetKind
  assetId: string
  assetName: string
  assetDetails?: Record<string, unknown>
  ownerUserId: string
  ownerDisplayName?: string
  granteeUser: {
    userId: string
    handle: string
    displayName: string
    firstName?: string
    lastName?: string
    avatarUrl?: string
    email?: string
  }
}): { success: boolean; share: SharedAssetRecord; total: number } {
  if (!ALLOWED_SHARE_ASSET_KINDS.has(input.assetKind)) {
    throw new Error('نوع دارایی اشتراکی نامعتبر است')
  }

  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])
  const cleanAssetId = String(input.assetId).trim()
  const currentAssetShares = shares.filter(
    (s) => s.assetKind === input.assetKind && String(s.assetId).trim() === cleanAssetId,
  )

  const isExisting = currentAssetShares.some(
    (s) =>
      s.granteeUser.userId.toLowerCase() === input.granteeUser.userId.toLowerCase() ||
      s.granteeUser.handle.toLowerCase().replace(/^@+/, '') ===
        input.granteeUser.handle.toLowerCase().replace(/^@+/, ''),
  )

  if (!isExisting && currentAssetShares.length >= 10) {
    throw new Error('امکان اشتراک‌گذاری حداکثر با ۱۰ کاربر وجود دارد. سقف ظرفیت تکمیل شده است.')
  }

  const profiles = readJsonFile<RegisteredProfile[]>(PROFILES_PATH, [])
  const ownerClean = String(input.ownerUserId || '').trim().toLowerCase()
  const ownerProfile = profiles.find((p) => collectProfileIds(p).has(ownerClean))
  const rawOwnerName = (input.ownerDisplayName || '').trim()
  const resolvedOwnerName =
    (rawOwnerName && rawOwnerName !== 'مالک حساب' && rawOwnerName !== 'کاربر حسابیار'
      ? rawOwnerName
      : '') ||
    ownerProfile?.displayName?.trim() ||
    (ownerProfile?.handle ? `@${ownerProfile.handle}` : '') ||
    rawOwnerName ||
    'مالک حساب'

  const recordId = `share_${input.assetKind}_${cleanAssetId}_${input.granteeUser.userId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  const now = new Date().toISOString()

  const existingIdx = shares.findIndex((s) => s.id === recordId)
  const existingShare = existingIdx >= 0 ? shares[existingIdx] : undefined
  const preservedStatus = existingShare?.status === 'accepted' ? 'accepted' : 'pending'

  const newRecord: SharedAssetRecord = {
    id: recordId,
    assetKind: input.assetKind,
    assetId: cleanAssetId,
    assetName: input.assetName,
    assetDetails: stripAssetSecrets(input.assetDetails),
    ownerUserId: input.ownerUserId,
    ownerDisplayName: resolvedOwnerName,
    status: preservedStatus,
    acceptedAt: existingShare?.acceptedAt,
    granteeUser: {
      ...input.granteeUser,
      avatarUrl: sanitizeAvatarUrl(input.granteeUser.avatarUrl, REAL_AVATARS[0]),
      sharedAt: now,
      status: preservedStatus,
    },
    sharedAt: existingShare?.sharedAt || now,
    updatedAt: now,
  }

  if (existingIdx >= 0) {
    shares[existingIdx] = newRecord
  } else {
    shares.unshift(newRecord)
  }

  writeJsonFile(SHARES_PATH, shares)

  const updatedAssetShares = shares.filter(
    (s) => s.assetKind === input.assetKind && String(s.assetId).trim() === cleanAssetId,
  )

  return { success: true, share: newRecord, total: updatedAssetShares.length }
}

/**
 * Sync updated details/status for an existing shared asset across all recipients.
 * Only updates records owned by `ownerUserId` (if supplied).
 */
export function syncAssetShareDetails(input: {
  assetKind: ShareAssetKind
  assetId: string
  ownerUserId?: string
  assetName?: string
  assetDetails?: Record<string, unknown>
}): { success: boolean; updatedCount: number } {
  if (!ALLOWED_SHARE_ASSET_KINDS.has(input.assetKind)) {
    throw new Error('نوع دارایی اشتراکی نامعتبر است')
  }
  const cleanAssetId = String(input.assetId || '').trim()
  if (!cleanAssetId) {
    throw new Error('شناسه دارایی الزامی است')
  }

  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])
  const cleanOwner = (input.ownerUserId || '').trim().toLowerCase()
  const now = new Date().toISOString()
  let updatedCount = 0

  const nextShares = shares.map((s) => {
    if (s.assetKind !== input.assetKind || String(s.assetId).trim() !== cleanAssetId) {
      return s
    }
    if (cleanOwner) {
      const recordOwner = (s.ownerUserId || '').trim().toLowerCase()
      if (recordOwner && recordOwner !== cleanOwner) {
        return s
      }
    }
    updatedCount += 1
    return {
      ...s,
      assetName: input.assetName?.trim() || s.assetName,
      assetDetails: stripAssetSecrets(input.assetDetails) ?? s.assetDetails,
      updatedAt: now,
    }
  })

  if (updatedCount > 0) {
    writeJsonFile(SHARES_PATH, nextShares)
  }

  return { success: true, updatedCount }
}

/**
 * Revoke sharing of an asset from a user.
 */
export function revokeAssetShare(
  assetKind: ShareAssetKind,
  assetId: string,
  granteeUserId: string,
  shareId?: string,
): { success: boolean; remaining: number } {
  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])
  const cleanGrantee = toWesternDigits(String(granteeUserId)).trim().toLowerCase().replace(/^@+/, '')
  const cleanAssetId = String(assetId).trim()
  const cleanShareId = shareId ? String(shareId).trim() : ''

  const filtered = shares.filter((s) => {
    const gId = (s.granteeUser.userId || '').trim().toLowerCase()
    const gHandle = (s.granteeUser.handle || '').trim().toLowerCase().replace(/^@+/, '')
    const matchesGrantee = Boolean(
      cleanGrantee && ((gId && gId === cleanGrantee) || (gHandle && gHandle === cleanGrantee)),
    )
    if (!matchesGrantee) return true

    if (cleanShareId && s.id === cleanShareId) return false
    if (s.id === cleanAssetId) return false

    const isSameAsset = s.assetKind === assetKind && String(s.assetId).trim() === cleanAssetId
    return !isSameAsset
  })

  writeJsonFile(SHARES_PATH, filtered)
  const remaining = filtered.filter(
    (s) => s.assetKind === assetKind && String(s.assetId).trim() === cleanAssetId,
  ).length
  return { success: true, remaining }
}

/**
 * Respond to an incoming asset share (accept or reject).
 */
export function respondToAssetShare(
  shareId: string,
  action: 'accept' | 'reject',
): { success: boolean; share?: SharedAssetRecord } {
  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])
  const idx = shares.findIndex((s) => s.id === shareId)
  if (idx === -1) {
    return { success: false }
  }

  if (action === 'reject') {
    shares.splice(idx, 1)
    writeJsonFile(SHARES_PATH, shares)
    return { success: true }
  }

  const now = new Date().toISOString()
  shares[idx].status = 'accepted'
  shares[idx].acceptedAt = now
  shares[idx].updatedAt = now
  if (shares[idx].granteeUser) {
    shares[idx].granteeUser.status = 'accepted'
  }
  writeJsonFile(SHARES_PATH, shares)
  return { success: true, share: shares[idx] }
}

/**
 * Get all assets shared WITH a user (incoming shares).
 */
export function getIncomingSharesForUser(userId?: string, handle?: string): SharedAssetRecord[] {
  const cleanId = toWesternDigits(userId || '').trim().toLowerCase()
  const cleanShortId = UUID_RE.test(cleanId) ? cleanId.slice(0, 12) : undefined
  const cleanHandle = toWesternDigits(handle || '').trim().replace(/^@+/, '').toLowerCase()
  if (!cleanId && !cleanHandle) return []

  const profiles = readJsonFile<RegisteredProfile[]>(PROFILES_PATH, [])
  const matchedProfile = profiles.find((p) => {
    const ids = collectProfileIds(p)
    return (cleanId && ids.has(cleanId)) || (cleanHandle && p.handle.toLowerCase() === cleanHandle)
  })
  const allMyIds = new Set<string>(
    [
      cleanId,
      cleanShortId,
      matchedProfile?.userId.toLowerCase(),
      matchedProfile?.fullUserId?.toLowerCase(),
      matchedProfile?.shortUserId?.toLowerCase(),
    ].filter(Boolean) as string[],
  )
  const effectiveHandle = cleanHandle || matchedProfile?.handle.toLowerCase() || ''

  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])

  return shares.filter((s) => {
    const ownerId = (s.ownerUserId || '').trim().toLowerCase()
    if (ownerId && allMyIds.has(ownerId)) return false

    const g = s.granteeUser
    if (!g) return false
    const gId = (g.userId || '').trim().toLowerCase()
    const gShortId = UUID_RE.test(gId) ? gId.slice(0, 12) : undefined
    const gHandle = (g.handle || '').trim().toLowerCase().replace(/^@+/, '')

    const matchId = Boolean((gId && allMyIds.has(gId)) || (gShortId && allMyIds.has(gShortId)))
    const matchHandle = Boolean(effectiveHandle && gHandle && gHandle === effectiveHandle)
    return matchId || matchHandle
  })
}

/**
 * Authoritative companion store for shared Dong event state (especially settlements,
 * settledTransfers timestamps, and pendingApprovals) so updates converge immediately
 * across owner and all invited members.
 */
export function syncServerDongState(input: {
  remoteId: string
  authUserId: string
  isOwnerVerified?: boolean
  grantAccessForAuthUser?: boolean
  event: DongEvent
}): { success: boolean; event: DongEvent } {
  const cleanRemoteId = String(input.remoteId || '').trim()
  if (!cleanRemoteId) {
    throw new Error('شناسه رویداد اشتراکی (remoteId) الزامی است')
  }

  const records = readJsonFile<Record<string, ServerDongRecord>>(DONG_SHARED_PATH, {})
  const existing = records[cleanRemoteId]

  if (existing) {
    const isAuthorized =
      input.grantAccessForAuthUser === true ||
      existing.ownerAuthId === input.authUserId ||
      existing.authorizedUserIds.includes(input.authUserId)
    if (!isAuthorized) {
      throw new Error('شما دسترسی مجاز به این رویداد دونگ ندارید')
    }
  }

  const incoming: DongEvent = {
    ...input.event,
    remoteId: cleanRemoteId,
    shareRole: input.event.shareRole ?? (input.isOwnerVerified ? 'owner' : 'member'),
  }

  let merged: DongEvent
  if (existing) {
    const baseRole = existing.ownerAuthId === input.authUserId ? 'owner' : incoming.shareRole
    const normalizedExisting: DongEvent = {
      ...existing.event,
      shareRole: baseRole === 'owner' ? 'owner' : 'member',
    }
    const incomingForMerge: DongEvent = {
      ...incoming,
      shareRole: input.isOwnerVerified === true ? 'owner' : input.isOwnerVerified === false ? 'member' : incoming.shareRole,
    }
    merged = mergeSharedDong(normalizedExisting, incomingForMerge)
  } else {
    merged = incoming
  }

  const nextAuthorized = Array.from(
    new Set([...(existing?.authorizedUserIds ?? []), input.authUserId]),
  )

  const record: ServerDongRecord = {
    remoteId: cleanRemoteId,
    ownerAuthId:
      existing?.ownerAuthId ??
      (input.isOwnerVerified || incoming.shareRole !== 'member' ? input.authUserId : ''),
    authorizedUserIds: nextAuthorized,
    event: merged,
    updatedAt: Date.now(),
  }

  records[cleanRemoteId] = record
  writeJsonFile(DONG_SHARED_PATH, records)

  return { success: true, event: merged }
}

export function pullServerDongStates(input: {
  remoteIds: string[]
  authUserId: string
  verifiedRemoteIds: Set<string>
}): DongEvent[] {
  const records = readJsonFile<Record<string, ServerDongRecord>>(DONG_SHARED_PATH, {})
  const out: DongEvent[] = []
  let dirty = false

  for (const rawId of input.remoteIds) {
    const cleanId = String(rawId || '').trim()
    if (!cleanId) continue
    const rec = records[cleanId]
    if (!rec) continue

    const rlsVerified = input.verifiedRemoteIds.has(cleanId)
    const alreadyAuthorized =
      rec.ownerAuthId === input.authUserId || rec.authorizedUserIds.includes(input.authUserId)

    if (!rlsVerified && !alreadyAuthorized) {
      continue
    }

    if (rlsVerified && !rec.authorizedUserIds.includes(input.authUserId)) {
      rec.authorizedUserIds.push(input.authUserId)
      dirty = true
    }

    const isOwner = rec.ownerAuthId ? rec.ownerAuthId === input.authUserId : rec.event.shareRole !== 'member'
    out.push({
      ...rec.event,
      id: isOwner ? rec.event.id : `shared_${cleanId}`,
      remoteId: cleanId,
      shareRole: isOwner ? 'owner' : 'member',
    })
  }

  if (dirty) {
    writeJsonFile(DONG_SHARED_PATH, records)
  }

  return out
}
