import type { Account, Pocket, PocketTransfer, Transaction, TxKind } from '../types'

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

/**
 * Computes the running total of each pocket in an account.
 * Pockets are ledgers: choosing a pocket on a transaction does not change the account balance,
 * which still comes only from computeBalance.
 * - Main pocket = the account balance (every transaction moves the main balance) ± virtual transfers.
 * - Other pockets = openingBalance + their own transactions (pocketId) ± virtual transfers.
 * Old transactions without pocketId stay in the main pocket's list.
 */
export function computePocketBalances(
  account: { id: string; balance?: number; openingBalance?: number },
  transactions: Transaction[],
  pockets: Pocket[],
  transfers: PocketTransfer[] = [],
): Record<string, number> {
  const accountPockets = pockets.filter((p) => p.accountId === account.id && !p.archived)
  const result: Record<string, number> = {}
  if (accountPockets.length === 0) return result

  const accountBalance =
    typeof account.balance === 'number'
      ? account.balance
      : computeBalance(account.openingBalance ?? 0, transactions, account.id)

  const nonMainPockets = accountPockets.filter((p) => !p.isMain)
  const mainPocket = accountPockets.find((p) => p.isMain)

  let nonMainSum = 0
  for (const pocket of nonMainPockets) {
    let bal = pocket.openingBalance || 0
    for (const tx of transactions) {
      if (tx.accountId === account.id && tx.pocketId === pocket.id) {
        bal += transactionDelta(tx, account.id)
      }
    }
    for (const tr of transfers) {
      if (tr.accountId !== account.id) continue
      if (tr.toPocketId === pocket.id) bal += tr.amount
      if (tr.fromPocketId === pocket.id) bal -= tr.amount
    }
    result[pocket.id] = bal
    nonMainSum += bal
  }

  if (mainPocket) {
    result[mainPocket.id] = accountBalance - nonMainSum
  }

  return result
}

export interface PocketSummary {
  pocketId: string
  name: string
  isMain: boolean
  isOwn: boolean
  allocatedBalance: number
  totalExpense: number
  totalIncome: number
  netDelta: number
  balance: number
}

export function computePocketBreakdowns(
  account: { id: string; balance?: number; openingBalance?: number },
  transactions: Transaction[],
  pockets: Pocket[],
  transfers: PocketTransfer[] = [],
): Record<string, PocketSummary> {
  const accountPockets = pockets.filter((p) => p.accountId === account.id && !p.archived)
  const result: Record<string, PocketSummary> = {}
  if (accountPockets.length === 0) return result

  const balances = computePocketBalances(account, transactions, pockets, transfers)

  for (const p of accountPockets) {
    let exp = 0
    let inc = 0
    let allocated = p.openingBalance || 0

    for (const tr of transfers) {
      if (tr.accountId !== account.id) continue
      if (tr.toPocketId === p.id) allocated += tr.amount
      if (tr.fromPocketId === p.id) allocated -= tr.amount
    }

    for (const tx of transactions) {
      if (tx.accountId === account.id && tx.pocketId === p.id) {
        if (tx.kind === 'expense') exp += tx.amount
        else if (tx.kind === 'income') inc += tx.amount
      }
    }

    result[p.id] = {
      pocketId: p.id,
      name: p.name,
      isMain: Boolean(p.isMain),
      isOwn: Boolean(p.isOwn),
      allocatedBalance: allocated,
      totalExpense: exp,
      totalIncome: inc,
      netDelta: inc - exp,
      balance: balances[p.id] ?? 0,
    }
  }

  return result
}

