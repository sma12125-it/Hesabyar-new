import { deriveOpeningBalance, hydrateAccounts } from '../lib/balance'
import { isoFromTimestamp } from '../lib/iso'
import { createId } from '../lib/ids'
import type { Account, InstallmentItem, InstallmentPlan, Transaction, TxKind } from '../types'

const DB_NAME = 'hesabyar'
const DB_VERSION = 2

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      const tx = req.transaction
      if (!tx) return
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'id' })
        store.createIndex('by_created', 'createdAt')
        store.createIndex('by_account', 'accountId')
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('installmentPlans')) {
        db.createObjectStore('installmentPlans', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('installmentItems')) {
        const store = db.createObjectStore('installmentItems', { keyPath: 'id' })
        store.createIndex('by_plan', 'planId')
      }

      const accStore = tx.objectStore('accounts')
      const txStore = tx.objectStore('transactions')
      accStore.getAll().onsuccess = (ev) => {
        const accounts = (ev.target as IDBRequest<Array<Record<string, unknown>>>).result
        txStore.getAll().onsuccess = (ev2) => {
          const rawTxs = (ev2.target as IDBRequest<Array<Record<string, unknown>>>).result
          migrateSprint1(accStore, txStore, accounts, rawTxs)
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function migrateSprint1(
  accStore: IDBObjectStore,
  txStore: IDBObjectStore,
  accounts: Array<Record<string, unknown>>,
  rawTxs: Array<Record<string, unknown>>,
) {
  const asTx = (row: Record<string, unknown>): Transaction => {
    const kind = row.kind as TxKind | 'transfer'
    const createdAt = typeof row.createdAt === 'number' ? row.createdAt : Date.now()
    return {
      id: String(row.id),
      kind: kind === 'transfer' ? 'transferOut' : (kind as TxKind),
      amount: Number(row.amount) || 0,
      accountId: String(row.accountId),
      counterpartyAccountId: row.counterpartyAccountId ? String(row.counterpartyAccountId) : undefined,
      transferId: row.transferId ? String(row.transferId) : undefined,
      installmentItemId: row.installmentItemId ? String(row.installmentItemId) : undefined,
      categoryId: String(row.categoryId ?? 'other-exp'),
      note: String(row.note ?? ''),
      date: typeof row.date === 'string' ? row.date : isoFromTimestamp(createdAt),
      createdAt,
    }
  }

  const migratedTxs: Transaction[] = []
  for (const row of rawTxs) {
    if (row.kind === 'transfer') {
      const createdAt = typeof row.createdAt === 'number' ? row.createdAt : Date.now()
      const transferId = String(row.transferId ?? createId('tr'))
      const fromId = String(row.accountId)
      const toId = row.counterpartyAccountId ? String(row.counterpartyAccountId) : ''
      const amount = Number(row.amount) || 0
      const date = typeof row.date === 'string' ? row.date : isoFromTimestamp(createdAt)
      const note = String(row.note ?? '')
      const outTx: Transaction = {
        id: String(row.id),
        kind: 'transferOut',
        amount,
        accountId: fromId,
        counterpartyAccountId: toId || undefined,
        transferId,
        categoryId: 'transfer',
        note,
        date,
        createdAt,
      }
      migratedTxs.push(outTx)
      txStore.put(outTx)
      if (toId) {
        const inTx: Transaction = {
          id: createId('tx'),
          kind: 'transferIn',
          amount,
          accountId: toId,
          counterpartyAccountId: fromId,
          transferId,
          categoryId: 'transfer',
          note,
          date,
          createdAt: createdAt + 1,
        }
        migratedTxs.push(inTx)
        txStore.put(inTx)
      }
    } else {
      const next = asTx(row)
      migratedTxs.push(next)
      txStore.put(next)
    }
  }

  for (const row of accounts) {
    const id = String(row.id)
    const storedBalance = typeof row.balance === 'number' ? row.balance : 0
    const openingBalance =
      typeof row.openingBalance === 'number'
        ? row.openingBalance
        : deriveOpeningBalance(storedBalance, migratedTxs, id)
    accStore.put({
      id,
      name: String(row.name ?? ''),
      type: row.type === 'cash' ? 'cash' : 'bank',
      archived: Boolean(row.archived),
      openingBalance,
      createdAt: typeof row.createdAt === 'number' ? row.createdAt : Date.now(),
      updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : Date.now(),
    })
  }
}

export async function getKv<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  const row = await requestToPromise<{ key: string; value: T } | undefined>(
    db.transaction('kv').objectStore('kv').get(key),
  )
  return row?.value
}

export async function setKv<T>(key: string, value: T): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('kv', 'readwrite')
  tx.objectStore('kv').put({ key, value })
  await txDone(tx)
}

function persistableAccount(account: Account): Omit<Account, 'balance'> {
  const { balance: _balance, ...rest } = account
  return rest
}

export async function listRawAccounts(): Promise<Array<Omit<Account, 'balance'> & { balance?: number }>> {
  const db = await openDb()
  return requestToPromise(db.transaction('accounts').objectStore('accounts').getAll())
}

export async function listAccounts(existingTxs?: Transaction[]): Promise<Account[]> {
  const [raw, txs] = await Promise.all([
    listRawAccounts(),
    existingTxs ? Promise.resolve(existingTxs) : listTransactions(),
  ])
  return hydrateAccounts(raw, txs).sort((a, b) => a.createdAt - b.createdAt)
}

export async function getAccount(id: string): Promise<Account | undefined> {
  const accounts = await listAccounts()
  return accounts.find((a) => a.id === id)
}

export async function putAccount(account: Account): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('accounts', 'readwrite')
  tx.objectStore('accounts').put(persistableAccount(account))
  await txDone(tx)
}

