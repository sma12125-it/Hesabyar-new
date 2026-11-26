import * as db from '../db/db'
import { toWesternDigits } from './money'
import { loadSession } from './sync'
import { displayNameOf, HANDLE_PATTERN, type UserProfile } from './profile'
import type { Cheque, DebtLoan, InstallmentItem, InstallmentPlan, ShareAssetKind } from '../types'

export type { ShareAssetKind }

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
  assetKind: ShareAssetKind
  assetId: string
  assetName: string
  assetDetails?: Record<string, unknown> & {
    bankName?: string
    accountNumber?: string
    pan?: string
    balance?: number
    currency?: string
    sheba?: string
    expiry?: string
    holder?: string
    // Installment details
    installmentAmount?: number
    totalCount?: number
    startDate?: string
    status?: string
    kind?: 'fixed' | 'loan'
    principal?: number
    annualRatePercent?: number
    items?: InstallmentItem[]
    // Debt details
    direction?: string
    party?: string
    amount?: number
    dueDate?: string
    note?: string
    settledAt?: string
    repaidAmount?: number
    // Cheque details
    sayadId?: string
    clearedAt?: string
  }
  ownerUserId: string
  ownerDisplayName?: string
  status?: 'pending' | 'accepted' | 'rejected'
  sharedAt: string
  updatedAt?: string
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

function shareKey(kind: ShareAssetKind, id: string): string {
  return `hy_asset_shares:${kind}:${String(id).trim()}`
}

export function serializeInstallmentShareDetails(
  plan: InstallmentPlan,
  planItems: InstallmentItem[],
): Record<string, unknown> {
  return {
    name: plan.name,
    installmentAmount: plan.installmentAmount,
    totalCount: plan.totalCount,
    startDate: plan.startDate,
    status: plan.status,
    kind: plan.kind ?? 'fixed',
    principal: plan.principal,
    annualRatePercent: plan.annualRatePercent,
    updatedAt: plan.updatedAt,
    items: planItems
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => ({
        id: item.id,
        planId: item.planId,
        index: item.index,
        dueDate: item.dueDate,
        amount: item.amount,
        status: item.status,
        paidAt: item.paidAt,
      })),
  }
}

export function serializeDebtShareDetails(debt: DebtLoan): Record<string, unknown> {
  return {
    direction: debt.direction,
    party: debt.party,
    amount: debt.amount,
    dueDate: debt.dueDate,
    note: debt.note,
    status: debt.status,
    settledAt: debt.settledAt,
    repaidAmount: debt.repaidAmount,
    updatedAt: debt.updatedAt,
  }
}

