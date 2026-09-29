import { useEffect, useRef } from 'react'
import { notifyUser, onLocalChange, loadSession } from '../lib/sync'
import {
  claimSharedInvites,
  listSharedLedgers,
  mergeShare,
  pushSharedLedger,
  rememberShareIds,
  seenShareIds,
  shareAccountFrom,
  type SharePayload,
  type SharedLedger,
} from '../lib/share'
import { readLiveStore, useStore } from '../store/Store'

function asPayload(raw: SharePayload | null | undefined): SharePayload | null {
  if (!raw?.account?.id) return null
  return {
    account: raw.account,
    transactions: raw.transactions ?? [],
    deletedIds: raw.deletedIds ?? [],
  }
}

function samePayload(a: SharePayload, b: SharePayload) {
  if (a.account.name !== b.account.name || a.account.type !== b.account.type) return false
  if (a.account.openingBalance !== b.account.openingBalance || a.account.archived !== b.account.archived) return false
  const stamp = (rows: SharePayload['transactions']) =>
    rows
      .map((tx) => `${tx.id}:${tx.updatedAt ?? tx.createdAt}:${tx.amount}:${tx.note}:${tx.date}:${tx.kind}:${tx.actorEmail ?? ''}`)
      .sort()
      .join('|')
  const deleted = (ids: string[]) => [...ids].sort().join('|')
  return stamp(a.transactions) === stamp(b.transactions) && deleted(a.deletedIds) === deleted(b.deletedIds)
}

export function SharedSync() {
  const { applyShared } = useStore()
  const applyRef = useRef(applyShared)
  applyRef.current = applyShared

  useEffect(() => {
    let closed = false
    let timer = 0
    let pushing = false

    async function syncLedger(ledger: SharedLedger, attempt = 0): Promise<void> {
      const remote = asPayload(ledger.payload)
      const live = readLiveStore()
      const account = live.accounts.find((row) => row.shareId === ledger.id || row.id === ledger.account_id)
      if (!account || !remote) {
        if (remote) {
          const had = live.accounts.some((row) => row.id === remote.account.id)
          await applyRef.current(ledger.id, remote)
          rememberShareIds(ledger.id, remote.transactions.map((tx) => tx.id))
          if (!had) notifyUser(`کارت مشترک «${remote.account.name}» اضافه شد`)
        }
        return
      }
      const localTxs = live.transactions.filter((tx) => tx.accountId === account.id)
      const seen = new Set(seenShareIds(ledger.id))
      const localIds = new Set(localTxs.map((tx) => tx.id))
      const deletedIds = [...seen].filter((id) => !localIds.has(id))
      const merged = mergeShare(remote, {
        account: { ...shareAccountFrom(account), shareId: ledger.id },
        transactions: localTxs,
        deletedIds,
      })
      let nextRemote = ledger
      if (!samePayload(merged, remote)) {
        const written = await pushSharedLedger(ledger.id, merged, ledger.updated_at)
        if (!written) {
          if (attempt >= 2 || closed) return
          const fresh = (await listSharedLedgers()).find((row) => row.id === ledger.id)
          if (fresh) await syncLedger(fresh, attempt + 1)
          return
        }
        nextRemote = written
      }
      const before = new Set(localTxs.map((tx) => tx.id))
      const arrived = merged.transactions.some((tx) => !before.has(tx.id))
      await applyRef.current(ledger.id, asPayload(nextRemote.payload) ?? merged)
      rememberShareIds(ledger.id, merged.transactions.map((tx) => tx.id))
      if (arrived) notifyUser('تراکنش تازه روی کارت مشترک ثبت شد')
    }

    async function run() {
      if (pushing || closed || !loadSession()) return
      pushing = true
      try {
        await claimSharedInvites()
        const ledgers = await listSharedLedgers()
        for (const ledger of ledgers) {
          if (closed) return
          await syncLedger(ledger)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'همگام‌سازی کارت مشترک ناموفق بود'
        if (!message.includes('وارد حساب ابری')) notifyUser(message)
      } finally {
        pushing = false
      }
    }

    function schedule() {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void run()
      }, 500)
    }

    const stop = onLocalChange(schedule)
    const onRefresh = () => schedule()
    window.addEventListener('hy-share-refresh', onRefresh)
    window.addEventListener('hy-cloud-session', onRefresh)
    const poll = window.setInterval(() => {
      void run()
    }, 5000)
    schedule()
    return () => {
      closed = true
      window.clearTimeout(timer)
      window.clearInterval(poll)
      stop()
      window.removeEventListener('hy-share-refresh', onRefresh)
      window.removeEventListener('hy-cloud-session', onRefresh)
    }
  }, [])

  return null
}
