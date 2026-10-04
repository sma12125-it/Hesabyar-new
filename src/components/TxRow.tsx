import { memo } from 'react'
import { formatRelativeFromIso } from '../lib/dates'
import { accountIcon, getCategory } from '../lib/categories'
import { useStore } from '../store/Store'
import { actorLabel } from '../lib/actor'
import type { Account, Transaction } from '../types'
import { useExtras } from '../store/Extras'
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
  onSelect,
}: {
  tx: Transaction
  accounts: Account[]
  forAccountId?: string
  onSelect?: (tx: Transaction) => void
}) {
  const actions = useUiActions()
  const { customCategories } = useStore()
  const { formatMoney, unitLabel } = useExtras()
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
      <div
        className="tx-row lg-row"
        onClick={() => {
          if (onSelect) {
            onSelect(tx)
          } else {
            actions?.editTransaction(tx.id)
          }
        }}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
      >
        <div className="tx-ico">{txIcon(tx, customCategories)}</div>
        <div className="tx-meta">
          <div className="tx-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{txTitle(tx, accounts, customCategories)}</span>
            {tx.receiptPhoto ? (
              <span style={{ fontSize: 11 }} title="دارای تصویر رسید">
                🧾
              </span>
            ) : null}
          </div>
          <div className="tx-sub">{subBits.join(' · ')}</div>
          {tx.tags && tx.tags.length > 0 ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
              {tx.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10,
                    color: 'var(--hy-accent)',
                    background: 'rgba(15, 118, 110, 0.1)',
                    borderRadius: 6,
                    padding: '1px 5px',
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className={`tx-amt ${amtClass}`.trim()}>
          {formatMoney(tx.amount, false)}
          <span className="unit">{unitLabel}</span>
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
  const { formatMoney, unitLabel } = useExtras()
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
          {formatMoney(account.balance, false)}
          <span className="unit">{unitLabel}</span>
        </div>
      </button>
    </SwipeRow>
  )
})