export function sortTransactions(rows: Transaction[]): Transaction[] {
  return rows.slice().sort((a, b) => {
    const byDate = b.date.localeCompare(a.date)
    if (byDate !== 0) return byDate
    return b.createdAt - a.createdAt
  })
}

export async function listTransactions(): Promise<Transaction[]> {
  const db = await openDb()
  const rows = await requestToPromise<Transaction[]>(
    db.transaction('transactions').objectStore('transactions').getAll(),
  )
  return sortTransactions(rows)
}

export async function applyDataPatch(patch: {
  putAccounts?: Account[]
  deleteAccountIds?: string[]
  putTransactions?: Transaction[]
  deleteTransactionIds?: string[]
  putPlans?: InstallmentPlan[]
  deletePlanIds?: string[]
  putItems?: InstallmentItem[]
  deleteItemIds?: string[]
}): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(
    ['accounts', 'transactions', 'installmentPlans', 'installmentItems'],
    'readwrite',
  )
  const accStore = tx.objectStore('accounts')
  const txStore = tx.objectStore('transactions')
  const planStore = tx.objectStore('installmentPlans')
  const itemStore = tx.objectStore('installmentItems')
  for (const id of patch.deleteAccountIds ?? []) accStore.delete(id)
  for (const account of patch.putAccounts ?? []) accStore.put(persistableAccount(account))
  for (const id of patch.deleteTransactionIds ?? []) txStore.delete(id)
  for (const row of patch.putTransactions ?? []) txStore.put(row)
  for (const id of patch.deletePlanIds ?? []) planStore.delete(id)
  for (const plan of patch.putPlans ?? []) planStore.put(plan)
  for (const id of patch.deleteItemIds ?? []) itemStore.delete(id)
  for (const item of patch.putItems ?? []) itemStore.put(item)
  await txDone(tx)
}

export async function putTransaction(txRow: Transaction): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('transactions', 'readwrite')
  tx.objectStore('transactions').put(txRow)
  await txDone(tx)
}

