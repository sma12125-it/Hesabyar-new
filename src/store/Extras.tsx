import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as db from '../db/db'
import { checkPasswordVerifier, generateRecoveryCode, rememberedAccountPassword } from '../lib/account'
import { loadSession, signIn } from '../lib/sync'
import { openCards, sealCards, unwrapText, validateCard, wrapText } from '../lib/vault'
import { createId } from '../lib/ids'
import { digitsOnly } from '../lib/money'
import type { BankCard, Budget, ReminderSettings, SavingsGoal } from '../types'

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
  reminders: ReminderSettings
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
  setReminders: (next: ReminderSettings) => Promise<void>
  exportLocal: () => Promise<Record<string, unknown>>
  importLocal: (data: Record<string, unknown>) => Promise<void>
}

const ExtrasContext = createContext<ExtrasValue | null>(null)
const emptyReminder: ReminderSettings = { enabled: false, leadDays: 2 }

export function ExtrasProvider({ children }: { children: ReactNode }) {
  const [blob, setBlob] = useState<VaultBlob | null>(null)
  const [passphrase, setPassphrase] = useState<string | null>(null)
  const passphraseRef = useRef<string | null>(null)
  passphraseRef.current = passphrase
  const cardsRef = useRef<BankCard[]>([])
  const [cards, setCards] = useState<BankCard[]>([])
  cardsRef.current = cards
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [reminders, setReminderState] = useState<ReminderSettings>(emptyReminder)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [vault, nextBudgets, nextGoals, nextReminders] = await Promise.all([
        db.getKv<VaultBlob>('cardVault'),
        db.getKv<Budget[]>('budgets'),
        db.getKv<SavingsGoal[]>('goals'),
        db.getKv<ReminderSettings>('reminders'),
      ])
      if (cancelled) return
      setBlob(vault ?? null)
      setBudgets(nextBudgets ?? [])
      setGoals(nextGoals ?? [])
      setReminderState(nextReminders ?? emptyReminder)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persistCards = useCallback(async (next: BankCard[], phrase: string, wraps?: { accountWrap?: string; recoveryWrap?: string }) => {
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
  }, [blob])

  const confirmAccountPassword = useCallback(async (accountPassword?: string) => {
    const phrase = (accountPassword ?? rememberedAccountPassword()).trim()
    if (!phrase) throw new Error('رمز حساب را وارد کنید تا بازیابی گاوصندوق ممکن بماند')
    if (await checkPasswordVerifier(phrase)) return phrase
    const session = loadSession()
    if (!session) throw new Error('اول وارد حساب شوید')
    await signIn(session.email, phrase)
    return phrase
  }, [])

  const wrapsFor = useCallback(async (phrase: string, accountPassword?: string) => {
    const account = await confirmAccountPassword(accountPassword)
    const code = generateRecoveryCode()
    return {
      code,
      accountWrap: await wrapText(phrase, account),
      recoveryWrap: await wrapText(phrase, code),
    }
  }, [confirmAccountPassword])

  const unlockVault = useCallback(async (phrase: string) => {
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
  }, [blob])

  const value = useMemo<ExtrasValue>(() => ({
    unlocked: passphrase != null,
    vaultConfigured: blob != null,
    cards,
    budgets,
    goals,
    reminders,
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
      setReminderState(emptyReminder)
      await db.setKv('budgets', [])
      await db.setKv('goals', [])
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
    setReminders: async (next) => {
      setReminderState(next)
      await db.setKv('reminders', next)
      const { notifyLocalChange } = await import('../lib/sync')
      notifyLocalChange()
    },
    exportLocal: async () => ({
      budgets,
      goals,
      reminders,
      cardVault: blob,
    }),
    importLocal: async (data) => {
      if (Array.isArray(data.budgets)) {
        setBudgets(data.budgets as Budget[])
        await db.setKv('budgets', data.budgets)
      }
      if (Array.isArray(data.goals)) {
        setGoals(data.goals as SavingsGoal[])
        await db.setKv('goals', data.goals)
      }
      if (data.reminders && typeof data.reminders === 'object') {
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
  }), [blob, budgets, cards, goals, passphrase, persistCards, reminders, unlockVault, wrapsFor])

  return <ExtrasContext.Provider value={value}>{children}</ExtrasContext.Provider>
}

export function useExtras(): ExtrasValue {
  const ctx = useContext(ExtrasContext)
  if (!ctx) throw new Error('useExtras must be used within ExtrasProvider')
  return ctx
}
