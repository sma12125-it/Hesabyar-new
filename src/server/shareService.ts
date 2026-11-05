import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface RegisteredProfile {
  userId: string
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
  assetKind: 'card' | 'account'
  assetId: string
  assetName: string
  assetDetails?: {
    bankName?: string
    accountNumber?: string
    pan?: string
    balance?: number
    currency?: string
  }
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
  }
  sharedAt: string
}

const DATA_DIR = join(process.cwd(), 'data')
const PROFILES_PATH = join(DATA_DIR, 'profiles.json')
const SHARES_PATH = join(DATA_DIR, 'shared_assets.json')

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

/**
 * Register or update a user profile in persistent server storage.
 */
export function registerUserProfile(profile: {
  userId: string
  handle?: string
  displayName?: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
  email?: string
}): RegisteredProfile {
  if (!profile.userId) {
    throw new Error('شناسه کاربری (userId) الزامی است')
  }

  const profiles = readJsonFile<RegisteredProfile[]>(PROFILES_PATH, [])
  const cleanHandle = (profile.handle || '').trim().replace(/^@+/, '').toLowerCase()
  const cleanUserId = profile.userId.trim()

  const existingIndex = profiles.findIndex(
    (p) => p.userId === cleanUserId || (cleanHandle && p.handle.toLowerCase() === cleanHandle),
  )

  const updated: RegisteredProfile = {
    userId: cleanUserId,
    handle: cleanHandle || (existingIndex >= 0 ? profiles[existingIndex].handle : `user_${cleanUserId.slice(0, 6)}`),
    displayName:
      (profile.displayName || '').trim() ||
      `${(profile.firstName || '').trim()} ${(profile.lastName || '').trim()}`.trim() ||
      (existingIndex >= 0 ? profiles[existingIndex].displayName : 'کاربر حسابیار'),
    firstName: profile.firstName ? profile.firstName.trim() : existingIndex >= 0 ? profiles[existingIndex].firstName : '',
    lastName: profile.lastName ? profile.lastName.trim() : existingIndex >= 0 ? profiles[existingIndex].lastName : '',
    avatarUrl:
      profile.avatarUrl ||
      (existingIndex >= 0 ? profiles[existingIndex].avatarUrl : REAL_AVATARS[0]),
    email: profile.email ? profile.email.trim() : existingIndex >= 0 ? profiles[existingIndex].email : undefined,
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
 * Look up a real registered profile by User ID, Handle, or Email.
 * Returns null if not found (strictly no fake fallback).
 */
export function lookupUserProfile(query: string): RegisteredProfile | null {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return null
  const cleanLower = clean.toLowerCase()

  const profiles = readJsonFile<RegisteredProfile[]>(PROFILES_PATH, [])

  const match = profiles.find(
    (p) =>
      p.userId.toLowerCase() === cleanLower ||
      p.handle.toLowerCase() === cleanLower ||
      (p.email && p.email.toLowerCase() === cleanLower),
  )

  return match || null
}

/**
 * Get all shared users for a specific card or account.
 */
export function getAssetShares(assetKind: 'card' | 'account', assetId: string): SharedAssetRecord[] {
  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])
  return shares.filter((s) => s.assetKind === assetKind && s.assetId === assetId)
}

/**
 * Share an account or bank card with another user. Enforces strict maximum of 10 users per asset.
 */
export function shareAssetWithUser(input: {
  assetKind: 'card' | 'account'
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
  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])
  const currentAssetShares = shares.filter(
    (s) => s.assetKind === input.assetKind && s.assetId === input.assetId,
  )

  const isExisting = currentAssetShares.some(
    (s) =>
      s.granteeUser.userId === input.granteeUser.userId ||
      s.granteeUser.handle.toLowerCase() === input.granteeUser.handle.toLowerCase(),
  )

  if (!isExisting && currentAssetShares.length >= 10) {
    throw new Error('امکان اشتراک‌گذاری حداکثر با ۱۰ کاربر وجود دارد. سقف ظرفیت تکمیل شده است.')
  }

  const recordId = `share_${input.assetKind}_${input.assetId}_${input.granteeUser.userId}`
  const now = new Date().toISOString()

  const newRecord: SharedAssetRecord = {
    id: recordId,
    assetKind: input.assetKind,
    assetId: input.assetId,
    assetName: input.assetName,
    assetDetails: input.assetDetails as any,
    ownerUserId: input.ownerUserId,
    ownerDisplayName: input.ownerDisplayName || 'مالک حساب',
    granteeUser: {
      ...input.granteeUser,
      sharedAt: now,
    },
    sharedAt: now,
  }

  const existingIdx = shares.findIndex((s) => s.id === recordId)
  if (existingIdx >= 0) {
    shares[existingIdx] = newRecord
  } else {
    shares.unshift(newRecord)
  }

  writeJsonFile(SHARES_PATH, shares)

  const updatedAssetShares = shares.filter(
    (s) => s.assetKind === input.assetKind && s.assetId === input.assetId,
  )

  return { success: true, share: newRecord, total: updatedAssetShares.length }
}

/**
 * Revoke sharing of an asset from a user.
 */
export function revokeAssetShare(
  assetKind: 'card' | 'account',
  assetId: string,
  granteeUserId: string,
): { success: boolean; remaining: number } {
  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])
  const filtered = shares.filter(
    (s) =>
      !(
        s.assetKind === assetKind &&
        s.assetId === assetId &&
        (s.granteeUser.userId === granteeUserId || s.granteeUser.handle === granteeUserId)
      ),
  )

  writeJsonFile(SHARES_PATH, filtered)
  const remaining = filtered.filter((s) => s.assetKind === assetKind && s.assetId === assetId).length
  return { success: true, remaining }
}

/**
 * Get all assets shared WITH a user (incoming shares).
 */
export function getIncomingSharesForUser(userId?: string, handle?: string): SharedAssetRecord[] {
  if (!userId && !handle) return []
  const shares = readJsonFile<SharedAssetRecord[]>(SHARES_PATH, [])
  const cleanId = (userId || '').trim().toLowerCase()
  const cleanHandle = (handle || '').trim().replace(/^@+/, '').toLowerCase()

  return shares.filter((s) => {
    const g = s.granteeUser
    const matchId = cleanId && g.userId.toLowerCase() === cleanId
    const matchHandle = cleanHandle && g.handle.toLowerCase() === cleanHandle
    return matchId || matchHandle
  })
}
