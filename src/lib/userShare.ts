import * as db from '../db/db'
import { toWesternDigits } from './money'
import { loadSession } from './sync'
import type { UserProfile } from './profile'

export interface SharedUserProfile {
  userId: string
  handle: string
  displayName: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
  email?: string
  sharedAt: string
}

export interface IncomingSharedAsset {
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
  sharedAt: string
}

// Curated authentic real human portrait photos
export const HUMAN_AVATARS: string[] = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80',
]

const memKv = new Map<string, unknown>()

async function safeGetKv<T>(key: string): Promise<T | undefined> {
  try {
    if (typeof indexedDB !== 'undefined') {
      return await db.getKv<T>(key)
    }
  } catch {}
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        return JSON.parse(raw) as T
      } catch {}
    }
  }
  return memKv.get(key) as T | undefined
}

async function safeSetKv<T>(key: string, value: T): Promise<void> {
  try {
    if (typeof indexedDB !== 'undefined') {
      await db.setKv(key, value)
      return
    }
  } catch {}
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  }
  memKv.set(key, value)
}

function shareKey(kind: 'card' | 'account', id: string): string {
  return `hy_asset_shares:${kind}:${id}`
}

/**
 * Returns a stable, persistent User ID for the current app user.
 */
export function getStableUserId(): string {
  const session = loadSession()
  if (session?.userId) {
    return session.userId.length > 16 ? session.userId.slice(0, 12) : session.userId
  }
  if (typeof localStorage !== 'undefined') {
    let localId = localStorage.getItem('hy_persistent_user_id')
    if (!localId) {
      localId = 'usr_9a2f1c84'
      localStorage.setItem('hy_persistent_user_id', localId)
    }
    return localId
  }
  return 'usr_9a2f1c84'
}

/**
 * Registers the current active user profile on the server registry.
 */
export async function autoRegisterCurrentProfile(): Promise<void> {
  try {
    const localProfile = await safeGetKv<UserProfile>('userProfile')
    const session = loadSession()
    const userId = session?.userId
      ? session.userId.length > 16
        ? session.userId.slice(0, 12)
        : session.userId
      : getStableUserId()

    const dName =
      localProfile?.displayName?.trim() ||
      `${localProfile?.firstName?.trim() || ''} ${localProfile?.lastName?.trim() || ''}`.trim() ||
      'کاربر حسابیار'

    await fetch('/api/v1/profiles/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        handle: localProfile?.handle || `user_${userId.slice(0, 6)}`,
        displayName: dName,
        firstName: localProfile?.firstName || '',
        lastName: localProfile?.lastName || '',
        avatarUrl: localProfile?.avatarUrl || HUMAN_AVATARS[0],
        email: localProfile?.email || session?.email,
      }),
    })
  } catch {}
}

/**
 * Searches for a user either by User ID (from Settings) or by manual profile handle (@handle / username).
 * Queries the real server registry.
 * Strictly returns null if not found (no sample profiles, no fake synthetic user generation).
 */
export async function lookupUserByIdOrHandle(rawInput: string): Promise<SharedUserProfile | null> {
  const query = toWesternDigits(rawInput).trim().replace(/^@+/, '')
  if (!query) return null

  const queryLower = query.toLowerCase()
  const stableId = getStableUserId()

  // 1. Check current local user profile
  try {
    const localProfile = await safeGetKv<UserProfile>('userProfile')
    const session = loadSession()
    const activeUserId = session?.userId
      ? session.userId.length > 16
        ? session.userId.slice(0, 12)
        : session.userId
      : stableId

    if (localProfile) {
      const matchHandle = localProfile.handle && localProfile.handle.toLowerCase() === queryLower
      const matchId =
        queryLower === activeUserId.toLowerCase() ||
        (session?.userId &&
          (session.userId.toLowerCase() === queryLower ||
            session.userId.slice(0, 12).toLowerCase() === queryLower))
      const matchEmail = localProfile.email && localProfile.email.toLowerCase() === queryLower

      if (matchHandle || matchId || matchEmail) {
        const dName =
          localProfile.displayName?.trim() ||
          `${localProfile.firstName?.trim() || ''} ${localProfile.lastName?.trim() || ''}`.trim() ||
          'کاربر حسابیار'
        return {
          userId: activeUserId,
          handle: localProfile.handle || 'me',
          displayName: dName,
          firstName: localProfile.firstName || dName.split(' ')[0] || 'کاربر',
          lastName: localProfile.lastName || dName.split(' ')[1] || '',
          avatarUrl: localProfile.avatarUrl || HUMAN_AVATARS[0],
          email: localProfile.email || session?.email,
          sharedAt: new Date().toISOString(),
        }
      }
    }
  } catch {}

  // 2. Query the real server profile registry
  try {
    const res = await fetch(`/api/v1/profiles/lookup?q=${encodeURIComponent(query)}`)
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.profile) {
        const p = json.profile
        return {
          userId: p.userId,
          handle: p.handle,
          displayName: p.displayName,
          firstName: p.firstName,
          lastName: p.lastName,
          avatarUrl: p.avatarUrl || HUMAN_AVATARS[0],
          email: p.email,
          sharedAt: new Date().toISOString(),
        }
      }
    }
  } catch {}

  // 3. Fallback: check local known profiles
  try {
    const known = (await safeGetKv<SharedUserProfile[]>('hy_known_profiles')) ?? []
    const foundKnown = known.find(
      (u) =>
        u.handle.toLowerCase() === queryLower ||
        u.userId.toLowerCase() === queryLower ||
        (u.email && u.email.toLowerCase() === queryLower),
    )
    if (foundKnown) {
      return {
        ...foundKnown,
        avatarUrl: foundKnown.avatarUrl || HUMAN_AVATARS[0],
        sharedAt: new Date().toISOString(),
      }
    }
  } catch {}

  // User not found on server or locally
  return null
}

