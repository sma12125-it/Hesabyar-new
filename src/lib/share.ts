import type { AppData } from './cascade'
import type { Account, Transaction } from '../types'
import { ensureSession, loadSession, supabaseConfig, type CloudSession } from './sync'

export interface ShareAccount {
  id: string
  name: string
  type: Account['type']
  openingBalance: number
  archived: boolean
  createdAt: number
  updatedAt: number
  cardId?: string
  shareId?: string
}

export interface SharePayload {
  account: ShareAccount
  transactions: Transaction[]
  deletedIds: string[]
}

export interface SharedLedger {
  id: string
  code: string
  owner_id: string
  account_id: string
  title: string
  updated_at: string
  payload: SharePayload
}

export interface ShareMember {
  email: string
  role: string
}

function seenKey(ledgerId: string) {
  return `hy-share-seen:${ledgerId}`
}

export function seenShareIds(ledgerId: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(seenKey(ledgerId)) || '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function rememberShareIds(ledgerId: string, ids: string[]) {
  localStorage.setItem(seenKey(ledgerId), JSON.stringify(ids))
}

export function shareAccountFrom(account: Account): ShareAccount {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    openingBalance: account.openingBalance,
    archived: account.archived,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    cardId: account.cardId,
    shareId: account.shareId,
  }
}

function revision(tx: Transaction) {
  return tx.updatedAt ?? tx.createdAt ?? 0
}

export function mergeShare(
  remote: SharePayload | null,
  local: { account: ShareAccount; transactions: Transaction[]; deletedIds: string[] },
): SharePayload {
  const deleted = new Set([...(remote?.deletedIds ?? []), ...local.deletedIds])
  const byId = new Map<string, Transaction>()
  for (const tx of remote?.transactions ?? []) {
    if (deleted.has(tx.id) || tx.accountId !== local.account.id) continue
    byId.set(tx.id, tx)
  }
  for (const tx of local.transactions) {
    if (deleted.has(tx.id) || tx.accountId !== local.account.id) continue
    const prev = byId.get(tx.id)
    if (!prev || revision(tx) >= revision(prev)) byId.set(tx.id, tx)
  }
  const remoteAccount = remote?.account
  const account =
    remoteAccount && (remoteAccount.updatedAt ?? 0) > (local.account.updatedAt ?? 0)
      ? { ...remoteAccount, id: local.account.id, shareId: local.account.shareId ?? remoteAccount.shareId }
      : local.account
  return {
    account,
    transactions: [...byId.values()].sort((a, b) => b.createdAt - a.createdAt),
    deletedIds: [...deleted],
  }
}

export function applyShareToData(data: AppData, ledgerId: string, payload: SharePayload): AppData {
  const accountId = payload.account.id
  const deleted = new Set(payload.deletedIds)
  const transactions = [
    ...data.transactions.filter((tx) => tx.accountId !== accountId && !deleted.has(tx.id)),
    ...payload.transactions.filter((tx) => tx.accountId === accountId && !deleted.has(tx.id)),
  ]
  const patch = payload.account
  const exists = data.accounts.some((account) => account.id === accountId)
  const accounts = exists
    ? data.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              name: patch.name,
              type: patch.type,
              openingBalance: patch.openingBalance,
              archived: patch.archived,
              updatedAt: Math.max(account.updatedAt, patch.updatedAt),
              cardId: account.cardId ?? patch.cardId,
              shareId: ledgerId,
            }
          : account,
      )
    : [
        ...data.accounts,
        {
          id: patch.id,
          name: patch.name,
          type: patch.type,
          openingBalance: patch.openingBalance,
          balance: patch.openingBalance,
          archived: patch.archived,
          createdAt: patch.createdAt,
          updatedAt: patch.updatedAt,
          cardId: patch.cardId,
          shareId: ledgerId,
        },
      ]
  return { ...data, accounts, transactions }
}

