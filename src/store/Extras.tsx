import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as db from '../db/db'
import { checkPasswordVerifier, generateRecoveryCode, rememberedAccountPassword } from '../lib/account'
import { loadSession, signIn } from '../lib/sync'
import { openCards, sealCards, unwrapText, validateCard, wrapText } from '../lib/vault'
import { createId } from '../lib/ids'
import { digitsOnly, toFaDigits } from '../lib/money'
import { addDaysIso, todayIso } from '../lib/iso'
import type { BankCard, Budget, Cheque, ChequeStatus, CurrencyUnit, DebtLoan, DongEvent, InvestmentAsset, ReminderSettings, SavingsGoal } from '../types'

interface VaultBlob {
  salt: string
  payload: string
  accountWrap?: string
  recoveryWrap?: string
}

interface ExtrasValue {
  unlocked: boolean
  cards: BankCard[]
  budgets: Budget[]
  goals: SavingsGoal[]
  investments: InvestmentAsset[]
  dongEvents: DongEvent[]
  cheques: Cheque[]
  debts: DebtLoan[]
  reminders: ReminderSettings
  currencyUnit: CurrencyUnit
  unitLabel: string
  setCurrencyUnit: (unit: CurrencyUnit) => Promise<void>
  formatMoney: (amountInRials: number, withUnit?: boolean) => string
  formatCompactMoney: (amountInRials: number) => string
  vaultConfigured: boolean
  unlockVault: (passphrase: string) => Promise<void>
  lockVault: () => void
  setVaultPassword: (passphrase: string, accountPassword?: string) => Promise<string>
  changeVaultPassword: (current: string, next: string, accountPassword?: string) => Promise<string>
  recoverVaultPassword: (secret: string, mode: 'account' | 'code', next: string) => Promise<string>
  resetVault: (passphrase: string, accountPassword?: string) => Promise<string>
  clearLocal: () => Promise<void>
  saveCard: (input: Omit<BankCard, 'id' | 'createdAt'> & { id?: string }, passphrase?: string) => Promise<BankCard>
  linkCard: (id: string, accountId: string) => Promise<void>
  deleteCard: (id: string, passphrase: string) => Promise<void>
  saveBudget: (budget: Budget) => Promise<void>
  deleteBudget: (id: string) => Promise<void>
  saveGoal: (goal: Omit<SavingsGoal, 'id'> & { id?: string }) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  saveInvestment: (asset: Omit<InvestmentAsset, 'id' | 'createdAt'> & { id?: string }) => Promise<InvestmentAsset>
  deleteInvestment: (id: string) => Promise<void>
  saveDongEvent: (event: Omit<DongEvent, 'id' | 'createdAt'> & { id?: string }) => Promise<DongEvent>
  deleteDongEvent: (id: string) => Promise<void>
  saveCheque: (cheque: Omit<Cheque, 'id' | 'createdAt'> & { id?: string }) => Promise<Cheque>
  deleteCheque: (id: string) => Promise<void>
  updateChequeStatus: (id: string, status: ChequeStatus, clearedDate?: string) => Promise<void>
  saveDebt: (debt: Omit<DebtLoan, 'id' | 'createdAt'> & { id?: string }) => Promise<DebtLoan>
  deleteDebt: (id: string) => Promise<void>
  settleDebt: (id: string, accountId?: string) => Promise<void>
  unsettleDebt: (id: string) => Promise<void>
  setReminders: (next: ReminderSettings) => Promise<void>
  exportLocal: () => Promise<Record<string, unknown>>
  importLocal: (data: Record<string, unknown>) => Promise<void>
}

const ExtrasContext = createContext<ExtrasValue | null>(null)
const emptyReminder: ReminderSettings = { enabled: false, leadDays: 2 }

