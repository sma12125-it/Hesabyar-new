import { describe, expect, it } from 'vitest'
import { computePocketBalances, computeBalance } from '../lib/balance'
import { deletePocketCascade, deleteTransactionCascade } from '../lib/cascade'
import type { Account, AppData, DebtLoan, Pocket, PocketTransfer, Transaction } from '../types'

describe('Pockets (جیب) data model and calculations', () => {
  const account: Account = {
    id: 'acc_1',
    name: 'حساب ملت',
    type: 'bank',
    openingBalance: 10_000_000,
    balance: 10_000_000,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
  }

  const mainPocket: Pocket = {
    id: 'pkt_main',
    accountId: 'acc_1',
    name: 'جیب اصلی',
    isMain: true,
    isOwn: true,
    openingBalance: 6_000_000,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
  }

  const motherPocket: Pocket = {
    id: 'pkt_mother',
    accountId: 'acc_1',
    name: 'سهم مادر',
    isMain: false,
    isOwn: false,
    openingBalance: 4_000_000,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
  }

  it('a pocket transaction moves the account balance normally and shows in the pocket total', () => {
    const pockets = [mainPocket, motherPocket]
    const txs: Transaction[] = [
      // 1. Mother's pocket expense
      {
        id: 'tx_1',
        kind: 'expense',
        amount: 1_000_000,
        accountId: 'acc_1',
        pocketId: 'pkt_mother',
        categoryId: 'food',
        note: 'خرید برای مادر',
        date: '2026-03-01',
        createdAt: 2000,
      },
      // 2. Main pocket income
      {
        id: 'tx_2',
        kind: 'income',
        amount: 2_000_000,
        accountId: 'acc_1',
        pocketId: 'pkt_main',
        categoryId: 'salary',
        note: 'حقوق',
        date: '2026-03-02',
        createdAt: 3000,
      },
    ]

    const transfers: PocketTransfer[] = [
      {
        id: 'pt_1',
        accountId: 'acc_1',
        fromPocketId: 'pkt_main',
        toPocketId: 'pkt_mother',
        amount: 500_000,
        note: 'شارژ سهم مادر',
        date: '2026-03-03',
        createdAt: 4000,
        updatedAt: 4000,
      },
    ]

    const accBalance = computeBalance(account.openingBalance, txs, account.id)
    expect(accBalance).toBe(10_000_000 - 1_000_000 + 2_000_000) // 11,000,000

    const balances = computePocketBalances({ ...account, balance: accBalance }, txs, pockets, transfers)

    // Mother's pocket: 4,000,000 - 1,000,000 (expense) + 500,000 (transfer) = 3,500,000
    expect(balances['pkt_mother']).toBe(3_500_000)

    // Main pocket follows the account balance (pocket choice never changes it) minus the virtual transfer out
    expect(balances['pkt_main']).toBe(11_000_000 - 500_000)

    // The account balance itself is unchanged by pocket choice
    expect(computeBalance(account.openingBalance, txs.map((t) => ({ ...t, pocketId: undefined })), account.id)).toBe(accBalance)
  })

  it('old transactions count toward the main pocket', () => {
    const pockets = [mainPocket, motherPocket]
    const txs: Transaction[] = [
      // Old transaction without pocketId
      {
        id: 'tx_old_1',
        kind: 'expense',
        amount: 1_500_000,
        accountId: 'acc_1',
        categoryId: 'shopping',
        note: 'خرید قدیمی',
        date: '2025-01-01',
        createdAt: 500,
      },
      // Old transaction with empty pocketId
      {
        id: 'tx_old_2',
        kind: 'income',
        amount: 3_000_000,
        accountId: 'acc_1',
        pocketId: undefined,
        categoryId: 'salary',
        note: 'درآمد قدیمی',
        date: '2025-01-02',
        createdAt: 600,
      },
    ]

    const accBalance = computeBalance(account.openingBalance, txs, account.id)
    expect(accBalance).toBe(10_000_000 - 1_500_000 + 3_000_000) // 11,500,000

    const balances = computePocketBalances({ ...account, balance: accBalance }, txs, pockets, [])

    // Mother pocket has no txs, so balance = openingBalance = 4,000,000
    expect(balances['pkt_mother']).toBe(4_000_000)

    // Main pocket equals the account balance, including old transactions
    expect(balances['pkt_main']).toBe(accBalance)
  })

  it('loan creation and repayment linked to non-owned pocket', () => {
    // 1. User spends money from mother's pocket for self (countAsLoan = true)
    const tx: Transaction = {
      id: 'tx_loan_1',
      kind: 'expense',
      amount: 1_200_000,
      accountId: 'acc_1',
      pocketId: 'pkt_mother',
      categoryId: 'food',
      note: 'خرید شخصی از پول مادر',
      date: '2026-03-04',
      createdAt: 5000,
    }

    const linkedLoan: DebtLoan = {
      id: 'loan_1',
      direction: 'borrowed',
      party: motherPocket.name,
      amount: 1_200_000,
      repaidAmount: 0,
      status: 'active',
      pocketId: 'pkt_mother',
      transactionId: tx.id,
      note: 'قرض از جیب سهم مادر',
      createdAt: 5000,
      updatedAt: 5000,
    }

    expect(linkedLoan.status).toBe('active')
    expect(linkedLoan.repaidAmount).toBe(0)

    // 2. Partial repayment
    const repayment1 = 700_000
    const updatedRepaid = (linkedLoan.repaidAmount || 0) + repayment1
    const nextStatus = updatedRepaid >= linkedLoan.amount ? 'settled' : 'active'
    const step1Loan: DebtLoan = {
      ...linkedLoan,
      repaidAmount: updatedRepaid,
      status: nextStatus,
    }

    expect(step1Loan.status).toBe('active')
    expect(step1Loan.repaidAmount).toBe(700_000)

    // 3. Full repayment
    const repayment2 = 500_000
    const finalRepaid = step1Loan.repaidAmount! + repayment2
    const finalStatus = finalRepaid >= step1Loan.amount ? 'settled' : 'active'
    const step2Loan: DebtLoan = {
      ...step1Loan,
      repaidAmount: finalRepaid,
      status: finalStatus,
      settledAt: finalStatus === 'settled' ? '2026-03-05' : undefined,
    }

    expect(step2Loan.status).toBe('settled')
    expect(step2Loan.repaidAmount).toBe(1_200_000)

    // 4. Deleting the original transaction cascades and deletes the linked loan
    const initialData: AppData = {
      accounts: [account],
      transactions: [tx],
      plans: [],
      items: [],
      pockets: [mainPocket, motherPocket],
      debts: [linkedLoan],
    }

    const dataAfterTxDelete = deleteTransactionCascade(tx.id, initialData)
    expect(dataAfterTxDelete.transactions.length).toBe(0)
    expect(dataAfterTxDelete.debts?.length).toBe(0)
  })

  it('deleting a pocket moves transactions and opening balance to main pocket and archives pocket', () => {
    const txMother: Transaction = {
      id: 'tx_m_1',
      kind: 'expense',
      amount: 800_000,
      accountId: 'acc_1',
      pocketId: 'pkt_mother',
      categoryId: 'health',
      note: 'دارو',
      date: '2026-03-01',
      createdAt: 1000,
    }

    const appData: AppData = {
      accounts: [account],
      transactions: [txMother],
      plans: [],
      items: [],
      pockets: [mainPocket, motherPocket],
      pocketTransfers: [],
    }

    // Attempting to delete main pocket throws error
    expect(() => deletePocketCascade('pkt_main', undefined, appData)).toThrow(
      'جیب اصلی قابل حذف نیست',
    )

    // Deleting mother pocket
    const nextData = deletePocketCascade('pkt_mother', undefined, appData)

    // Mother pocket is archived
    const deletedMother = nextData.pockets?.find((p) => p.id === 'pkt_mother')
    expect(deletedMother?.archived).toBe(true)

    // Main pocket absorbed mother pocket's opening balance
    const updatedMain = nextData.pockets?.find((p) => p.id === 'pkt_main')
    expect(updatedMain?.openingBalance).toBe(6_000_000 + 4_000_000) // 10,000,000

    // Transactions were re-targeted to main pocket
    const movedTx = nextData.transactions.find((t) => t.id === 'tx_m_1')
    expect(movedTx?.pocketId).toBe('pkt_main')
  })
})