export async function putTransactions(rows: Transaction[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('transactions', 'readwrite')
  for (const row of rows) tx.objectStore('transactions').put(row)
  await txDone(tx)
}

export async function listInstallmentPlans(): Promise<InstallmentPlan[]> {
  const db = await openDb()
  const rows = await requestToPromise<InstallmentPlan[]>(
    db.transaction('installmentPlans').objectStore('installmentPlans').getAll(),
  )
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

export async function listInstallmentItems(): Promise<InstallmentItem[]> {
  const db = await openDb()
  const rows = await requestToPromise<InstallmentItem[]>(
    db.transaction('installmentItems').objectStore('installmentItems').getAll(),
  )
  return rows.sort((a, b) => a.index - b.index)
}

export async function putInstallmentPlan(plan: InstallmentPlan): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('installmentPlans', 'readwrite')
  tx.objectStore('installmentPlans').put(plan)
  await txDone(tx)
}

export async function putInstallmentItems(items: InstallmentItem[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('installmentItems', 'readwrite')
  for (const item of items) tx.objectStore('installmentItems').put(item)
  await txDone(tx)
}

export async function deleteInstallmentItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDb()
  const tx = db.transaction('installmentItems', 'readwrite')
  for (const id of ids) tx.objectStore('installmentItems').delete(id)
  await txDone(tx)
}

export async function createInstallmentPlanAtomic(plan: InstallmentPlan, items: InstallmentItem[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['installmentPlans', 'installmentItems'], 'readwrite')
  tx.objectStore('installmentPlans').put(plan)
  const itemStore = tx.objectStore('installmentItems')
  for (const item of items) itemStore.put(item)
  await txDone(tx)
}

export async function replaceInstallmentItemsAtomic(
  plan: InstallmentPlan,
  nextItems: InstallmentItem[],
  removeIds: string[],
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['installmentPlans', 'installmentItems'], 'readwrite')
  tx.objectStore('installmentPlans').put(plan)
  const itemStore = tx.objectStore('installmentItems')
  for (const id of removeIds) itemStore.delete(id)
  for (const item of nextItems) itemStore.put(item)
  await txDone(tx)
}

export async function payInstallmentAtomic(
  expense: Transaction,
  item: InstallmentItem,
  plan: InstallmentPlan,
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['transactions', 'installmentItems', 'installmentPlans'], 'readwrite')
  tx.objectStore('transactions').put(expense)
  tx.objectStore('installmentItems').put(item)
  tx.objectStore('installmentPlans').put(plan)
  await txDone(tx)
}

export async function writeTransferLegs(outTx: Transaction, inTx: Transaction): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('transactions', 'readwrite')
  tx.objectStore('transactions').put(outTx)
  tx.objectStore('transactions').put(inTx)
  await txDone(tx)
}

export async function replaceAllData(
  accounts: Account[],
  transactions: Transaction[],
  plans: InstallmentPlan[] = [],
  items: InstallmentItem[] = [],
): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(
    ['accounts', 'transactions', 'installmentPlans', 'installmentItems'],
    'readwrite',
  )
  tx.objectStore('accounts').clear()
  tx.objectStore('transactions').clear()
  tx.objectStore('installmentPlans').clear()
  tx.objectStore('installmentItems').clear()
  for (const a of accounts) tx.objectStore('accounts').put(persistableAccount(a))
  for (const t of transactions) tx.objectStore('transactions').put(t)
  for (const p of plans) tx.objectStore('installmentPlans').put(p)
  for (const i of items) tx.objectStore('installmentItems').put(i)
  await txDone(tx)
}

export async function clearAllData(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(
    ['accounts', 'transactions', 'installmentPlans', 'installmentItems', 'kv'],
    'readwrite',
  )
  tx.objectStore('accounts').clear()
  tx.objectStore('transactions').clear()
  tx.objectStore('installmentPlans').clear()
  tx.objectStore('installmentItems').clear()
  tx.objectStore('kv').clear()
  await txDone(tx)
}