/**
 * Gets the list of shared users for a specific account or bank card.
 * Fetches from the server so the sheet is never empty when reopened.
 */
export async function getSharedUsers(kind: 'card' | 'account', id: string): Promise<SharedUserProfile[]> {
  try {
    // 1. Try server first
    const res = await fetch(`/api/v1/shares/asset?kind=${kind}&id=${encodeURIComponent(id)}`)
    if (res.ok) {
      const json = await res.json()
      if (json.success && Array.isArray(json.users)) {
        await safeSetKv(shareKey(kind, id), json.users)
        return json.users
      }
    }
  } catch {}

  // 2. Fall back to local storage
  try {
    const stored = await safeGetKv<SharedUserProfile[]>(shareKey(kind, id))
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

/**
 * Adds a user to the shared list for a specific account or bank card.
 * Enforces a strict maximum of 10 users!
 * Saves to server so it appears for the other user as well.
 */
export async function addSharedUser(
  kind: 'card' | 'account',
  id: string,
  user: SharedUserProfile,
  assetInfo?: {
    name?: string
    bankName?: string
    pan?: string
    accountNumber?: string
    balance?: number
  },
): Promise<{ success: boolean; total: number; message?: string }> {
  const current = await getSharedUsers(kind, id)

  // Enforce maximum 10 users limit
  if (current.length >= 10 && !current.some((u) => u.userId === user.userId || u.handle === user.handle)) {
    throw new Error('امکان اشتراک‌گذاری حداکثر با ۱۰ کاربر وجود دارد. سقف ۱۰ کاربر تکمیل شده است.')
  }

  // 1. Save on server
  try {
    const localProfile = await safeGetKv<UserProfile>('userProfile')
    const ownerDisplayName =
      localProfile?.displayName ||
      `${localProfile?.firstName || ''} ${localProfile?.lastName || ''}`.trim() ||
      'مالک حساب'

    const res = await fetch('/api/v1/shares/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetKind: kind,
        assetId: id,
        assetName: assetInfo?.name || assetInfo?.bankName || (kind === 'card' ? 'کارت بانکی' : 'حساب مالی'),
        assetDetails: assetInfo,
        ownerUserId: getStableUserId(),
        ownerDisplayName,
        granteeUser: user,
      }),
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => null)
      if (errJson?.error) {
        throw new Error(errJson.error)
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('حداکثر با ۱۰ کاربر')) {
      throw err
    }
  }

  // 2. Update local state
  const filtered = current.filter((u) => u.userId !== user.userId && u.handle !== user.handle)
  const updated: SharedUserProfile[] = [
    {
      ...user,
      sharedAt: new Date().toISOString(),
    },
    ...filtered,
  ].slice(0, 10)

  await safeSetKv(shareKey(kind, id), updated)

  // Remember in known profiles cache
  try {
    const known = (await safeGetKv<SharedUserProfile[]>('hy_known_profiles')) ?? []
    const updatedKnown = [user, ...known.filter((k) => k.userId !== user.userId && k.handle !== user.handle)].slice(0, 30)
    await safeSetKv('hy_known_profiles', updatedKnown)
  } catch {}

  // Dispatch global event for instant UI sync
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('hy-share-assets-updated', {
        detail: { kind, id, users: updated },
      }),
    )
  }

  return { success: true, total: updated.length }
}

/**
 * Revokes access of a shared user from a card or account.
 */
export async function removeSharedUser(
  kind: 'card' | 'account',
  id: string,
  targetUserIdOrHandle: string,
): Promise<number> {
  // 1. Revoke on server
  try {
    await fetch('/api/v1/shares/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetKind: kind,
        assetId: id,
        granteeUserId: targetUserIdOrHandle,
      }),
    })
  } catch {}

  // 2. Revoke locally
  const current = await getSharedUsers(kind, id)
  const updated = current.filter(
    (u) => u.userId !== targetUserIdOrHandle && u.handle !== targetUserIdOrHandle,
  )

  await safeSetKv(shareKey(kind, id), updated)

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('hy-share-assets-updated', {
        detail: { kind, id, users: updated },
      }),
    )
  }

  return updated.length
}

/**
 * Fetches assets shared WITH the current user from the server.
 */
export async function fetchIncomingShares(): Promise<IncomingSharedAsset[]> {
  try {
    const localProfile = await safeGetKv<UserProfile>('userProfile')
    const userId = getStableUserId()
    const handle = localProfile?.handle || ''

    const res = await fetch(
      `/api/v1/shares/incoming?userId=${encodeURIComponent(userId)}&handle=${encodeURIComponent(handle)}`,
    )
    if (res.ok) {
      const json = await res.json()
      if (json.success && Array.isArray(json.shares)) {
        return json.shares.map((s: any) => ({
          id: s.id,
          assetKind: s.assetKind,
          assetId: s.assetId,
          assetName: s.assetName,
          assetDetails: s.assetDetails,
          ownerUserId: s.ownerUserId,
          ownerDisplayName: s.ownerDisplayName,
          sharedAt: s.sharedAt,
        }))
      }
    }
  } catch {}
  return []
}
