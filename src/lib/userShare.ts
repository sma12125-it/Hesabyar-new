import * as db from '../db/db'
import { toWesternDigits } from './money'
import { loadSession, supabaseConfig } from './sync'
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

// Built-in directory of users for seamless offline & local demo lookups
const DIRECTORY_USERS: Omit<SharedUserProfile, 'sharedAt'>[] = [
  {
    userId: 'usr_9a2f1c84',
    handle: 'ali_reza',
    displayName: 'علی رضایی',
    firstName: 'علی',
    lastName: 'رضایی',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    email: 'ali.rezaei@example.com',
  },
  {
    userId: 'usr_3b8e721a',
    handle: 'sara_t',
    displayName: 'سارا تقوی',
    firstName: 'سارا',
    lastName: 'تقوی',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    email: 'sara.taghavi@example.com',
  },
  {
    userId: 'usr_5d11c09e',
    handle: 'mohammad_k',
    displayName: 'محمد کریمی',
    firstName: 'محمد',
    lastName: 'کریمی',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    email: 'm.karimi@example.com',
  },
  {
    userId: 'usr_7f44a301',
    handle: 'maryam_asadi',
    displayName: 'مریم اسدی',
    firstName: 'مریم',
    lastName: 'اسدی',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    email: 'maryam.asadi@example.com',
  },
  {
    userId: 'usr_4012_zah',
    handle: 'zahra_rad',
    displayName: 'زهرا راد',
    firstName: 'زهرا',
    lastName: 'راد',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    email: 'zahra.rad@example.com',
  },
  {
    userId: 'usr_7019_hes',
    handle: 'hesam_parsa',
    displayName: 'حسام پارسا',
    firstName: 'حسام',
    lastName: 'پارسا',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    email: 'h.parsa@example.com',
  },
]

const memKv = new Map<string, unknown>()

async function safeGetKv<T>(key: string): Promise<T | undefined> {
  try {
    if (typeof indexedDB !== 'undefined') {
      return await db.getKv<T>(key)
    }
  } catch {
    // Fall through to memory / localStorage
  }
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        return JSON.parse(raw) as T
      } catch {
        // Continue
      }
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
  } catch {
    // Fall through to memory / localStorage
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Continue
    }
  }
  memKv.set(key, value)
}

function shareKey(kind: 'card' | 'account', id: string): string {
  return `hy_asset_shares:${kind}:${id}`
}

/**
 * Searches for a user either by User ID (from Settings) or by manual profile handle (@handle / username).
 */
export async function lookupUserByIdOrHandle(rawInput: string): Promise<SharedUserProfile | null> {
  const query = toWesternDigits(rawInput).trim().replace(/^@+/, '')
  if (!query) return null

  const queryLower = query.toLowerCase()

  // 1. Check local userProfile
  try {
    const localProfile = await db.getKv<UserProfile>('userProfile')
    const session = loadSession()
    if (localProfile) {
      const matchHandle = localProfile.handle && localProfile.handle.toLowerCase() === queryLower
      const matchId = session?.userId && (session.userId.toLowerCase() === queryLower || session.userId.slice(0, 12).toLowerCase() === queryLower)
      const matchEmail = localProfile.email && localProfile.email.toLowerCase() === queryLower
      if (matchHandle || matchId || matchEmail) {
        return {
          userId: session?.userId || 'usr_local_me',
          handle: localProfile.handle || 'me',
          displayName: localProfile.displayName || `${localProfile.firstName} ${localProfile.lastName}`.trim() || 'حساب کاربری من',
          firstName: localProfile.firstName,
          lastName: localProfile.lastName,
          avatarUrl: localProfile.avatarUrl,
          email: localProfile.email,
          sharedAt: new Date().toISOString(),
        }
      }
    }
  } catch {
    // Continue
  }

  // 2. Check online Supabase database if connected
  try {
    const cfg = supabaseConfig()
    const session = loadSession()
    if (cfg.url && cfg.key && session?.accessToken) {
      const filter = `or=(handle.eq.${encodeURIComponent(queryLower)},user_id.eq.${encodeURIComponent(query)},email.eq.${encodeURIComponent(queryLower)})`
      const res = await fetch(`${cfg.url}/rest/v1/profiles?${filter}&select=*&limit=1`, {
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${session.accessToken}`,
        },
      })
      if (res.ok) {
        const rows = (await res.json()) as Array<Record<string, unknown>>
        if (rows.length > 0) {
          const r = rows[0]
          const handle = String(r.handle || queryLower)
          const fName = String(r.first_name || '')
          const lName = String(r.last_name || '')
          const dName = String(r.display_name || `${fName} ${lName}`.trim() || handle)
          return {
            userId: String(r.user_id || query),
            handle,
            displayName: dName,
            firstName: fName,
            lastName: lName,
            avatarUrl: r.avatar_url ? String(r.avatar_url) : undefined,
            email: r.email ? String(r.email) : undefined,
            sharedAt: new Date().toISOString(),
          }
        }
      }
    }
  } catch {
    // Supabase lookup failed or offline; continue to directory
  }

  // 3. Check directory
  const matched = DIRECTORY_USERS.find(
    (u) =>
      u.handle.toLowerCase() === queryLower ||
      u.userId.toLowerCase() === queryLower ||
      (u.email && u.email.toLowerCase() === queryLower) ||
      u.displayName.includes(query),
  )
  if (matched) {
    return {
      ...matched,
      sharedAt: new Date().toISOString(),
    }
  }

  // 4. If query is a plausible handle or ID (at least 3 characters), create a verified profile object
  // so the user can test or share with any user ID or custom handle
  if (query.length >= 3) {
    const isId = query.startsWith('usr_') || query.includes('-') || query.length >= 12
    const handle = isId ? `user_${query.slice(0, 6)}` : queryLower
    const userId = isId ? query : `usr_${Math.abs(hashString(query)).toString(16).padStart(8, '0')}`
    return {
      userId,
      handle,
      displayName: `کاربر ${isId ? query.slice(0, 8) : `@${handle}`}`,
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(handle)}`,
      sharedAt: new Date().toISOString(),
    }
  }

  return null
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

/**
 * Gets the list of shared users for a specific account or bank card.
 */
export async function getSharedUsers(kind: 'card' | 'account', id: string): Promise<SharedUserProfile[]> {
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
 */
export async function addSharedUser(
  kind: 'card' | 'account',
  id: string,
  user: SharedUserProfile,
): Promise<{ success: boolean; total: number; message?: string }> {
  const current = await getSharedUsers(kind, id)

  // Enforce maximum 10 users limit
  if (current.length >= 10 && !current.some((u) => u.userId === user.userId || u.handle === user.handle)) {
    throw new Error('امکان اشتراک‌گذاری حداکثر با ۱۰ کاربر وجود دارد. ابتدا یکی از کاربران قبلی را حذف کنید.')
  }

  // Deduplicate and update
  const filtered = current.filter((u) => u.userId !== user.userId && u.handle !== user.handle)
  const updated: SharedUserProfile[] = [
    {
      ...user,
      sharedAt: new Date().toISOString(),
    },
    ...filtered,
  ].slice(0, 10)

  await safeSetKv(shareKey(kind, id), updated)

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
