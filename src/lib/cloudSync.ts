/**
 * Cloud sync engine: pull → per-row merge → apply locally → push the merged result.
 * LiveSync registers the store accessors; SyncSheet, Settings and sign-out call into it.
 */
import * as db from '../db/db'
import {
  SnapshotConflictError,
  clearCloudDirty,
  cloudDirty,
  ensureSession,
  notifyUser,
  pullSnapshot,
  pushSnapshot,
  withoutSync,
} from './sync'
import { ROW_COLLECTIONS, isSuspiciousRemoval, mergePayload, type MergeReport, type SyncPayload } from './syncMerge'

export interface SyncAccessors {
  /** Live rows of the main store (accounts, transactions, plans, items) and categories. */
  readStore: () => {
    accounts: unknown[]
    transactions: unknown[]
    plans: unknown[]
    items: unknown[]
    pockets?: unknown[]
    pocketTransfers?: unknown[]
    customCategories: unknown[]
  }
  exportExtras: () => Promise<Record<string, unknown>>
  importStore: (data: Record<string, unknown>) => Promise<void>
  importExtras: (data: Record<string, unknown>) => Promise<void>
  deviceId: string
}

let accessors: SyncAccessors | null = null

export function registerSyncAccessors(next: SyncAccessors | null) {
  accessors = next
}

export function syncReady() {
  return accessors !== null
}

const SEEN_KEY = 'hy-cloud-seen'
const BLOCKED_KEY = 'hy-sync-blocked'

export function lastSeenVersion(): number {
  return Number(localStorage.getItem(SEEN_KEY) || 0)
}

function setSeen(version: number) {
  localStorage.setItem(SEEN_KEY, String(version))
}

export interface BlockedInfo {
  at: number
  removed: number
  local: number
  transactions: number
}

export function syncBlocked(): BlockedInfo | null {
  try {
    const raw = localStorage.getItem(BLOCKED_KEY)
    return raw ? (JSON.parse(raw) as BlockedInfo) : null
  } catch {
    return null
  }
}

function setBlocked(info: BlockedInfo | null) {
  if (info) localStorage.setItem(BLOCKED_KEY, JSON.stringify(info))
  else localStorage.removeItem(BLOCKED_KEY)
  window.dispatchEvent(new Event('hy-sync-blocked'))
}

function need(): SyncAccessors {
  if (!accessors) throw new Error('همگام‌سازی هنوز آماده نیست')
  return accessors
}

/** The full local snapshot, including tombstones and scalar edit times. */
export async function buildLocalPayload(): Promise<SyncPayload> {
  const a = need()
  const live = a.readStore()
  const [extras, tombstones, scalarTimes, pockets, pocketTransfers, customCategories] = await Promise.all([
    a.exportExtras(),
    db.getTombstones(),
    db.getScalarTimes(),
    db.getKv<unknown[]>('pockets'),
    db.getKv<unknown[]>('pocketTransfers'),
    db.getKv<unknown[]>('customCategories'),
  ])
  return {
    ...extras,
    accounts: live.accounts,
    transactions: live.transactions,
    plans: live.plans,
    items: live.items,
    pockets: pockets ?? live.pockets ?? [],
    pocketTransfers: pocketTransfers ?? live.pocketTransfers ?? [],
    customCategories: customCategories ?? live.customCategories ?? [],
    tombstones,
    scalarTimes,
    origin: a.deviceId,
  }
}

/** Write a payload into this device as-is (no tombstones, no new stamps). */
export async function applyPayload(payload: SyncPayload): Promise<void> {
  const a = need()
  await withoutSync(() =>
    db.withoutSyncBookkeeping(async () => {
      await a.importStore({
        accounts: payload.accounts ?? [],
        transactions: payload.transactions ?? [],
        plans: payload.plans ?? [],
        items: payload.items ?? [],
        pockets: payload.pockets ?? [],
        pocketTransfers: payload.pocketTransfers ?? [],
        customCategories: payload.customCategories ?? [],
      })
      await a.importExtras(payload as Record<string, unknown>)
      // importLocal skips empty scalars; the arrays above are written as given.
      await db.setTombstones(payload.tombstones ?? {})
      await db.setScalarTimes(payload.scalarTimes ?? {})
    }),
  )
  window.dispatchEvent(new Event('hy-investments-updated'))
  window.dispatchEvent(new Event('hy-debts-updated'))
  window.dispatchEvent(new Event('hy-cheques-updated'))
}

export async function backupNow(reason: string): Promise<db.SyncBackup | null> {
  if (!accessors) return null
  return db.saveBackup(reason, await buildLocalPayload())
}

export interface SyncResult {
  status: 'signed-out' | 'synced' | 'unchanged' | 'blocked'
  report?: MergeReport
}

let chain: Promise<unknown> = Promise.resolve()

/** Run sync steps one at a time so two merges never interleave. */
function serial<T>(run: () => Promise<T>): Promise<T> {
  const next = chain.then(run, run)
  chain = next.catch(() => undefined)
  return next
}

/**
 * One full round: pull, merge per row, apply locally if anything changed, push the merged
 * result if the cloud lacks something. Never pushes without pulling first.
 *
 * @param opts.force run even if nothing seems to have changed
 * @param opts.allowLargeRemoval apply even when the guard would refuse (user confirmed)
 * @param opts.backupReason always take a backup first (manual pull, sign-out)
 */