export function serializeChequeShareDetails(cheque: Cheque): Record<string, unknown> {
  return {
    direction: cheque.direction,
    sayadId: cheque.sayadId,
    bankName: cheque.bankName,
    amount: cheque.amount,
    dueDate: cheque.dueDate,
    party: cheque.party,
    status: cheque.status,
    note: cheque.note,
    clearedAt: cheque.clearedAt,
    updatedAt: cheque.updatedAt,
  }
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
 * Strictly determines whether an asset is an incoming shared asset received from
 * another user. Assets owned by the current user always return false.
 */
export function isIncomingSharedAsset(
  item: { isShared?: boolean; ownerUserId?: string; recipientUserId?: string; shareId?: string } | null | undefined,
  myUserId?: string,
): boolean {
  if (!item || item.isShared !== true) return false
  const activeId = (myUserId || getStableUserId()).trim().toLowerCase()
  if (!activeId) return false
  const ownerId = (item.ownerUserId || '').trim().toLowerCase()
  if (ownerId && ownerId === activeId) return false
  const recipientId = (item.recipientUserId || '').trim().toLowerCase()
  if (recipientId && recipientId !== activeId) return false
  return true
}

/**
 * Registers the current active user profile on the server registry.
 */
export async function autoRegisterCurrentProfile(): Promise<void> {
  try {
    const localProfile = await safeGetKv<UserProfile>('userProfile')
    const session = loadSession()
    const fullUserId = session?.userId?.trim() || undefined
    const shortUserId = fullUserId
      ? fullUserId.length > 16
        ? fullUserId.slice(0, 12)
        : fullUserId
      : getStableUserId()

    const dName = localProfile
      ? displayNameOf(localProfile)
      : session?.email?.split('@')[0] || 'کاربر حسابیار'

    await fetch('/api/v1/profiles/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: shortUserId,
        fullUserId,
        shortUserId,
        handle: localProfile?.handle?.trim() || undefined,
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
 * Queries the real server registry (plus cloud fallback when signed in).
 * Strictly returns null if not found (no sample profiles, no fake synthetic user generation).
 */
export async function lookupUserByIdOrHandle(rawInput: string): Promise<SharedUserProfile | null> {
  const query = toWesternDigits(rawInput).trim().replace(/^@+/, '')
  if (!query) return null

  const queryLower = query.toLowerCase()
  const stableId = getStableUserId()

  // 1. Check current local user profile & active session
  try {
    const localProfile = await safeGetKv<UserProfile>('userProfile')
    const session = loadSession()
    const activeUserId = session?.userId
      ? session.userId.length > 16
        ? session.userId.slice(0, 12)
        : session.userId
      : stableId

    const matchHandle = Boolean(localProfile?.handle && localProfile.handle.trim().toLowerCase() === queryLower)
    const matchId =
      queryLower === activeUserId.toLowerCase() ||
      queryLower === stableId.toLowerCase() ||
      Boolean(
        session?.userId &&
          (session.userId.toLowerCase() === queryLower ||
            session.userId.slice(0, 12).toLowerCase() === queryLower),
      )
    const matchEmail = Boolean(
      (localProfile?.email && localProfile.email.trim().toLowerCase() === queryLower) ||
        (session?.email && session.email.trim().toLowerCase() === queryLower),
    )

    if (matchHandle || matchId || matchEmail) {
      const dName = localProfile
        ? displayNameOf(localProfile)
        : session?.email?.split('@')[0] || 'کاربر حسابیار'
      return {
        userId: activeUserId,
        handle: localProfile?.handle?.trim() || `user_${activeUserId.slice(0, 6)}`,
        displayName: dName,
        firstName: localProfile?.firstName || dName.split(' ')[0] || 'کاربر',
        lastName: localProfile?.lastName || dName.split(' ')[1] || '',
        avatarUrl: localProfile?.avatarUrl || HUMAN_AVATARS[0],
        email: localProfile?.email || session?.email,
        sharedAt: new Date().toISOString(),
      }
    }
  } catch {}

  // 2. Query the real server profile registry (includes Supabase cloud fallback on backend)
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

  // 3. Fallback: if user is signed into Supabase and searched by handle/ID, query Supabase RPC directly
  try {
    const session = loadSession()
    if (session?.accessToken) {
      const { lookupPublicProfile } = await import('./profileApi')
      const cloudProfile = await lookupPublicProfile(query)
      if (cloudProfile) {
        return {
          userId: cloudProfile.userId || cloudProfile.handle,
          handle: cloudProfile.handle,
          displayName: cloudProfile.displayName,
          avatarUrl: cloudProfile.avatarUrl || HUMAN_AVATARS[0],
          sharedAt: new Date().toISOString(),
        }
      }
    } else if (HANDLE_PATTERN.test(queryLower)) {
      // No active session; rely only on server registry & known profiles
    }
  } catch {}

  // 4. Fallback: check local known profiles
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
 * Gets the list of shared users for a specific asset.
 * Merges server and local storage so members are never lost when reopened.
 */
export async function getSharedUsers(kind: ShareAssetKind, id: string): Promise<SharedUserProfile[]> {
  const cleanId = String(id).trim()
  const stored = (await safeGetKv<SharedUserProfile[]>(shareKey(kind, cleanId))) || []

  try {
    const res = await fetch(`/api/v1/shares/asset?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(cleanId)}`)
    if (res.ok) {
      const json = await res.json()
      if (json.success && Array.isArray(json.users)) {
        const merged = [...json.users]
        for (const loc of stored) {
          const already = merged.some(
            (m) =>
              (m.userId && loc.userId && m.userId.toLowerCase() === loc.userId.toLowerCase()) ||
              (m.handle && loc.handle && m.handle.toLowerCase().replace(/^@+/, '') === loc.handle.toLowerCase().replace(/^@+/, '')),
          )
          if (!already) {
            merged.push(loc)
          }
        }
        const finalUsers = merged.slice(0, 10)
        await safeSetKv(shareKey(kind, cleanId), finalUsers)
        return finalUsers
      }
    }
  } catch {}

  return stored.slice(0, 10)
}

/**
 * Adds a user to the shared list for a specific asset.
 * Enforces a strict maximum of 10 users!
 * Saves to server so it appears for the other user as well.
 */
export async function addSharedUser(
  kind: ShareAssetKind,
  id: string,
  user: SharedUserProfile,
  assetInfo?: Record<string, unknown> & {
    name?: string
    bankName?: string
    pan?: string
    accountNumber?: string
    balance?: number
    sheba?: string
    expiry?: string
  },
): Promise<{ success: boolean; total: number; message?: string }> {
  const cleanId = String(id).trim()
  const current = await getSharedUsers(kind, cleanId)

  // Enforce maximum 10 users limit
  if (current.length >= 10 && !current.some((u) => u.userId === user.userId || u.handle === user.handle)) {
    throw new Error('امکان اشتراک‌گذاری حداکثر با ۱۰ کاربر وجود دارد. سقف ۱۰ کاربر تکمیل شده است.')
  }

  // 1. Save on server
  try {
    const localProfile = await safeGetKv<UserProfile>('userProfile')
    const session = loadSession()
    const stableId = getStableUserId()
    const ownerDisplayName =
      localProfile?.displayName?.trim() ||
      `${localProfile?.firstName?.trim() || ''} ${localProfile?.lastName?.trim() || ''}`.trim() ||
      (localProfile?.handle ? `@${localProfile.handle.replace(/^@+/, '')}` : '') ||
      session?.email?.trim() ||
      `کاربر ${stableId}`

    const defaultNames: Record<ShareAssetKind, string> = {
      card: 'کارت بانکی',
      account: 'حساب مالی',
      installment: 'برنامه اقساط',
      debt: 'بدهی / طلب',
      cheque: 'چک صیادی',
    }

    const res = await fetch('/api/v1/shares/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetKind: kind,
        assetId: cleanId,
        assetName: assetInfo?.name || assetInfo?.bankName || defaultNames[kind] || 'دارایی مالی',
        assetDetails: assetInfo,
        ownerUserId: stableId,
        ownerDisplayName,
        granteeUser: user,
      }),
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => null)
      throw new Error(errJson?.error || 'ثبت اشتراک‌گذاری در سرور ناموفق بود')
    }
  } catch (err) {
    if (err instanceof Error && (err.message.includes('حداکثر با ۱۰ کاربر') || err.message.includes('سرور') || err.message.includes('نامعتبر'))) {
      throw err
    }
  }

  // 2. Update local state
  const filtered = current.filter(
    (u) =>
      u.userId.toLowerCase() !== user.userId.toLowerCase() &&
      u.handle.toLowerCase().replace(/^@+/, '') !== user.handle.toLowerCase().replace(/^@+/, ''),
  )
  const updated: SharedUserProfile[] = [
    {
      ...user,
      sharedAt: new Date().toISOString(),
    },
    ...filtered,
  ].slice(0, 10)

  await safeSetKv(shareKey(kind, cleanId), updated)

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
        detail: { kind, id: cleanId, users: updated },
      }),
    )
  }

  return { success: true, total: updated.length }
}

