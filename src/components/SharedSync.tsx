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
import { fetchIncomingShares, getStableUserId, type IncomingSharedAsset } from '../lib/userShare'
import { useExtras } from '../store/Extras'
import { readLiveStore, useStore } from '../store/Store'
import type { Cheque, DebtLoan, InstallmentItem, InstallmentPlan } from '../types'

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

function buildSharedInstallment(share: IncomingSharedAsset, existingPlan: InstallmentPlan | undefined, myId: string): { plan: InstallmentPlan; items: InstallmentItem[] } {
  const details = share.assetDetails ?? {}
  const targetPlanId = existingPlan?.id ?? `shared_plan_${share.id}`
  const rawItems = Array.isArray(details.items) ? details.items : []
  const items: InstallmentItem[] = rawItems.map((it, idx) => ({
    id: `${targetPlanId}_i_${it.index ?? idx + 1}`,
    planId: targetPlanId,
    index: Number(it.index ?? idx + 1),
    dueDate: String(it.dueDate ?? ''),
    amount: Number(it.amount ?? details.installmentAmount ?? 0),
    status: it.status === 'paid' || it.status === 'overdue' ? it.status : 'pending',
    paidAt: typeof it.paidAt === 'string' ? it.paidAt : undefined,
  }))
  const statusRaw = details.status
  const status: InstallmentPlan['status'] =
    statusRaw === 'completed' || statusRaw === 'archived' ? statusRaw : 'active'
  const plan: InstallmentPlan = {
    id: targetPlanId,
    name: String(details.name || share.assetName || 'برنامه اقساط مشترک'),
    installmentAmount: Number(details.installmentAmount ?? items[0]?.amount ?? 0),
    totalCount: Number(details.totalCount ?? items.length),
    startDate: String(details.startDate ?? items[0]?.dueDate ?? ''),
    categoryId: 'installments',
    status,
    kind: details.kind === 'loan' ? 'loan' : 'fixed',
    principal: typeof details.principal === 'number' ? details.principal : undefined,
    annualRatePercent: typeof details.annualRatePercent === 'number' ? details.annualRatePercent : undefined,
    createdAt: existingPlan?.createdAt ?? (Date.parse(share.sharedAt) || Date.now()),
    updatedAt: typeof details.updatedAt === 'number' ? details.updatedAt : (Date.parse(share.updatedAt || share.sharedAt) || Date.now()),
    shareId: share.id,
    isShared: true,
    ownerDisplayName: share.ownerDisplayName || `کاربر ${share.ownerUserId}`,
    ownerUserId: share.ownerUserId,
    recipientUserId: myId,
    sourceAssetId: share.assetId,
  }
  return { plan, items }
}

function buildSharedDebt(share: IncomingSharedAsset, existingDebt: DebtLoan | undefined, myId: string): DebtLoan {
  const details = share.assetDetails ?? {}
  return {
    id: existingDebt?.id ?? `shared_debt_${share.id}`,
    direction: details.direction === 'lent' ? 'lent' : 'borrowed',
    party: String(details.party || share.assetName || 'طرف حساب'),
    amount: Number(details.amount ?? 0),
    dueDate: typeof details.dueDate === 'string' && details.dueDate ? details.dueDate : undefined,
    note: typeof details.note === 'string' ? details.note : '',
    status: details.status === 'settled' ? 'settled' : 'active',
    settledAt: typeof details.settledAt === 'string' ? details.settledAt : undefined,
    repaidAmount: typeof details.repaidAmount === 'number' ? details.repaidAmount : undefined,
    createdAt: existingDebt?.createdAt ?? (Date.parse(share.sharedAt) || Date.now()),
    updatedAt: typeof details.updatedAt === 'number' ? details.updatedAt : (Date.parse(share.updatedAt || share.sharedAt) || Date.now()),
    shareId: share.id,
    isShared: true,
    ownerDisplayName: share.ownerDisplayName || `کاربر ${share.ownerUserId}`,
    ownerUserId: share.ownerUserId,
    recipientUserId: myId,
    sourceAssetId: share.assetId,
  }
}

function buildSharedCheque(share: IncomingSharedAsset, existingCheque: Cheque | undefined, myId: string): Cheque {
  const details = share.assetDetails ?? {}
  const statusRaw = details.status
  const status: Cheque['status'] = statusRaw === 'cleared' || statusRaw === 'bounced' ? statusRaw : 'pending'
  return {
    id: existingCheque?.id ?? `shared_cheque_${share.id}`,
    direction: details.direction === 'receivable' ? 'receivable' : 'payable',
    sayadId: String(details.sayadId ?? ''),
    bankName: String(details.bankName || 'بانک'),
    amount: Number(details.amount ?? 0),
    dueDate: String(details.dueDate ?? ''),
    party: String(details.party || share.assetName || 'طرف حساب'),
    status,
    note: typeof details.note === 'string' ? details.note : '',
    clearedAt: typeof details.clearedAt === 'string' ? details.clearedAt : undefined,
    createdAt: existingCheque?.createdAt ?? (Date.parse(share.sharedAt) || Date.now()),
    updatedAt: typeof details.updatedAt === 'number' ? details.updatedAt : (Date.parse(share.updatedAt || share.sharedAt) || Date.now()),
    shareId: share.id,
    isShared: true,
    ownerDisplayName: share.ownerDisplayName || `کاربر ${share.ownerUserId}`,
    ownerUserId: share.ownerUserId,
    recipientUserId: myId,
    sourceAssetId: share.assetId,
  }
}