export function syncNow(
  opts: { force?: boolean; allowLargeRemoval?: boolean; backupReason?: string } = {},
): Promise<SyncResult> {
  return serial(async () => {
    const session = await ensureSession()
    if (!session) return { status: 'signed-out' as const }
    if (opts.backupReason) await backupNow(opts.backupReason)

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const remote = await pullSnapshot<SyncPayload>(session)
      const remoteVersion = remote?.updatedAt ?? 0
      const dirty = cloudDirty()
      if (!opts.force && !dirty && remote && remoteVersion === lastSeenVersion() && attempt === 0) {
        return { status: 'unchanged' as const }
      }

      const local = await buildLocalPayload()
      const { merged, report } = mergePayload(local, remote?.data ?? null)

      if (report.removedCount > 0 && isSuspiciousRemoval(report) && !opts.allowLargeRemoval) {
        if (!syncBlocked()) await backupNow('پیش از حذف گستردهٔ ابر (اعمال نشد)')
        setBlocked({
          at: Date.now(),
          removed: report.removedCount,
          local: report.localCount,
          transactions: report.removedLocal.transactions?.length ?? 0,
        })
        notifyUser(`نسخهٔ ابر ${report.removedCount} ردیف این دستگاه را حذف می‌کرد؛ اعمال نشد. از تنظیمات بررسی کنید`)
        return { status: 'blocked' as const, report }
      }
      if (syncBlocked()) setBlocked(null)

      if (report.changedLocal) {
        if (report.removedCount > 0) await backupNow('پیش از اعمال حذف‌های ابر')
        await applyPayload(merged)
        window.dispatchEvent(new CustomEvent('hy-cloud-updated', { detail: { time: remoteVersion } }))
      }

      if (report.changedRemote || !remote) {
        try {
          const version = await pushSnapshot(
            session,
            { updatedAt: Date.now(), data: { ...merged, origin: need().deviceId } },
            remote ? remoteVersion : null,
          )
          setSeen(version)
        } catch (err) {
          if (err instanceof SnapshotConflictError) continue
          if (!navigator.onLine) throw new Error('اینترنت قطع است. تغییر روی گوشی ماند و با اتصال دوباره به ابر می‌رود')
          throw err
        }
      } else {
        setSeen(remoteVersion)
      }
      clearCloudDirty()
      return { status: report.changedLocal || report.changedRemote ? ('synced' as const) : ('unchanged' as const), report }
    }
    throw new Error('ابر هم‌زمان از دستگاه دیگری تغییر می‌کرد؛ دوباره تلاش می‌شود')
  })
}

/** Replace this device with the cloud copy (user confirmed). A backup is taken first. */
export function replaceWithCloud(): Promise<boolean> {
  return serial(async () => {
    const session = await ensureSession()
    if (!session) throw new Error('برای ذخیرهٔ زنده، از تنظیمات وارد حساب ابری شوید')
    const remote = await pullSnapshot<SyncPayload>(session)
    if (!remote) return false
    await backupNow('پیش از جایگزینی با نسخه ابر')
    await applyPayload(remote.data)
    setSeen(remote.updatedAt)
    setBlocked(null)
    clearCloudDirty()
    return true
  })
}

/**
 * Restore a backup or a backup file. Restored rows are re-stamped as edited now and their
 * tombstones are cleared, so the next merge keeps them instead of deleting them again.
 */
export function restorePayload(source: Record<string, unknown>): Promise<void> {
  return serial(async () => {
    await backupNow('پیش از بازگردانی پشتیبان')
    const now = Date.now()
    const payload: SyncPayload = { ...source }
    const tombs: Record<string, Record<string, number>> = {
      ...((payload.tombstones as Record<string, Record<string, number>>) ?? {}),
    }
    const current = await db.getTombstones()
    for (const [c, ids] of Object.entries(current)) tombs[c] = { ...(ids ?? {}), ...(tombs[c] ?? {}) }
    for (const c of ROW_COLLECTIONS) {
      if (!Array.isArray(payload[c])) continue
      const rows = payload[c] as Array<{ id: string }>
      payload[c] = rows.map((row) => ({ ...row, updatedAt: now }))
      if (tombs[c]) {
        const copy = { ...tombs[c] }
        for (const row of rows) delete copy[row.id]
        tombs[c] = copy
      }
    }
    payload.tombstones = tombs
    if (accessors) {
      // Collections missing from an older backup file keep what this device has.
      const local = await buildLocalPayload()
      for (const c of ROW_COLLECTIONS) if (!Array.isArray(payload[c])) payload[c] = local[c]
    }
    await applyPayload(payload)
    localStorage.setItem('hy-cloud-dirty', '1')
    setBlocked(null)
  }).then(async () => {
    try {
      await syncNow({ force: true, allowLargeRemoval: true })
    } catch {
      // stays dirty; LiveSync retries
    }
  })
}

export async function restoreBackup(id: string): Promise<void> {
  const backup = (await db.listBackups()).find((b) => b.id === id)
  if (!backup) throw new Error('نسخهٔ پشتیبان پیدا نشد')
  await restorePayload(backup.payload)
}

export { isSuspiciousRemoval }