function compactDigits(value: number): string {
  const rounded = Math.round(value * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return toFaDigits(text).replace('.', '\u066b')
}

export function ExtrasProvider({ children }: { children: ReactNode }) {
  const [blob, setBlob] = useState<VaultBlob | null>(null)
  const blobRef = useRef<VaultBlob | null>(null)
  blobRef.current = blob
  const [passphrase, setPassphrase] = useState<string | null>(null)
  const passphraseRef = useRef<string | null>(null)
  passphraseRef.current = passphrase
  const cardsRef = useRef<BankCard[]>([])
  const [cards, setCards] = useState<BankCard[]>([])
  cardsRef.current = cards
  const budgetsRef = useRef<Budget[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  budgetsRef.current = budgets
  const goalsRef = useRef<SavingsGoal[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  goalsRef.current = goals
  const investmentsRef = useRef<InvestmentAsset[]>([])
  const [investments, setInvestments] = useState<InvestmentAsset[]>([])
  investmentsRef.current = investments
  const dongEventsRef = useRef<DongEvent[]>([])
  const [dongEvents, setDongEvents] = useState<DongEvent[]>([])
  dongEventsRef.current = dongEvents
  const chequesRef = useRef<Cheque[]>([])
  const [cheques, setCheques] = useState<Cheque[]>([])
  chequesRef.current = cheques
  const debtsRef = useRef<DebtLoan[]>([])
  const [debts, setDebts] = useState<DebtLoan[]>([])
  debtsRef.current = debts
  const remindersRef = useRef<ReminderSettings>(emptyReminder)
  const [reminders, setReminderState] = useState<ReminderSettings>(emptyReminder)
  remindersRef.current = reminders
  const currencyUnitRef = useRef<CurrencyUnit>('IRT')
  const [currencyUnit, setCurrencyUnitState] = useState<CurrencyUnit>('IRT')
  currencyUnitRef.current = currencyUnit

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [
        vault,
        nextBudgets,
        nextGoals,
        nextReminders,
        nextCheques,
        nextDebts,
        savedUnit,
        nextInvestments,
        nextDongEvents,
      ] = await Promise.all([
        db.getKv<VaultBlob>('cardVault'),
        db.getKv<Budget[]>('budgets'),
        db.getKv<SavingsGoal[]>('goals'),
        db.getKv<ReminderSettings>('reminders'),
        db.getKv<Cheque[]>('cheques'),
        db.getKv<DebtLoan[]>('debts'),
        db.getKv<CurrencyUnit>('currencyUnit'),
        db.getKv<InvestmentAsset[]>('investments'),
        db.getKv<DongEvent[]>('dongEvents'),
      ])
      if (cancelled) return
      setBlob(vault ?? null)
      blobRef.current = vault ?? null
      setBudgets(nextBudgets ?? [])
      budgetsRef.current = nextBudgets ?? []
      setGoals(nextGoals ?? [])
      goalsRef.current = nextGoals ?? []
      setReminderState(nextReminders ?? emptyReminder)
      remindersRef.current = nextReminders ?? emptyReminder

      const now = Date.now()
      const today = todayIso(new Date(now))

      let initialCheques = nextCheques
      if (!initialCheques) {
        initialCheques = [
          {
            id: 'chq_passargad',
            direction: 'payable',
            sayadId: '2104928374829104',
            bankName: 'پاسارگاد',
            amount: 15_000_000,
            dueDate: addDaysIso(today, 5),
            party: 'تجهیزات مدرن',
            status: 'pending',
            note: 'بابت تسویه فاکتور صندلی ارگونومیک',
            createdAt: now - 3 * 86400000,
          },
          {
            id: 'chq_mellat',
            direction: 'receivable',
            sayadId: '7829104839201948',
            bankName: 'ملت',
            amount: 28_000_000,
            dueDate: addDaysIso(today, 12),
            party: 'مهندس رضایی',
            status: 'pending',
            note: 'قسط دوم قرارداد طراحی',
            createdAt: now - 5 * 86400000,
          },
        ]
        void db.setKv('cheques', initialCheques)
      }

      let initialDebts = nextDebts
      if (!initialDebts) {
        initialDebts = [
          {
            id: 'debt_borrowed_1',
            direction: 'borrowed',
            party: 'حاج احمد',
            amount: 20_000_000,
            dueDate: addDaysIso(today, 8),
            note: 'قرض‌الحسنه جهت رهن انبار',
            status: 'active',
            createdAt: now - 15 * 86400000,
          },
          {
            id: 'debt_lent_1',
            direction: 'lent',
            party: 'دوست (علی)',
            amount: 8_000_000,
            dueDate: addDaysIso(today, 22),
            note: 'مساعدت شخصی',
            status: 'active',
            createdAt: now - 7 * 86400000,
          },
        ]
        void db.setKv('debts', initialDebts)
      }

      let initialInvestments = nextInvestments
      if (!initialInvestments) {
        initialInvestments = [
          {
            id: 'inv_gold_1',
            name: 'طلای آب‌شده / ۱۸ عیار',
            market: 'gold',
            purchaseAmount: 85_000_000,
            currentValue: 98_500_000,
            quantity: 21.5,
            purchaseDate: addDaysIso(today, -60),
            note: 'پوشش تورم و پس‌انداز بلندمدت',
            createdAt: now - 60 * 86400000,
          },
          {
            id: 'inv_fund_1',
            name: 'صندوق سهامی اهرمی',
            market: 'fund',
            purchaseAmount: 50_000_000,
            currentValue: 56_200_000,
            purchaseDate: addDaysIso(today, -30),
            note: 'سرمایه‌گذاری در بورس',
            createdAt: now - 30 * 86400000,
          },
        ]
        void db.setKv('investments', initialInvestments)
      }

      let initialDong = nextDongEvents
      if (!initialDong) {
        initialDong = [
          {
            id: 'dong_trip_1',
            title: 'سفر تفریحی شمال',
            date: today,
            participants: [
              { id: 'p1', name: 'من (مدیر)' },
              { id: 'p2', name: 'علی' },
              { id: 'p3', name: 'رضا' },
            ],
            expenses: [
              {
                id: 'exp1',
                title: 'اقامتگاه و ویلا',
                amount: 18_000_000,
                paidById: 'p1',
                splitAmongIds: ['p1', 'p2', 'p3'],
              },
              {
                id: 'exp2',
                title: 'خرید رستوران و شام',
                amount: 6_000_000,
                paidById: 'p2',
                splitAmongIds: ['p1', 'p2', 'p3'],
              },
            ],
            note: 'دونگ‌های تفریح آخر هفته',
            settled: false,
            createdAt: now - 2 * 86400000,
          },
        ]
        void db.setKv('dongEvents', initialDong)
      }

      setCheques(initialCheques)
      chequesRef.current = initialCheques
      setDebts(initialDebts)
      debtsRef.current = initialDebts
      setInvestments(initialInvestments)
      investmentsRef.current = initialInvestments
      setDongEvents(initialDong)
      dongEventsRef.current = initialDong
      if (savedUnit === 'IRT' || savedUnit === 'IRR') {
        setCurrencyUnitState(savedUnit)
        currencyUnitRef.current = savedUnit
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setCurrencyUnit = useCallback(async (unit: CurrencyUnit) => {
    setCurrencyUnitState(unit)
    await db.setKv('currencyUnit', unit)
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
  }, [])

  const unitLabel = currencyUnit === 'IRT' ? 'تومان' : 'ریال'


  const formatMoney = useCallback(
    (amountInRials: number, withUnit = true): string => {
      const isToman = currencyUnit === 'IRT'
      const displayAmount = isToman ? Math.trunc(amountInRials / 10) : Math.trunc(amountInRials)
      const formatted = Math.abs(displayAmount).toLocaleString('fa-IR')
      const sign = displayAmount < 0 ? '−' : ''
      if (!withUnit) return `${sign}${formatted}`
      return `${sign}${formatted} ${isToman ? 'تومان' : 'ریال'}`
    },
    [currencyUnit],
  )

  const formatCompactMoney = useCallback(
    (amountInRials: number): string => {
      const isToman = currencyUnit === 'IRT'
      const value = isToman ? amountInRials / 10 : amountInRials
      const abs = Math.abs(value)
      const sign = value < 0 ? '−' : ''
      const unit = isToman ? 'تومان' : 'ریال'
      if (abs >= 1_000_000_000) return `${sign}${compactDigits(abs / 1_000_000_000)} میلیارد ${unit}`
      if (abs >= 1_000_000) return `${sign}${compactDigits(abs / 1_000_000)} میلیون ${unit}`
      if (abs >= 1_000) return `${sign}${compactDigits(abs / 1_000)} هزار ${unit}`
      return `${sign}${Math.trunc(abs).toLocaleString('fa-IR')} ${unit}`
    },
    [currencyUnit],
  )

  const persistCards = useCallback(
    async (next: BankCard[], phrase: string, wraps?: { accountWrap?: string; recoveryWrap?: string }) => {
      const current = blob
      const saltBytes = current?.salt
        ? Uint8Array.from(atob(current.salt), (c) => c.charCodeAt(0))
        : undefined
      const packed = await sealCards(phrase, next, saltBytes)
      const stored: VaultBlob = {
        salt: packed.salt,
        payload: packed.payload,
        accountWrap: wraps ? wraps.accountWrap : current?.accountWrap,
        recoveryWrap: wraps ? wraps.recoveryWrap : current?.recoveryWrap,
      }
      await db.setKv('cardVault', stored)
      setBlob(stored)
      setCards(next)
      passphraseRef.current = phrase
      setPassphrase(phrase)
      const { notifyLocalChange } = await import('../lib/sync')
      notifyLocalChange()
    },
    [blob],
  )

  const confirmAccountPassword = useCallback(async (accountPassword?: string) => {
    const phrase = (accountPassword ?? rememberedAccountPassword()).trim()
    if (!phrase) throw new Error('رمز حساب را وارد کنید تا بازیابی گاوصندوق ممکن بماند')
    if (await checkPasswordVerifier(phrase)) return phrase
    const session = loadSession()
    if (!session) throw new Error('اول وارد حساب شوید')
    await signIn(session.email, phrase)
    return phrase
  }, [])

  const wrapsFor = useCallback(
    async (phrase: string, accountPassword?: string) => {
      const account = await confirmAccountPassword(accountPassword)
      const code = generateRecoveryCode()
      return {
        code,
        accountWrap: await wrapText(phrase, account),
        recoveryWrap: await wrapText(phrase, code),
      }
    },
    [confirmAccountPassword],
  )

  const unlockVault = useCallback(
    async (phrase: string) => {
      if (!blob) {
        passphraseRef.current = phrase
        setPassphrase(phrase)
        setCards([])
        return
      }
      const next = await openCards(phrase, blob.salt, blob.payload)
      setCards(next)
      passphraseRef.current = phrase
      setPassphrase(phrase)
    },
    [blob],
  )

  const saveCheque = useCallback(async (input: Omit<Cheque, 'id' | 'createdAt'> & { id?: string }): Promise<Cheque> => {
    const current = chequesRef.current
    const existing = input.id ? current.find((c) => c.id === input.id) : undefined
    const cheque: Cheque = {
      ...input,
      id: existing?.id ?? createId('chq'),
      createdAt: existing?.createdAt ?? Date.now(),
    }
    const next = existing ? current.map((c) => (c.id === cheque.id ? cheque : c)) : [cheque, ...current]
    chequesRef.current = next
    setCheques(next)
    await db.setKv('cheques', next)
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
    return cheque
  }, [])

  const deleteCheque = useCallback(async (id: string) => {
    const current = chequesRef.current
    const next = current.filter((c) => c.id !== id)
    chequesRef.current = next
    setCheques(next)
    await db.setKv('cheques', next)
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
  }, [])

  const updateChequeStatus = useCallback(async (id: string, status: ChequeStatus, clearedDate?: string) => {
    const current = chequesRef.current
    const next = current.map((c) => (c.id === id ? { ...c, status, clearedAt: status === 'cleared' ? clearedDate ?? new Date().toISOString().slice(0, 10) : undefined } : c))
    chequesRef.current = next
    setCheques(next)
    await db.setKv('cheques', next)
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
  }, [])

  const saveDebt = useCallback(async (input: Omit<DebtLoan, 'id' | 'createdAt'> & { id?: string }): Promise<DebtLoan> => {
    const current = debtsRef.current
    const existing = input.id ? current.find((d) => d.id === input.id) : undefined
    const debt: DebtLoan = {
      ...input,
      id: existing?.id ?? createId('debt'),
      createdAt: existing?.createdAt ?? Date.now(),
      status: input.status ?? existing?.status ?? 'active',
    }
    const next = existing ? current.map((d) => (d.id === debt.id ? debt : d)) : [debt, ...current]
    debtsRef.current = next
    setDebts(next)
    await db.setKv('debts', next)
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
    return debt
  }, [])

  const deleteDebt = useCallback(async (id: string) => {
    const current = debtsRef.current
    const next = current.filter((d) => d.id !== id)
    debtsRef.current = next
    setDebts(next)
    await db.setKv('debts', next)
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
  }, [])

  const settleDebt = useCallback(async (id: string, accountId?: string) => {
    const current = debtsRef.current
    const today = new Date().toISOString().slice(0, 10)
    const next = current.map((d) => (d.id === id ? { ...d, status: 'settled' as const, settledAt: today, accountId: accountId || d.accountId } : d))
    debtsRef.current = next
    setDebts(next)
    await db.setKv('debts', next)
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
  }, [])

  const unsettleDebt = useCallback(async (id: string) => {
    const current = debtsRef.current
    const next = current.map((d) =>
      d.id === id ? { ...d, status: 'active' as const, settledAt: undefined } : d,
    )
    debtsRef.current = next
    setDebts(next)
    await db.setKv('debts', next)
    const { notifyLocalChange } = await import('../lib/sync')
    notifyLocalChange()
  }, [])

  const value = useMemo<ExtrasValue>(
    () => ({
      unlocked: passphrase != null,
      vaultConfigured: blob != null,
      cards,
      budgets,
      goals,
      investments,
      dongEvents,
      cheques,
      debts,
      reminders,
      currencyUnit,
      unitLabel,
      setCurrencyUnit,
      formatMoney,
      formatCompactMoney,
      unlockVault,
      lockVault: () => {
        passphraseRef.current = null
        setPassphrase(null)
        setCards([])
      },
      setVaultPassword: async (phrase, accountPassword) => {
        if (blob) throw new Error('رمز گاوصندوق قبلاً تعیین شده است')
        const trimmed = phrase.trim()
        if (trimmed.length < 4) throw new Error('رمز گاوصندوق حداقل ۴ حرف است')
        const wraps = await wrapsFor(trimmed, accountPassword)
        await persistCards([], trimmed, wraps)
        return wraps.code
      },
      changeVaultPassword: async (current, next, accountPassword) => {
        if (!blob) throw new Error('اول رمز گاوصندوق را تعیین کنید')
        const trimmed = next.trim()
        if (trimmed.length < 4) throw new Error('رمز تازه حداقل ۴ حرف است')
        const opened = await openCards(current, blob.salt, blob.payload)
        const wraps = await wrapsFor(trimmed, accountPassword)
        await persistCards(opened, trimmed, wraps)
        return wraps.code
      },
      recoverVaultPassword: async (secret, mode, next) => {
        if (!blob) throw new Error('گاوصندوقی برای بازیابی نیست')
        const trimmed = next.trim()
        if (trimmed.length < 4) throw new Error('رمز تازه حداقل ۴ حرف است')
        const wrapped = mode === 'account' ? blob.accountWrap : blob.recoveryWrap
        if (!wrapped) throw new Error(mode === 'account' ? 'بازیابی با رمز حساب برای این گاوصندوق ثبت نشده' : 'کد بازیابی برای این گاوصندوق ثبت نشده')
        let phrase = ''
        try {
          phrase = await unwrapText(wrapped, secret.trim())
        } catch {
          throw new Error(mode === 'account' ? 'رمز حساب نادرست است' : 'کد بازیابی نادرست است')
        }
        const opened = await openCards(phrase, blob.salt, blob.payload)
        const accountPassword = mode === 'account' ? secret.trim() : rememberedAccountPassword()
        if (!accountPassword) {
          const code = generateRecoveryCode()
          await persistCards(opened, trimmed, { recoveryWrap: await wrapText(trimmed, code) })
          return code
        }
        const wraps = await wrapsFor(trimmed, accountPassword)
        await persistCards(opened, trimmed, wraps)
        return wraps.code
      },
      resetVault: async (phrase, accountPassword) => {
        const trimmed = phrase.trim()
        if (trimmed.length < 4) throw new Error('رمز گاوصندوق حداقل ۴ حرف است')
        const wraps = await wrapsFor(trimmed, accountPassword)
        const packed = await sealCards(trimmed, [])
        const stored: VaultBlob = { salt: packed.salt, payload: packed.payload, accountWrap: wraps.accountWrap, recoveryWrap: wraps.recoveryWrap }
        await db.setKv('cardVault', stored)
        setBlob(stored)
        setCards([])
        passphraseRef.current = trimmed
        setPassphrase(trimmed)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
        return wraps.code
      },
      clearLocal: async () => {
        setBlob(null)
        passphraseRef.current = null
        setPassphrase(null)
        setCards([])
        setBudgets([])
        setGoals([])
        setInvestments([])
        setDongEvents([])
        setCheques([])
        setDebts([])
        setReminderState(emptyReminder)
        await db.setKv('budgets', [])
        await db.setKv('goals', [])
        await db.setKv('investments', [])
        await db.setKv('dongEvents', [])
        await db.setKv('cheques', [])
        await db.setKv('debts', [])
        await db.setKv('reminders', emptyReminder)
        await db.setKv('cardVault', null)
      },
      saveCard: async (input, phrase) => {
        const error = validateCard(input)
        if (error) throw new Error(error)
        const active = passphraseRef.current ?? phrase
        if (!active) throw new Error('گاوصندوق قفل است')
        const current = blob && !passphraseRef.current ? await openCards(active, blob.salt, blob.payload) : cardsRef.current
        const existing = input.id ? current.find((card) => card.id === input.id) : undefined
        const card: BankCard = {
          ...input,
          id: existing?.id ?? createId('card'),
          createdAt: existing?.createdAt ?? Date.now(),
          pan: digitsOnly(input.pan),
          accountId: existing?.accountId,
        }
        const next = existing ? current.map((row) => (row.id === card.id ? card : row)) : [...current, card]
        await persistCards(next, active)
        return card
      },
      linkCard: async (id, accountId) => {
        if (!passphrase || !blob) return
        const next = cards.map((card) => (card.id === id ? { ...card, accountId } : card))
        await persistCards(next, passphrase)
      },
      deleteCard: async (id, phrase) => {
        const active = passphraseRef.current ?? phrase
        if (!active) throw new Error('گاوصندوق قفل است')
        const current = !passphraseRef.current && blob ? await openCards(active, blob.salt, blob.payload) : cardsRef.current
        await persistCards(current.filter((card) => card.id !== id), active)
      },
      saveBudget: async (budget) => {
        const next = budgets.some((row) => row.id === budget.id)
          ? budgets.map((row) => (row.id === budget.id ? budget : row))
          : [...budgets, budget]
        setBudgets(next)
        await db.setKv('budgets', next)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
      },
      deleteBudget: async (id) => {
        const next = budgets.filter((row) => row.id !== id)
        setBudgets(next)
        await db.setKv('budgets', next)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
      },
      saveGoal: async (goal) => {
        const row: SavingsGoal = { ...goal, id: goal.id ?? createId('goal') }
        const next = goals.some((item) => item.id === row.id)
          ? goals.map((item) => (item.id === row.id ? row : item))
          : [...goals, row]
        setGoals(next)
        await db.setKv('goals', next)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
      },
      deleteGoal: async (id) => {
        const next = goals.filter((item) => item.id !== id)
        setGoals(next)
        await db.setKv('goals', next)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
      },
      saveInvestment: async (asset) => {
        const existing = asset.id ? investmentsRef.current.find((item) => item.id === asset.id) : undefined
        const row: InvestmentAsset = {
          ...asset,
          id: existing?.id ?? createId('inv'),
          createdAt: existing?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        }
        const next = investmentsRef.current.some((item) => item.id === row.id)
          ? investmentsRef.current.map((item) => (item.id === row.id ? row : item))
          : [...investmentsRef.current, row]
        investmentsRef.current = next
        setInvestments(next)
        await db.setKv('investments', next)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
        return row
      },
      deleteInvestment: async (id) => {
        const next = investmentsRef.current.filter((item) => item.id !== id)
        investmentsRef.current = next
        setInvestments(next)
        await db.setKv('investments', next)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
      },
      saveDongEvent: async (event) => {
        const existing = event.id ? dongEventsRef.current.find((item) => item.id === event.id) : undefined
        const row: DongEvent = {
          ...event,
          id: existing?.id ?? createId('dong'),
          createdAt: existing?.createdAt ?? Date.now(),
        }
        const next = dongEventsRef.current.some((item) => item.id === row.id)
          ? dongEventsRef.current.map((item) => (item.id === row.id ? row : item))
          : [...dongEventsRef.current, row]
        dongEventsRef.current = next
        setDongEvents(next)
        await db.setKv('dongEvents', next)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
        return row
      },
      deleteDongEvent: async (id) => {
        const next = dongEventsRef.current.filter((item) => item.id !== id)
        dongEventsRef.current = next
        setDongEvents(next)
        await db.setKv('dongEvents', next)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
      },
      saveCheque,
      deleteCheque,
      updateChequeStatus,
      saveDebt,
      deleteDebt,
      settleDebt,
      unsettleDebt,
      setReminders: async (next) => {
        setReminderState(next)
        await db.setKv('reminders', next)
        const { notifyLocalChange } = await import('../lib/sync')
        notifyLocalChange()
      },
      exportLocal: async () => {
        const [storedCheques, storedDebts, storedBudgets, storedGoals, storedReminders, storedUnit, storedVault, storedInvestments, storedDong] = await Promise.all([
          db.getKv<Cheque[]>('cheques'),
          db.getKv<DebtLoan[]>('debts'),
          db.getKv<Budget[]>('budgets'),
          db.getKv<SavingsGoal[]>('goals'),
          db.getKv<ReminderSettings>('reminders'),
          db.getKv<CurrencyUnit>('currencyUnit'),
          db.getKv<VaultBlob>('cardVault'),
          db.getKv<InvestmentAsset[]>('investments'),
          db.getKv<DongEvent[]>('dongEvents'),
        ])
        return {
          budgets: storedBudgets ?? budgetsRef.current,
          goals: storedGoals ?? goalsRef.current,
          investments: storedInvestments ?? investmentsRef.current,
          dongEvents: storedDong ?? dongEventsRef.current,
          cheques: storedCheques ?? chequesRef.current,
          debts: storedDebts ?? debtsRef.current,
          reminders: storedReminders ?? remindersRef.current,
          currencyUnit: storedUnit ?? currencyUnitRef.current,
          cardVault: storedVault ?? blobRef.current,
        }
      },
      importLocal: async (data) => {
        if (Array.isArray(data.budgets)) {
          budgetsRef.current = data.budgets as Budget[]
          setBudgets(data.budgets as Budget[])
          await db.setKv('budgets', data.budgets)
        }
        if (Array.isArray(data.goals)) {
          goalsRef.current = data.goals as SavingsGoal[]
          setGoals(data.goals as SavingsGoal[])
          await db.setKv('goals', data.goals)
        }
        if (Array.isArray(data.investments)) {
          investmentsRef.current = data.investments as InvestmentAsset[]
          setInvestments(data.investments as InvestmentAsset[])
          await db.setKv('investments', data.investments)
        }
        if (Array.isArray(data.dongEvents)) {
          dongEventsRef.current = data.dongEvents as DongEvent[]
          setDongEvents(data.dongEvents as DongEvent[])
          await db.setKv('dongEvents', data.dongEvents)
        }
        if (Array.isArray(data.cheques)) {
          chequesRef.current = data.cheques as Cheque[]
          setCheques(data.cheques as Cheque[])
          await db.setKv('cheques', data.cheques)
        }
        if (Array.isArray(data.debts)) {
          debtsRef.current = data.debts as DebtLoan[]
          setDebts(data.debts as DebtLoan[])
          await db.setKv('debts', data.debts)
        }
        if (data.currencyUnit === 'IRT' || data.currencyUnit === 'IRR') {
          currencyUnitRef.current = data.currencyUnit
          setCurrencyUnitState(data.currencyUnit)
          await db.setKv('currencyUnit', data.currencyUnit)
        }
        if (data.reminders && typeof data.reminders === 'object') {
          remindersRef.current = data.reminders as ReminderSettings
          setReminderState(data.reminders as ReminderSettings)
          await db.setKv('reminders', data.reminders)
        }
        if (data.cardVault && typeof data.cardVault === 'object') {
          const nextBlob = data.cardVault as VaultBlob
          const phrase = passphraseRef.current
          if (phrase && nextBlob.salt && nextBlob.payload) {
            try {
              const opened = await openCards(phrase, nextBlob.salt, nextBlob.payload)
              setBlob(nextBlob)
              await db.setKv('cardVault', nextBlob)
              setCards(opened)
              return
            } catch {
              /* رمز فعلی این نسخه را باز نکرد؛ گاوصندوق قفل می‌ماند */
            }
          }
          setBlob(nextBlob)
          await db.setKv('cardVault', nextBlob)
          passphraseRef.current = null
          setPassphrase(null)
          setCards([])
        }
      },
    }),
    [
      blob,
      budgets,
      cards,
      cheques,
      debts,
      currencyUnit,
      deleteCheque,
      deleteDebt,
      formatCompactMoney,
      formatMoney,
      goals,
      investments,
      dongEvents,
      passphrase,
      persistCards,
      reminders,
      saveCheque,
      saveDebt,
      setCurrencyUnit,
      settleDebt,
      unitLabel,
      unlockVault,
      updateChequeStatus,
      wrapsFor,
    ],
  )

  return <ExtrasContext.Provider value={value}>{children}</ExtrasContext.Provider>
}

export function useExtras(): ExtrasValue {
  const ctx = useContext(ExtrasContext)
  if (!ctx) throw new Error('useExtras must be used within ExtrasProvider')
  return ctx
}
