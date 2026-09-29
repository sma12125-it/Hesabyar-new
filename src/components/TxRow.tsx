import { memo } from 'react'
import { formatRelativeFromIso } from '../lib/dates'
import { accountIcon, getCategory } from '../lib/categories'
import { useStore } from '../store/Store'
import { actorLabel } from '../lib/actor'
import { formatRial } from '../lib/money'
import type { Account, Transaction } from '../types'
import { SwipeRow } from './SwipeRow'
import { useUiActions } from './UiActions'

export function txTitle(tx: Transaction, accounts: Account[], categories: Parameters<typeof getCategory>[1] = []): string {
  if (tx.kind === 'transferOut' || tx.kind === 'transferIn') {
    if (tx.note) return tx.note
    if (tx.kind === 'transferIn') {
      const from = accounts.find((a) => a.id === tx.counterpartyAccountId)
      return from ? `انتقال از ${from.name}` : 'انتقال'
    }
    const to = accounts.find((a) => a.id === tx.counterpartyAccountId)
    return to ? `انتقال به ${to.name}` : 'انتقال'
  }
  if (tx.note) return tx.note
  return getCategory(tx.categoryId, categories)?.name ?? 'تراکنش'
}

export function txIcon(tx: Transaction, categories: Parameters<typeof getCategory>[1] = []): string {
  if (tx.kind === 'transferOut' || tx.kind === 'transferIn') return '⇄'
  return getCategory(tx.categoryId, categories)?.icon ?? '💳'
}

export function isTransferKind(kind: Transaction['kind']): boolean {
  return kind === 'transferOut' || kind === 'transferIn'
}

/** Home / all-tx hide the inbound leg so a transfer appears once. */
export function visibleLedger(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => tx.kind !== 'transferIn')
}

export const TxRow = memo(function TxRow({
  tx,
  accounts,
  forAccountId,
}: {
  tx: Transaction
  accounts: Account[]
  forAccountId?: string
}) {
  const actions = useUiActions()
  const { customCategories } = useStore()
  const account = accounts.find((a) => a.id === tx.accountId)
  const amtClass = tx.kind === 'income' ? 'income' : tx.kind === 'expense' ? 'expense' : ''
  const subBits = [formatRelativeFromIso(tx.date)]
  if (!forAccountId && account) subBits.push(account.name)
  if (forAccountId && isTransferKind(tx.kind)) {
    const otherId = tx.counterpartyAccountId
    const other = accounts.find((a) => a.id === otherId)
    if (other) subBits.push(other.name)
  }
  const who = actorLabel(tx.actorEmail)
  if (who) subBits.push(`ثبت ${who}`)
  if (tx.source === 'sms') subBits.push('پیامک')

  return (
    <SwipeRow
      onEdit={actions ? () => actions.editTransaction(tx.id) : undefined}
      onDelete={actions ? () => actions.deleteTransaction(tx.id) : undefined}
    >
      <div className="tx-row lg-row">
        <div className="tx-ico">{txIcon(tx, customCategories)}</div>
        <div className="tx-meta">
          <div className="tx-title">{txTitle(tx, accounts, customCategories)}</div>
          <div className="tx-sub">{subBits.join(' · ')}</div>
        </div>
        <div className={`tx-amt ${amtClass}`.trim()}>
          {formatRial(tx.amount)}
          <span className="unit">ریال</span>
        </div>
      </div>
    </SwipeRow>
  )
})

export const AccountRow = memo(function AccountRow({
  account,
  onClick,
}: {
  account: Account
  onClick: () => void
}) {
  const actions = useUiActions()
  const canSwipe = !account.archived && Boolean(actions)

  return (
    <SwipeRow
      onEdit={canSwipe ? () => actions!.editAccount(account.id) : undefined}
      onDelete={canSwipe ? () => actions!.deleteAccount(account.id) : undefined}
    >
      <button className="acct-row lg-row" type="button" onClick={onClick}>
        <div className="acct-ico">{accountIcon(account.type, account.name)}</div>
        <div className="acct-meta">
          <div className="acct-name">{account.name}</div>
          <span className={`badge ${account.type}`}>{account.type === 'cash' ? 'نقد' : 'بانک'}</span>
          {account.shareId ? <span className="badge bank">مشترک</span> : null}
        </div>
        <div className="acct-bal">
          {formatRial(account.balance)}
          <span className="unit">ریال</span>
        </div>
      </button>
    </SwipeRow>
  )
})
