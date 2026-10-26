/**
 * Per-row merge for the cloud snapshot.
 *
 * Rules:
 * - Union by id: a row is never dropped only because the other copy lacks it.
 * - When both copies have a row, the newer `updatedAt` (falling back to `createdAt`, then 0) wins.
 *   Exact ties are broken deterministically so every device converges on the same row.
 * - Deletions travel as tombstones `{ [collection]: { [id]: deletedAt } }`.
 *   A tombstone beats a row whose time is older or equal; a row edited after the delete comes back.
 * - Tombstones older than 90 days are purged.
 * - Rows that carry their own `deletedAt` are treated as tombstones too.
 */

export const ROW_COLLECTIONS = [
  'accounts',
  'transactions',
  'plans',
  'items',
  'pockets',
  'pocketTransfers',
  'customCategories',
  'budgets',
  'goals',
  'investments',
  'dongEvents',
  'cheques',
  'debts',
] as const

export type RowCollection = (typeof ROW_COLLECTIONS)[number]

export const SCALAR_KEYS = ['reminders', 'currencyUnit', 'cardVault'] as const
export type ScalarKey = (typeof SCALAR_KEYS)[number]

export type Tombstones = Partial<Record<string, Record<string, number>>>
export type ScalarTimes = Partial<Record<string, number>>

export const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

export interface SyncPayload {
  [key: string]: unknown
  tombstones?: Tombstones
  scalarTimes?: ScalarTimes
  origin?: string
}

type Row = { id: string; createdAt?: unknown; updatedAt?: unknown; deletedAt?: unknown }

function toTime(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isFinite(n) && value.trim() !== '') return n
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function rowTime(row: Row): number {
  return toTime(row.updatedAt) || toTime(row.createdAt) || 0
}

function asRows(list: unknown): Row[] {
  if (!Array.isArray(list)) return []
  return list.filter((row): row is Row => !!row && typeof row === 'object' && typeof (row as Row).id === 'string' && (row as Row).id !== '')
}

function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.keys(v as object)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = (v as Record<string, unknown>)[k]
            return acc
          }, {})
      : v,
  )
}

/** Merge two tombstone maps (max deletedAt per id) and drop ones older than the TTL. */
export function mergeTombstones(a: Tombstones | undefined, b: Tombstones | undefined, now = Date.now()): Tombstones {
  const out: Tombstones = {}
  for (const source of [a, b]) {
    if (!source || typeof source !== 'object') continue
    for (const [collection, ids] of Object.entries(source)) {
      if (!ids || typeof ids !== 'object') continue
      const target = (out[collection] ??= {})
      for (const [id, at] of Object.entries(ids)) {
        const t = toTime(at)
        if (!t || now - t > TOMBSTONE_TTL_MS) continue
        if (!target[id] || target[id] < t) target[id] = t
      }
    }
  }
  return out
}

/** Pull row-level `deletedAt` markers out into the tombstone map. */
function extractRowTombstones(rows: Row[], into: Record<string, number>): Row[] {
  const live: Row[] = []
  for (const row of rows) {
    const d = toTime(row.deletedAt)
    if (d) {
      if (!into[row.id] || into[row.id] < d) into[row.id] = d
    } else live.push(row)
  }
  return live
}

/**
 * Merge one collection. Returns live rows only; tombstones are updated in place
 * (a row newer than its tombstone clears the tombstone).
 */
export function mergeRows<T>(local: unknown, remote: unknown, tombs: Record<string, number> = {}): T[] {
  const localRows = extractRowTombstones(asRows(local), tombs)
  const remoteRows = extractRowTombstones(asRows(remote), tombs)
  const order: string[] = []
  const picked = new Map<string, Row>()
  const consider = (row: Row) => {
    const current = picked.get(row.id)
    if (!current) {
      picked.set(row.id, row)
      order.push(row.id)
      return
    }
    const a = rowTime(current)
    const b = rowTime(row)
    if (b > a || (b === a && stable(row) > stable(current))) picked.set(row.id, row)
  }
  localRows.forEach(consider)
  remoteRows.forEach(consider)
  const out: T[] = []
  for (const id of order) {
    const row = picked.get(id)!
    const deletedAt = tombs[id]
    if (deletedAt && deletedAt >= rowTime(row)) continue
    if (deletedAt) delete tombs[id]
    out.push(row as T)
  }
  return out
}

export interface MergeReport {
  /** Local rows that the merged result no longer has, per collection. */
  removedLocal: Record<string, string[]>
  removedCount: number
  localCount: number
  /** True when the merged result differs from the local copy. */
  changedLocal: boolean
  /** True when the merged result differs from the remote copy. */
  changedRemote: boolean
}

