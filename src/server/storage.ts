import type { AppData } from '../lib/cascade'
import type { AuthenticatedUser } from './auth'

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://yiluruldxtgfuxqwosri.supabase.co'

const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_tHV7NoCAC-3czs4yMG1Z7Q_bg05S1MI'

// In-memory fallback for local dev / tests
const memoryStore = new Map<string, AppData>()

export function setMemoryData(userId: string, data: AppData): void {
  memoryStore.set(userId, data)
}

export function getMemoryData(userId: string): AppData | undefined {
  return memoryStore.get(userId)
}

/**
 * Loads the user's financial dataset from Supabase snapshots table.
 * Uses the user's authenticated token to respect Row Level Security (RLS).
 */
export async function loadUserData(user: AuthenticatedUser): Promise<AppData> {
  // Check memory store for test/dev mode
  if (memoryStore.has(user.id)) {
    return JSON.parse(JSON.stringify(memoryStore.get(user.id)!)) as AppData
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/snapshots?user_id=eq.${user.id}&select=updated_at,payload`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${user.token}`,
        },
      },
    )

    if (res.ok) {
      const rows = (await res.json()) as Array<{ payload: AppData }>
      if (rows && rows.length > 0 && rows[0].payload) {
        const payload = rows[0].payload
        return {
          accounts: payload.accounts || [],
          transactions: payload.transactions || [],
          plans: payload.plans || [],
          items: payload.items || [],
          cheques: payload.cheques || [],
          debts: payload.debts || [],
          cards: payload.cards || [],
          budgets: payload.budgets || [],
          goals: payload.goals || [],
          investments: payload.investments || [],
          dongEvents: payload.dongEvents || [],
          reminders: payload.reminders || { enabled: false, leadDays: 2 },
          unit: payload.unit || 'IRT',
        }
      }
    }
  } catch (err) {
    console.error(`[Storage] Failed to load data from Supabase for user ${user.id}:`, err)
  }

  // Return clean empty dataset if new user or error
  const empty: AppData = {
    accounts: [],
    transactions: [],
    plans: [],
    items: [],
    cheques: [],
    debts: [],
    cards: [],
    budgets: [],
    goals: [],
    investments: [],
    dongEvents: [],
    reminders: { enabled: false, leadDays: 2 },
    unit: 'IRT',
  }
  return empty
}

/**
 * Saves the updated user dataset to Supabase snapshots table.
 * Enforces user_id check and RLS.
 */
export async function saveUserData(user: AuthenticatedUser, nextData: AppData): Promise<void> {
  // Update memory store
  memoryStore.set(user.id, JSON.parse(JSON.stringify(nextData)) as AppData)

  // In test mode, memory store is sufficient
  if (process.env.NODE_ENV === 'test' || user.token.startsWith('test-user-')) {
    return
  }

  try {
    const nowIso = new Date().toISOString()
    const body = JSON.stringify({
      user_id: user.id,
      updated_at: nowIso,
      payload: nextData,
    })

    const res = await fetch(`${SUPABASE_URL}/rest/v1/snapshots?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body,
    })

    if (!res.ok) {
      // Fallback to PATCH
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/snapshots?user_id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body,
      })

      if (!patchRes.ok) {
        const errText = await patchRes.text()
        console.error(`[Storage] Failed to save snapshot for user ${user.id}:`, errText)
        throw new Error('خطا در ذخیره‌سازی ابری اطلاعات در سرور Supabase')
      }
    }
  } catch (err) {
    console.error(`[Storage] Save error for user ${user.id}:`, err)
    throw err
  }
}
