import type { Account, Transaction, TxKind } from '../types'

const INFLOW: ReadonlySet<string> = new Set(['income', 'transferIn'])
const OUTFLOW: ReadonlySet<string> = new Set(['expense', 'transferOut', 'transfer'])

/** Effect of one transaction on an account. Legacy Sprint 1 `transfer` legs are supported. */
export function transactionDelta(tx: Transaction, accountId: string): number {
  const kind = tx.kind as TxKind | 'transfer'
  if (tx.accountId === accountId) {
    if (INFLOW.has(kind)) return tx.amount
    if (OUTFLOW.has(kind)) return -tx.amount
    return 0
  }
  if (kind === 'transfer' && tx.counterpartyAccountId === accountId) {
    return tx.amount
  }
  return 0
}

export function netTransactionDelta(transactions: Transaction[], accountId: string): number {
  let net = 0
  for (const tx of transactions) net += transactionDelta(tx, accountId)
  return net
}

/** openingBalance + income − expense − transferOut + transferIn */
export function computeBalance(openingBalance: number, transactions: Transaction[], accountId: string): number {
  return openingBalance + netTransactionDelta(transactions, accountId)
}

export function withComputedBalance(
  account: Omit<Account, 'balance'> & { balance?: number },
  transactions: Transaction[],
): Account {
  const openingBalance = account.openingBalance
  return {
    ...account,
    openingBalance,
    balance: computeBalance(openingBalance, transactions, account.id),
  }
}

export function deriveOpeningBalance(
  storedBalance: number,
  transactions: Transaction[],
  accountId: string,
): number {
  return storedBalance - netTransactionDelta(transactions, accountId)
}

export function incomeExpenseTotals(transactions: Transaction[]): { income: number; expense: number } {
  let income = 0
  let expense = 0
  for (const tx of transactions) {
    if (tx.kind === 'income') income += tx.amount
    else if (tx.kind === 'expense') expense += tx.amount
  }
  return { income, expense }
}

export function hydrateAccounts(
  accounts: Array<Omit<Account, 'balance'> & { balance?: number; openingBalance?: number }>,
  transactions: Transaction[],
): Account[] {
  return accounts.map((raw) => {
    const opening =
      typeof raw.openingBalance === 'number'
        ? raw.openingBalance
        : deriveOpeningBalance(raw.balance ?? 0, transactions, raw.id)
    return withComputedBalance({ ...raw, openingBalance: opening }, transactions)
  })
}