function signature(payload: SyncPayload): string {
  const parts: string[] = []
  for (const c of ROW_COLLECTIONS) {
    const rows = asRows(payload[c])
      .map((r) => `${r.id}@${rowTime(r)}`)
      .sort()
    parts.push(`${c}:${rows.join(',')}`)
  }
  const tombs = payload.tombstones ?? {}
  parts.push(
    'T:' +
      Object.keys(tombs)
        .sort()
        .map((c) => `${c}=${Object.keys(tombs[c] ?? {}).sort().join(',')}`)
        .join(';'),
  )
  for (const k of SCALAR_KEYS) parts.push(`${k}:${stable(payload[k] ?? null)}`)
  return parts.join('|')
}

export function payloadsEqual(a: SyncPayload, b: SyncPayload): boolean {
  return signature(a) === signature(b)
}

/** Merge a full local snapshot with a remote one. Pure; does not mutate inputs. */
export function mergePayload(
  local: SyncPayload,
  remote: SyncPayload | null | undefined,
  now = Date.now(),
): { merged: SyncPayload; report: MergeReport } {
  const remoteData: SyncPayload = remote ?? {}
  const tombstones = mergeTombstones(local.tombstones, remoteData.tombstones, now)
  const merged: SyncPayload = { ...remoteData, ...local }
  const removedLocal: Record<string, string[]> = {}
  let removedCount = 0
  let localCount = 0

  for (const c of ROW_COLLECTIONS) {
    const tombs = (tombstones[c] ??= {})
    const rows = mergeRows<Row>(local[c], remoteData[c], tombs)
    merged[c] = rows
    const keep = new Set(rows.map((r) => r.id))
    const localRows = asRows(local[c]).filter((r) => !toTime(r.deletedAt))
    localCount += localRows.length
    const gone = localRows.filter((r) => !keep.has(r.id)).map((r) => r.id)
    if (gone.length) {
      removedLocal[c] = gone
      removedCount += gone.length
    }
    if (Object.keys(tombs).length === 0) delete tombstones[c]
  }
  merged.tombstones = tombstones

  const localTimes = local.scalarTimes ?? {}
  const remoteTimes = remoteData.scalarTimes ?? {}
  const scalarTimes: ScalarTimes = { ...remoteTimes, ...localTimes }
  for (const k of SCALAR_KEYS) {
    const lt = toTime(localTimes[k])
    const rt = toTime(remoteTimes[k])
    const lv = local[k]
    const rv = remoteData[k]
    let useRemote: boolean
    if (lv === undefined || lv === null) useRemote = rv !== undefined && rv !== null
    else if (rv === undefined || rv === null) useRemote = false
    else useRemote = rt > lt
    merged[k] = useRemote ? rv : lv
    scalarTimes[k] = Math.max(lt, rt) || undefined
  }
  merged.scalarTimes = scalarTimes

  const report: MergeReport = {
    removedLocal,
    removedCount,
    localCount,
    changedLocal: !payloadsEqual(merged, local),
    changedRemote: !remote || !payloadsEqual(merged, remoteData),
  }
  return { merged, report }
}

/**
 * Safety guard: refuse to apply a merge that would remove many local rows at once.
 * Small deletions (a few rows) always go through.
 */
export function isSuspiciousRemoval(report: MergeReport, opts = { minRows: 10, ratio: 0.2 }): boolean {
  if (report.removedCount < opts.minRows) return false
  return report.removedCount > Math.max(1, report.localCount) * opts.ratio
}

/** Stamp `updatedAt` on rows that changed between two versions of a list (ignoring the stamp itself). */
export function stampChanged<T extends { id: string }>(
  prev: readonly T[] | undefined,
  next: readonly T[],
  now = Date.now(),
  ignore: string[] = [],
): T[] {
  const before = new Map((prev ?? []).map((row) => [row.id, row]))
  const strip = (row: T) => {
    const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) }
    delete copy.updatedAt
    for (const key of ignore) delete copy[key]
    return stable(copy)
  }
  return next.map((row) => {
    const prior = before.get(row.id)
    const r = row as T & { updatedAt?: number }
    if (!prior) return typeof r.updatedAt === 'number' ? row : ({ ...row, updatedAt: now } as T)
    if (strip(prior) === strip(row)) {
      const priorTime = (prior as T & { updatedAt?: number }).updatedAt
      return r.updatedAt === priorTime ? row : ({ ...row, updatedAt: priorTime } as T)
    }
    const priorTime = toTime((prior as T & { updatedAt?: number }).updatedAt)
    if (typeof r.updatedAt === 'number' && r.updatedAt > priorTime) return row
    return { ...row, updatedAt: Math.max(now, priorTime + 1) } as T
  })
}