export function SharedSync() {
  const { applyShared, upsertSharedInstallmentPlan } = useStore()
  const extras = useExtras()
  const applyRef = useRef(applyShared)
  applyRef.current = applyShared
  const upsertPlanRef = useRef(upsertSharedInstallmentPlan)
  upsertPlanRef.current = upsertSharedInstallmentPlan
  const extrasRef = useRef(extras)
  extrasRef.current = extras

  useEffect(() => {
    let closed = false
    let timer = 0
    let pushing = false
    let syncingShares = false

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

    async function syncIncomingShareAssets() {
      if (syncingShares || closed) return
      syncingShares = true
      try {
        const shares = await fetchIncomingShares()
        if (closed || !shares.length) return
        const myId = getStableUserId()
        const live = readLiveStore()
        const currentExtras = extrasRef.current

        for (const share of shares) {
          if (closed) return
          if (share.status !== 'accepted') continue
          if (share.ownerUserId && share.ownerUserId.trim().toLowerCase() === myId.trim().toLowerCase()) continue

          if (share.assetKind === 'card') {
            const existingCard = currentExtras.cards.find(
              (c) => c.shareId === share.id || c.sourceAssetId === share.assetId,
            )
            if (existingCard) {
              const d = share.assetDetails ?? {}
              const nextBank = `${share.assetName || d.bankName || existingCard.bankName} (مشترک)`.replace(/ \(مشترک\) \(مشترک\)$/, ' (مشترک)')
              const nextHolder = d.holder || existingCard.holder
              const nextPan = d.pan ?? existingCard.pan
              const nextSheba = d.sheba ?? existingCard.sheba
              const nextExpiry = d.expiry ?? existingCard.expiry
              if (
                existingCard.bankName !== nextBank ||
                existingCard.holder !== nextHolder ||
                existingCard.pan !== nextPan ||
                existingCard.sheba !== nextSheba ||
                existingCard.expiry !== nextExpiry
              ) {
                await currentExtras.saveSharedCard({
                  ...existingCard,
                  bankName: nextBank,
                  holder: nextHolder,
                  pan: nextPan,
                  sheba: nextSheba,
                  expiry: nextExpiry,
                  ownerDisplayName: share.ownerDisplayName || existingCard.ownerDisplayName,
                })
              }
            }
          } else if (share.assetKind === 'installment') {
            const existingPlan = live.plans.find(
              (p) => p.shareId === share.id || p.sourceAssetId === share.assetId,
            )
            if (existingPlan) {
              const built = buildSharedInstallment(share, existingPlan, myId)
              await upsertPlanRef.current(built)
            }
          } else if (share.assetKind === 'debt') {
            const existingDebt = currentExtras.debts.find(
              (d) => d.shareId === share.id || d.sourceAssetId === share.assetId,
            )
            if (existingDebt) {
              const built = buildSharedDebt(share, existingDebt, myId)
              if (
                existingDebt.party !== built.party ||
                existingDebt.amount !== built.amount ||
                existingDebt.status !== built.status ||
                existingDebt.settledAt !== built.settledAt ||
                existingDebt.dueDate !== built.dueDate ||
                existingDebt.note !== built.note ||
                existingDebt.direction !== built.direction
              ) {
                await currentExtras.upsertSharedDebt(built)
              }
            }
          } else if (share.assetKind === 'cheque') {
            const existingCheque = currentExtras.cheques.find(
              (c) => c.shareId === share.id || c.sourceAssetId === share.assetId,
            )
            if (existingCheque) {
              const built = buildSharedCheque(share, existingCheque, myId)
              if (
                existingCheque.party !== built.party ||
                existingCheque.amount !== built.amount ||
                existingCheque.status !== built.status ||
                existingCheque.clearedAt !== built.clearedAt ||
                existingCheque.dueDate !== built.dueDate ||
                existingCheque.sayadId !== built.sayadId ||
                existingCheque.bankName !== built.bankName ||
                existingCheque.note !== built.note ||
                existingCheque.direction !== built.direction
              ) {
                await currentExtras.upsertSharedCheque(built)
              }
            }
          }
        }
      } catch {
        // Non-fatal background sync error
      } finally {
        syncingShares = false
      }
    }

    async function run() {
      void syncIncomingShareAssets()
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
    const onAssetsUpdated = () => {
      void syncIncomingShareAssets()
    }
    window.addEventListener('hy-share-refresh', onRefresh)
    window.addEventListener('hy-cloud-session', onRefresh)
    window.addEventListener('hy-share-assets-updated', onAssetsUpdated)
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
      window.removeEventListener('hy-share-assets-updated', onAssetsUpdated)
    }
  }, [])

  return null
}