export function formatShareCode(code: string) {
  const clean = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (clean.length <= 4) return clean
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`
}

async function authed(session?: CloudSession | null) {
  const current = session ?? (await ensureSession())
  if (!current) throw new Error('برای اشتراک کارت، از تنظیمات وارد حساب ابری شوید')
  return current
}

async function rpc<T>(name: string, body: unknown, session: CloudSession): Promise<T> {
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    let message = 'اشتراک انجام نشد'
    try {
      const json = JSON.parse(text) as { message?: string }
      if (json.message) message = json.message
    } catch {
      if (text) message = text.slice(0, 160)
    }
    throw new Error(message)
  }
  return text ? (JSON.parse(text) as T) : (undefined as T)
}

export async function createSharedLedger(account: Account, transactions: Transaction[]) {
  const session = await authed()
  const payload = mergeShare(null, {
    account: { ...shareAccountFrom(account), shareId: undefined },
    transactions: transactions.filter((tx) => tx.accountId === account.id),
    deletedIds: [],
  })
  const created = await rpc<{ id: string; code: string }>('create_shared_ledger', {
    p_account_id: account.id,
    p_title: account.name,
    p_payload: { ...payload, account: { ...payload.account, shareId: undefined } },
  }, session)
  return created
}

export async function inviteSharedEmail(ledgerId: string, email: string) {
  const session = await authed()
  await rpc<void>('invite_shared_email', { p_ledger_id: ledgerId, p_email: email.trim() }, session)
}

export async function joinSharedCode(code: string) {
  const session = await authed()
  const cleanCode = code.trim().toUpperCase()

  // First verify whether this ledger has invited members.
  // If the owner specified invited emails, only those invited emails (or the owner) can join!
  try {
    const cfg = supabaseConfig()
    // Query shared_ledgers by code
    const res = await fetch(`${cfg.url}/rest/v1/shared_ledgers?code=eq.${cleanCode}&select=id,title,owner_id`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${session.accessToken}` },
    })

    if (res.ok) {
      const ledgers = (await res.json()) as Array<{ id: string; title: string; owner_id: string }>
      if (ledgers.length > 0) {
        const targetLedger = ledgers[0]
        // Check invited members
        const membersRes = await fetch(
          `${cfg.url}/rest/v1/shared_members?ledger_id=eq.${targetLedger.id}&select=email,role`,
          { headers: { apikey: cfg.key, Authorization: `Bearer ${session.accessToken}` } },
        )

        if (membersRes.ok) {
          const members = (await membersRes.json()) as Array<{ email: string; role: string }>
          // If invitations exist for specific emails, enforce that current user's email matches
          if (members.length > 0) {
            const userEmail = session.email.toLowerCase().trim()
            const isInvited = members.some((m) => m.email.toLowerCase().trim() === userEmail)
            if (!isInvited) {
              throw new Error(`این کارت فقط برای ایمیل‌های دعوت‌شده توسط مالک مجاز است. ایمیل فعال شما (${session.email}) در لیست مجاز این کارت ثبت نشده است.`)
            }
          }
        }
      }
    }
  } catch (verifyErr) {
    if (verifyErr instanceof Error && verifyErr.message.includes('ایمیل فعال شما')) {
      throw verifyErr
    }
    // Continue to server RPC for database-level check
  }

  return rpc<string>('join_shared_code', { p_code: cleanCode }, session)
}

export async function claimSharedInvites() {
  const session = loadSession()
  if (!session) return 0
  try {
    const current = await authed(session)
    return await rpc<number>('claim_shared_invites', {}, current)
  } catch {
    return 0
  }
}

export async function listSharedLedgers(): Promise<SharedLedger[]> {
  const session = await authed()
  const cfg = supabaseConfig()
  const res = await fetch(`${cfg.url}/rest/v1/shared_ledgers?select=id,code,owner_id,account_id,title,updated_at,payload`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${session.accessToken}` },
  })
  if (!res.ok) throw new Error('فهرست کارت‌های مشترک دریافت نشد')
  const rows = (await res.json()) as SharedLedger[]
  return rows.map((row) => ({
    ...row,
    payload: row.payload ?? { account: {} as ShareAccount, transactions: [], deletedIds: [] },
  }))
}

export async function listShareMembers(ledgerId: string): Promise<ShareMember[]> {
  const session = await authed()
  const cfg = supabaseConfig()
  const res = await fetch(
    `${cfg.url}/rest/v1/shared_members?ledger_id=eq.${ledgerId}&select=email,role`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${session.accessToken}` } },
  )
  if (!res.ok) return []
  return (await res.json()) as ShareMember[]
}

export async function pushSharedLedger(ledgerId: string, payload: SharePayload, expectedUpdatedAt: string) {
  const session = await authed()
  const cfg = supabaseConfig()
  const res = await fetch(
    `${cfg.url}/rest/v1/shared_ledgers?id=eq.${ledgerId}&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ payload, title: payload.account.name }),
    },
  )
  if (!res.ok) throw new Error('به‌روزرسانی کارت مشترک ناموفق بود')
  const rows = (await res.json()) as SharedLedger[]
  return rows[0] ?? null
}