/**
 * Syncs updated details/status for an existing shared asset to all shared recipients on the server.
 */
export async function syncSharedAssetState(
  kind: ShareAssetKind,
  id: string,
  assetName: string,
  assetDetails: Record<string, unknown>,
): Promise<void> {
  try {
    const cleanId = String(id).trim()
    if (!cleanId) return
    await fetch('/api/v1/shares/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetKind: kind,
        assetId: cleanId,
        ownerUserId: getStableUserId(),
        assetName,
        assetDetails,
      }),
    })
  } catch {
    // Offline or non-shared asset: silently ignore
  }
}

/**
 * Revokes access of a shared user from an asset.
 */
export async function removeSharedUser(
  kind: ShareAssetKind,
  id: string,
  targetUserIdOrHandle: string,
  shareId?: string,
): Promise<number> {
  const cleanId = String(id).trim()
  const cleanTarget = String(targetUserIdOrHandle).trim().toLowerCase().replace(/^@+/, '')

  // 1. Revoke on server
  try {
    await fetch('/api/v1/shares/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetKind: kind,
        assetId: cleanId,
        granteeUserId: targetUserIdOrHandle,
        ...(shareId ? { shareId } : {}),
      }),
    })
  } catch {}

  // 2. Revoke locally
  const current = (await safeGetKv<SharedUserProfile[]>(shareKey(kind, cleanId))) || []
  const updated = current.filter((u) => {
    const uId = (u.userId || '').trim().toLowerCase()
    const uHandle = (u.handle || '').trim().toLowerCase().replace(/^@+/, '')
    return uId !== cleanTarget && uHandle !== cleanTarget
  })

  await safeSetKv(shareKey(kind, cleanId), updated)

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('hy-share-assets-updated', {
        detail: { kind, id: cleanId, users: updated },
      }),
    )
  }

  return updated.length
}

/**
 * Responds to an incoming asset share (accept or reject).
 */
export async function respondIncomingShare(
  shareId: string,
  action: 'accept' | 'reject',
): Promise<boolean> {
  try {
    const res = await fetch('/api/v1/shares/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId, action }),
    })
    if (res.ok) {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('hy-share-assets-updated'))
      }
      return true
    }
  } catch {}
  return false
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
          status: s.status || 'pending',
          sharedAt: s.sharedAt,
          updatedAt: s.updatedAt,
        }))
      }
    }
  } catch {}
  return []
}
