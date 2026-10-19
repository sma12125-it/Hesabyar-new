import { useCallback, useEffect, useMemo, useState } from 'react'
import { categoriesFor } from '../lib/categories'
import { monthKey, expenseByCategory, spentInCategory } from '../lib/reports'
import { todayIso } from '../lib/iso'
import { createId } from '../lib/ids'
import { digitsOnly, formatSeparatedNumber, toFaDigits } from '../lib/money'
import { SettingsButton } from '../components/SettingsButton'
import { WindowPopup } from '../components/WindowPopup'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import { notifyUser } from '../lib/sync'
import { TSE_INSTRUMENTS } from '../lib/tseCatalog'
import type { CardMarket, InvestmentMarket, DongEvent, DongExpenseItem, InvestmentAsset } from '../types'

export interface SettlementTransfer {
  id: string
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
  settled: boolean
}

export interface DongParticipantBalance {
  id: string
  name: string
  paid: number
  share: number
  net: number // paid - share (positive = creditor, negative = debtor)
}

export interface DongCalculationSummary {
  transfers: SettlementTransfer[]
  balances: DongParticipantBalance[]
  totalCost: number
}

export function computeDongSettlement(event: DongEvent): DongCalculationSummary {
  const participants = event.participants
  if (participants.length === 0) {
    return { transfers: [], balances: [], totalCost: 0 }
  }

  const paidMap = new Map<string, number>()
  const shareMap = new Map<string, number>()
  for (const p of participants) {
    paidMap.set(p.id, 0)
    shareMap.set(p.id, 0)
  }

  let totalCost = 0

  for (const exp of event.expenses) {
    if (exp.amount <= 0) continue
    totalCost += exp.amount

    // Credit payer
    paidMap.set(exp.paidById, (paidMap.get(exp.paidById) ?? 0) + exp.amount)

    // Beneficiaries
    const splits =
      exp.splitAmongIds && exp.splitAmongIds.length > 0
        ? exp.splitAmongIds
        : participants.map((p) => p.id)

    if (splits.length === 0) continue

    if (exp.splitMode === 'custom' && exp.customShares) {
      let sumCustom = 0
      for (const id of splits) {
        sumCustom += exp.customShares[id] ?? 0
      }

      if (sumCustom > 0) {
        let allocated = 0
        splits.forEach((id, idx) => {
          if (idx === splits.length - 1) {
            const lastShare = Math.max(0, exp.amount - allocated)
            shareMap.set(id, (shareMap.get(id) ?? 0) + lastShare)
          } else {
            const rawRatio = (exp.customShares![id] ?? 0) / sumCustom
            const share = Math.round(rawRatio * exp.amount)
            allocated += share
            shareMap.set(id, (shareMap.get(id) ?? 0) + share)
          }
        })
      } else {
        const count = splits.length
        const baseShare = Math.floor(exp.amount / count)
        const remainder = exp.amount % count
        splits.forEach((id, idx) => {
          const share = baseShare + (idx < remainder ? 1 : 0)
          shareMap.set(id, (shareMap.get(id) ?? 0) + share)
        })
      }
    } else {
      // Equal split
      const count = splits.length
      const baseShare = Math.floor(exp.amount / count)
      const remainder = exp.amount % count
      splits.forEach((id, idx) => {
        const share = baseShare + (idx < remainder ? 1 : 0)
        shareMap.set(id, (shareMap.get(id) ?? 0) + share)
      })
    }
  }

  // Calculate net balances for all participants
  const balances: DongParticipantBalance[] = participants.map((p) => {
    const paid = paidMap.get(p.id) ?? 0
    const share = shareMap.get(p.id) ?? 0
    return {
      id: p.id,
      name: p.name,
      paid,
      share,
      net: paid - share,
    }
  })

  // Debtors (net < -5) and Creditors (net > 5)
  const debtors = balances
    .filter((b) => b.net < -5)
    .map((b) => ({ id: b.id, name: b.name, remaining: -b.net }))
    .sort((a, b) => b.remaining - a.remaining)

  const creditors = balances
    .filter((b) => b.net > 5)
    .map((b) => ({ id: b.id, name: b.name, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining)

  const transfers: SettlementTransfer[] = []
  let dIdx = 0
  let cIdx = 0
  const settledSet = new Set(event.settledTransfers || [])

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx]
    const creditor = creditors[cIdx]
    const pay = Math.min(debtor.remaining, creditor.remaining)

    if (pay >= 1) {
      const transferId = `${debtor.id}_to_${creditor.id}`
      transfers.push({
        id: transferId,
        fromId: debtor.id,
        fromName: debtor.name,
        toId: creditor.id,
        toName: creditor.name,
        amount: Math.round(pay),
        settled: settledSet.has(transferId),
      })
    }

    debtor.remaining -= pay
    creditor.remaining -= pay

    if (debtor.remaining < 1) dIdx++
    if (creditor.remaining < 1) cIdx++
  }

  return { transfers, balances, totalCost }
}

const DEFAULT_MARKETS: { id: CardMarket; label: string; icon: string }[] = [
  { id: 'gold', label: 'طلا و سکه', icon: '🪙' },
  { id: 'stock', label: 'بورس و سهام', icon: '📈' },
  { id: 'fund', label: 'صندوق سرمایه‌گذاری', icon: '🏦' },
  { id: 'crypto', label: 'ارز دیجیتال', icon: '💎' },
  { id: 'bank', label: 'سپرده بانکی', icon: '💳' },
  { id: 'cash', label: 'پس‌انداز نقدی', icon: '💵' },
]

const DEFAULT_INVESTMENT_MARKETS: { id: InvestmentMarket; label: string; icon: string }[] = [
  { id: 'gold', label: 'طلا و سکه', icon: '🪙' },
  { id: 'stock', label: 'بورس و سهام', icon: '📈' },
  { id: 'fund', label: 'صندوق‌های مالی', icon: '🏦' },
  { id: 'crypto', label: 'ارز دیجیتال', icon: '💎' },
  { id: 'property', label: 'ملک و مسکن', icon: '🏠' },
  { id: 'bank', label: 'سپرده بلندمدت', icon: '💳' },
  { id: 'other', label: 'سایر دارایی‌ها', icon: '📦' },
]

const DONUT_COLORS = [
  '#0d9488',
  '#2563eb',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#10b981',
  '#06b6d4',
  '#f97316',
  '#6366f1',
  '#14b8a6',
]

export interface TseInstrumentSummary {
  symbol: string
  name: string
  inscode: string
  type?: string
  category?: string
  categoryName?: string
  lastPrice?: number
  closingPrice?: number
  changePercent?: number
}

const DEFAULT_POPULAR_SYMBOLS: TseInstrumentSummary[] = TSE_INSTRUMENTS as unknown as TseInstrumentSummary[]

type ActiveTab = 'budget' | 'goals' | 'investments' | 'dong'

export function ReportsPage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const { transactions, customCategories, createCategory, renameCategory } = useStore()
  const {
    budgets,
    goals,
    investments,
    dongEvents,
    saveBudget,
    deleteBudget,
    saveGoal,
    deleteGoal,
    saveInvestment,
    deleteInvestment,
    saveDongEvent,
    deleteDongEvent,
    formatMoney,
    formatCompactMoney,
    unitLabel,
    currencyUnit,
  } = useExtras()

  const [activeTab, setActiveTab] = useState<ActiveTab>('budget')
  const today = todayIso()
  const month = monthKey(today) ?? ''
  const bars = expenseByCategory(transactions, month, customCategories)

  // -------------------------
  // Helper: Parse Rial amount
  // -------------------------
  const parseAmountToRials = (val: string): number => {
    const raw = Number(digitsOnly(val))
    if (isNaN(raw) || raw <= 0) return 0
    return currencyUnit === 'IRT' ? raw * 10 : raw
  }

  // -------------------------
  // Top KPI Metrics
  // -------------------------
  const totalBudgetLimit = useMemo(() => budgets.reduce((sum, b) => sum + b.monthlyLimit, 0), [budgets])
  const totalBudgetSpent = useMemo(
    () => budgets.reduce((sum, b) => sum + spentInCategory(transactions, month, b.categoryId), 0),
    [budgets, transactions, month]
  )
  const activeGoalsList = useMemo(() => goals.filter((g) => !g.archived), [goals])
  const archivedGoalsList = useMemo(() => goals.filter((g) => g.archived), [goals])
  const totalSavedGoals = useMemo(() => activeGoalsList.reduce((sum, g) => sum + g.saved, 0), [activeGoalsList])
  const totalTargetGoals = useMemo(() => activeGoalsList.reduce((sum, g) => sum + g.target, 0), [activeGoalsList])

  const totalInvestmentCost = useMemo(() => investments.reduce((sum, i) => sum + i.purchaseAmount, 0), [investments])
  const totalInvestmentValue = useMemo(() => investments.reduce((sum, i) => sum + i.currentValue, 0), [investments])
  const totalInvestmentProfit = totalInvestmentValue - totalInvestmentCost
  const totalInvestmentRoi =
    totalInvestmentCost > 0 ? ((totalInvestmentProfit / totalInvestmentCost) * 100).toFixed(1) : '0'

  // ─────────────────────────────────────────────────────────────
  // 1. BUDGETING STATE & MODAL
  // ─────────────────────────────────────────────────────────────
  const [isCreateBudgetOpen, setIsCreateBudgetOpen] = useState(false)
  const [budgetLimitInput, setBudgetLimitInput] = useState('')
  const [budgetCategoryId, setBudgetCategoryId] = useState(categoriesFor('expense', customCategories)[0]?.id ?? 'food')
  const [newCatName, setNewCatName] = useState('')
  const [showAddCatRow, setShowAddCatRow] = useState(false)
  const [showEditCatRow, setShowEditCatRow] = useState(false)
  const [editCatName, setEditCatName] = useState('')

  // ─────────────────────────────────────────────────────────────
  // 2. SAVINGS GOALS STATE & MODAL
  // ─────────────────────────────────────────────────────────────
  const [goalsTab, setGoalsTab] = useState<'active' | 'archived'>('active')
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false)
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalMarket, setGoalMarket] = useState<CardMarket | string>('gold')
  const [goalDepositAmount, setGoalDepositAmount] = useState<Record<string, string>>({})

  const [goalMarkets, setGoalMarkets] = useState<{ id: string; label: string; icon: string }[]>(() => {
    try {
      const saved = localStorage.getItem('hy-goal-markets')
      if (saved) return JSON.parse(saved)
    } catch {}
    return DEFAULT_MARKETS
  })
  const saveGoalMarkets = (next: { id: string; label: string; icon: string }[]) => {
    setGoalMarkets(next)
    localStorage.setItem('hy-goal-markets', JSON.stringify(next))
  }
  const [showAddGoalCat, setShowAddGoalCat] = useState(false)
  const [newGoalCatName, setNewGoalCatName] = useState('')
  const [newGoalCatIcon, setNewGoalCatIcon] = useState('🎯')
  const [showEditGoalCat, setShowEditGoalCat] = useState(false)
  const [editGoalCatName, setEditGoalCatName] = useState('')

  // ─────────────────────────────────────────────────────────────
  // 3. INVESTMENTS STATE & TSETMC INTEGRATION
  // ─────────────────────────────────────────────────────────────
  const [invMarketFilter, setInvMarketFilter] = useState<string>('all')
  const [isCreateInvOpen, setIsCreateInvOpen] = useState(false)
  const [editingInv, setEditingInv] = useState<InvestmentAsset | null>(null)
  const [invName, setInvName] = useState('')
  const [invMarket, setInvMarket] = useState<InvestmentMarket | string>('gold')
  const [invSymbol, setInvSymbol] = useState('')
  const [invInscode, setInvInscode] = useState('')
  const [invQuantity, setInvQuantity] = useState('')
  const [invUnitPrice, setInvUnitPrice] = useState('')
  const [invCurrentUnitPrice, setInvCurrentUnitPrice] = useState('')
  const [invBuyPrice, setInvBuyPrice] = useState('')
  const [invCurrentValue, setInvCurrentValue] = useState('')
  const [invNote, setInvNote] = useState('')
  const [tseLoading, setTseLoading] = useState(false)
  const [tseInfo, setTseInfo] = useState<string | null>(null)
  const [isRefreshingTse, setIsRefreshingTse] = useState(false)
  const [tseSearchQuery, setTseSearchQuery] = useState('')
  const [isTsePickerOpen, setIsTsePickerOpen] = useState(false)
  const [tseCategoryFilter, setTseCategoryFilter] = useState<string>('all')
  const [tseInstrumentsList, setTseInstrumentsList] = useState<TseInstrumentSummary[]>(
    () => TSE_INSTRUMENTS as unknown as TseInstrumentSummary[]
  )
  const [tseDetails, setTseDetails] = useState<{
    lastPrice: number
    closingPrice: number
    changePercent: number
    source: string
  } | null>(null)

  const [invMarkets, setInvMarkets] = useState<{ id: string; label: string; icon: string }[]>(() => {
    try {
      const saved = localStorage.getItem('hy-inv-markets')
      if (saved) return JSON.parse(saved)
    } catch {}
    return DEFAULT_INVESTMENT_MARKETS
  })
  const saveInvMarkets = (next: { id: string; label: string; icon: string }[]) => {
    setInvMarkets(next)
    localStorage.setItem('hy-inv-markets', JSON.stringify(next))
  }
  const [showAddInvCat, setShowAddInvCat] = useState(false)
  const [newInvCatName, setNewInvCatName] = useState('')
  const [newInvCatIcon, setNewInvCatIcon] = useState('📦')
  const [showEditInvCat, setShowEditInvCat] = useState(false)
  const [editInvCatName, setEditInvCatName] = useState('')

  // Filter buttons: ONLY show categories that currently exist in the user's investments + "all"
  const existingInvMarkets = useMemo(() => {
    const set = new Set<string>(investments.map((i) => i.market))
    return invMarkets.filter((m) => set.has(m.id))
  }, [investments, invMarkets])

  const filteredInvestments = useMemo(() => {
    if (invMarketFilter === 'all') return investments
    return investments.filter((i) => i.market === invMarketFilter)
  }, [investments, invMarketFilter])

  const [isTseLoadingCatalog, setIsTseLoadingCatalog] = useState(false)

  // فراخوانی کلیه نمادهای رسمی بازار بورس و فرابورس از وب‌سرویس
  const loadAllTseInstruments = useCallback(async () => {
    setIsTseLoadingCatalog(true)
    try {
      const res = await fetch('/api/v1/tsetmc/instruments?limit=2000')
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.instruments) && data.instruments.length > 0) {
          setTseInstrumentsList(data.instruments)
        }
      }
    } catch {
      // استفاده از داده‌های پشتیبان
    } finally {
      setIsTseLoadingCatalog(false)
    }
  }, [])

  // بارگذاری اولیه کلیه نمادهای رسمی بورس هنگام راه‌اندازی کامپوننت
  useEffect(() => {
    void loadAllTseInstruments()
  }, [loadAllTseInstruments])

  // به‌روزرسانی خودکار قیمت‌های بورس هنگام باز شدن صفحه
  useEffect(() => {
    if (activeTab === 'investments' || activeTab === 'budget') {
      void refreshTseQuotes(true)
    }
  }, [activeTab])

  // فیلتر هوشمند نمادهای بورس بر اساس جستجو و دسته‌بندی تخصصی بازار
  const filteredTseInstruments = useMemo(() => {
    let list = tseInstrumentsList.length > 0 ? tseInstrumentsList : DEFAULT_POPULAR_SYMBOLS
    if (tseCategoryFilter !== 'all') {
      list = list.filter((item) => {
        const t = (item.type || '').toLowerCase()
        const cat = (item.category || item.categoryName || '').toLowerCase()
        if (tseCategoryFilter === 'gold') return t === 'gold' || cat.includes('طلا')
        if (tseCategoryFilter === 'leveraged') return t === 'leveraged' || cat.includes('اهرم')
        if (tseCategoryFilter === 'stock') return t === 'stock'
        if (tseCategoryFilter === 'fixed_income') return t === 'fixed_income' || cat.includes('درآمد ثابت')
        if (tseCategoryFilter === 'fund') return t === 'fund' || cat.includes('صندوق')
        if (tseCategoryFilter === 'metals') return cat.includes('فلز') || cat.includes('معدن') || cat.includes('کانه')
        if (tseCategoryFilter === 'auto') return cat.includes('خودرو') || cat.includes('قطعات')
        if (tseCategoryFilter === 'oil') return cat.includes('نفت') || cat.includes('شیمیایی') || cat.includes('پتروشیمی')
        if (tseCategoryFilter === 'bank') return cat.includes('بانک') || cat.includes('سرمایه‌گذاری') || cat.includes('بیمه')
        if (tseCategoryFilter === 'pharma') return cat.includes('دارو') || cat.includes('بهداشت')
        if (tseCategoryFilter === 'cement') return cat.includes('سیمان') || cat.includes('ساختمان') || cat.includes('املاک') || cat.includes('مسکن')
        if (tseCategoryFilter === 'food') return cat.includes('غذا') || cat.includes('زراعت') || cat.includes('کشاورزی') || cat.includes('دام')
        if (tseCategoryFilter === 'tech') return cat.includes('رایانه') || cat.includes('اطلاعات') || cat.includes('مخابرات')
        return true
      })
    }
    const q = tseSearchQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.inscode.includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(q))
    )
  }, [tseInstrumentsList, tseSearchQuery, tseCategoryFilter])

  /**
   * انتخاب نماد از لیست رسمی بورس و درج آنی ارزش هر واحد در فیلد بهای خرید هر واحد (تومان)
   * و محاسبه خودکار ارزش روز کل و بهای کل خرید بر اساس تعداد واحد وارد شده
   */
  function selectTseInstrument(item: TseInstrumentSummary) {
    setInvSymbol(item.symbol)
    setInvInscode(item.inscode)
    setInvName(item.name)

    // درج فوری و خودکار آخرین ارزش/قیمت معامله در فیلد «بهای خرید هر واحد» و «ارزش روز هر واحد»
    const pricePerUnit = item.lastPrice || item.closingPrice || 0
    if (pricePerUnit > 0) {
      const displayPrice = currencyUnit === 'IRT' ? Math.round(pricePerUnit / 10) : pricePerUnit
      setInvUnitPrice(formatSeparatedNumber(displayPrice))
      setInvCurrentUnitPrice(formatSeparatedNumber(displayPrice))

      // محاسبه خودکار ارزش روز کل و بهای کل بر اساس تعداد واحد
      const q = Number(digitsOnly(invQuantity))
      if (q > 0) {
        const totalCalculated = q * displayPrice
        setInvCurrentValue(formatSeparatedNumber(totalCalculated))
        setInvBuyPrice(formatSeparatedNumber(totalCalculated))
      }

      setTseDetails({
        lastPrice: item.lastPrice || pricePerUnit,
        closingPrice: item.closingPrice || pricePerUnit,
        changePercent: item.changePercent || 0,
        source: 'tsetmc',
      })
      const sign = (item.changePercent || 0) > 0 ? '+' : ''
      setTseInfo(
        `✓ نماد «${item.symbol}» با موفقیت انتخاب شد. آخرین بهای هر واحد: ${formatMoney(displayPrice)} در فیلد بهای خرید هر واحد (${unitLabel}) درج شد (${sign}${toFaDigits(item.changePercent || 0)}٪).`
      )
      notifyUser(`ارزش هر واحد نماد «${item.symbol}» در فیلد بهای خرید هر واحد قرار گرفت`)
    }

    setIsTsePickerOpen(false)
  }

  /**
   * استعلام آخرین قیمت معاملاتی از وب‌سرویس بک‌اند با استفاده از کد نماد یا نماد
   */
  async function fetchTseQuote(
    symbol: string,
    inscode?: string
  ): Promise<{
    price: number
    lastPrice: number
    closingPrice: number
    name: string
    symbol: string
    inscode: string
    changePercent: number
    source?: string
  } | null> {
    const clean = symbol.trim()
    const cleanCode = (inscode || '').trim()
    if (!clean && !cleanCode) return null
    try {
      // اگر کد نماد وجود دارد، مستقیماً از وب‌سرویس اختصاصی بر اساس کد نماد استعلام می‌شود
      const qUrl = cleanCode
        ? `/api/v1/tsetmc/quote-by-inscode/${encodeURIComponent(cleanCode)}?symbol=${encodeURIComponent(clean)}`
        : `/api/v1/tsetmc/quote/${encodeURIComponent(clean)}`
      const res = await fetch(qUrl)
      if (!res.ok) return null
      const json = await res.json()
      if (json.success && typeof json.price === 'number') {
        return {
          price: json.price,
          lastPrice: json.lastPrice || json.price,
          closingPrice: json.closingPrice || json.price,
          name: json.name || clean,
          symbol: json.symbol || clean,
          inscode: json.inscode || cleanCode || '',
          changePercent: json.changePercent || 0,
          source: json.source || 'tsetmc',
        }
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Looks up latest quote for a selected symbol or inscode and updates form fields
   */
  async function handleTseLookup(symbolToLookup?: string, inscodeToLookup?: string) {
    const sym = (symbolToLookup || invSymbol || invName).trim()
    const code = inscodeToLookup || invInscode
    if (!sym && !code) {
      notifyUser('لطفاً یک نماد را از لیست نمادهای بورس انتخاب کنید')
      return
    }
    setTseLoading(true)
    setTseInfo(null)
    setTseDetails(null)
    try {
      const quote = await fetchTseQuote(sym, code)
      if (quote) {
        // TSETMC returns prices in Rials
        const pricePerUnit = quote.lastPrice || quote.price
        const displayPrice = currencyUnit === 'IRT' ? Math.round(pricePerUnit / 10) : pricePerUnit
        setInvUnitPrice(formatSeparatedNumber(displayPrice))
        setInvCurrentUnitPrice(formatSeparatedNumber(displayPrice))
        if (!invName.trim() || invName === invSymbol) {
          setInvName(quote.name)
        }
        if (quote.inscode) {
          setInvInscode(quote.inscode)
        }
        setTseDetails({
          lastPrice: quote.lastPrice || quote.price,
          closingPrice: quote.closingPrice,
          changePercent: quote.changePercent,
          source: quote.source || 'tsetmc',
        })
        const sign = quote.changePercent > 0 ? '+' : ''
        setTseInfo(`✓ آخرین ارزش هر واحد «${quote.name}»: ${formatMoney(displayPrice)} (${sign}${toFaDigits(quote.changePercent)}٪) در بهای خرید هر واحد (${unitLabel}) درج شد`)
        notifyUser(`ارزش هر واحد نماد «${quote.symbol || quote.name}» در بهای خرید هر واحد قرار گرفت`)

        // اگر تعداد وارد شده باشد، بهای کل خرید و ارزش روز کل محاسبه و قرار گیرد
        const q = Number(digitsOnly(invQuantity))
        if (q > 0) {
          const totalVal = q * displayPrice
          setInvCurrentValue(formatSeparatedNumber(totalVal))
          setInvBuyPrice(formatSeparatedNumber(totalVal))
        }
      } else {
        if (!invUnitPrice && !invCurrentUnitPrice) {
          setTseInfo('نماد در سامانه بورس دریافت نشد؛ لطفاً قیمت را دستی وارد کنید.')
          notifyUser('اطلاعات نماد دریافت نشد')
        }
      }
    } catch {
      if (!invCurrentUnitPrice) {
        setTseInfo('خطا در ارتباط با سرور بورس')
      }
    } finally {
      setTseLoading(false)
    }
  }

  /**
   * Batch refresh all stock and fund assets in portfolio from TSETMC
   */
  async function refreshTseQuotes(silent = false) {
    const tseAssets = investments.filter((i) => i.market === 'stock' || i.market === 'fund' || i.symbol)
    if (tseAssets.length === 0) return
    setIsRefreshingTse(true)
    let updatedCount = 0
    try {
      const batchPayload = tseAssets.map((a) => ({ symbol: a.symbol || a.name, inscode: a.inscode }))
      const res = await fetch('/api/v1/tsetmc/batch-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: batchPayload }),
      })
      if (res.ok) {
        const json = await res.json()
        const quotes = json.quotes || {}
        for (const asset of tseAssets) {
          const key = asset.symbol || asset.name
          const quote = quotes[key]
          if (quote && typeof quote.price === 'number' && quote.price > 0) {
            const newUnitPrice = quote.lastPrice || quote.price
            const q = asset.quantity || 1
            const newTotalValue = Math.round(q * newUnitPrice)
            if (newTotalValue !== asset.currentValue || newUnitPrice !== asset.currentUnitPrice) {
              await saveInvestment({
                ...asset,
                currentUnitPrice: newUnitPrice,
                currentValue: newTotalValue,
                inscode: quote.inscode || asset.inscode,
              })
              updatedCount++
            }
          }
        }
      }
      if (!silent) {
        notifyUser(
          updatedCount > 0
            ? `${toFaDigits(updatedCount)} دارایی با آخرین قیمت‌های بورس TSETMC بروزرسانی شدند.`
            : 'قیمت دارایی‌های بورس به روز است.'
        )
      }
    } catch {
      if (!silent) notifyUser('خطا در به‌روزرسانی قیمت‌های بورس')
    } finally {
      setIsRefreshingTse(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. DONG STATE & LOGIC
  // ─────────────────────────────────────────────────────────────
  const [dongFilter, setDongFilter] = useState<'active' | 'settled'>('active')
  const [selectedDongId, setSelectedDongId] = useState<string | null>(null)
  const [isCreateDongOpen, setIsCreateDongOpen] = useState(false)
  const [dongTitle, setDongTitle] = useState('')
  const [dongMemberInput, setDongMemberInput] = useState('')
  const [dongMembers, setDongMembers] = useState<string[]>(['من'])
  const [editingMemberIdx, setEditingMemberIdx] = useState<number | null>(null)
  const [editingMemberName, setEditingMemberName] = useState('')

  // Selected Dong detail view states
  const selectedDongEvent = useMemo(
    () => (selectedDongId ? dongEvents.find((d) => d.id === selectedDongId) : null),
    [dongEvents, selectedDongId]
  )
  const dongSummary = useMemo(() => {
    if (!selectedDongEvent) return { transfers: [], balances: [], totalCost: 0 }
    return computeDongSettlement(selectedDongEvent)
  }, [selectedDongEvent])
  const activeDongTransfers = dongSummary.transfers

  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null)
  const [editingParticipantName, setEditingParticipantName] = useState('')
  const [eventNewMemberInput, setEventNewMemberInput] = useState('')

  // Expense form states
  const [editingExpId, setEditingExpId] = useState<string | null>(null)
  const [newExpTitle, setNewExpTitle] = useState('')
  const [newExpAmount, setNewExpAmount] = useState('')
  const [newExpPayer, setNewExpPayer] = useState('')
  const [newExpSplits, setNewExpSplits] = useState<string[]>([])
  const [newExpSplitMode, setNewExpSplitMode] = useState<'equal' | 'custom'>('equal')
  const [newExpCustomAmounts, setNewExpCustomAmounts] = useState<Record<string, string>>({})
  const [manualEditedIds, setManualEditedIds] = useState<Set<string>>(new Set())

  // Automatic balanced distribution for "تقسیم دستی"
  const recalculateManualDistribution = (
    totalUnits: number,
    splits: string[],
    manuallyEdited: Set<string>,
    currentAmounts: Record<string, string>
  ) => {
    if (splits.length === 0) return currentAmounts
    const nextAmounts: Record<string, string> = { ...currentAmounts }

    let sumManualUnits = 0
    const autoIds: string[] = []

    for (const id of splits) {
      if (manuallyEdited.has(id)) {
        const valUnits = Number(digitsOnly(nextAmounts[id] ?? '0')) || 0
        sumManualUnits += valUnits
      } else {
        autoIds.push(id)
      }
    }

    if (autoIds.length > 0) {
      const remainingUnits = Math.max(0, totalUnits - sumManualUnits)
      const basePerUserUnits = Math.floor(remainingUnits / autoIds.length)
      const remainderUnits = remainingUnits % autoIds.length

      autoIds.forEach((id, idx) => {
        const userUnits = basePerUserUnits + (idx < remainderUnits ? 1 : 0)
        nextAmounts[id] = formatSeparatedNumber(userUnits)
      })
    }

    return nextAmounts
  }

  // Handle total amount change in expense form
  const handleExpenseAmountChange = (rawText: string) => {
    const formatted = formatSeparatedNumber(rawText)
    setNewExpAmount(formatted)
    if (newExpSplitMode === 'custom' && selectedDongEvent) {
      const splits = newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
      const totalUnits = Number(digitsOnly(formatted)) || 0
      const updated = recalculateManualDistribution(totalUnits, splits, manualEditedIds, newExpCustomAmounts)
      setNewExpCustomAmounts(updated)
    }
  }

  // Reset custom amounts back to equal distribution
  const resetCustomAmountsToEqual = () => {
    if (!selectedDongEvent) return
    const splits = newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
    const totalUnits = Number(digitsOnly(newExpAmount)) || 0
    setManualEditedIds(new Set())
    const balanced = recalculateManualDistribution(totalUnits, splits, new Set(), {})
    setNewExpCustomAmounts(balanced)
  }

  // Handle individual user manual amount change
  const handleUserCustomAmountChange = (participantId: string, val: string) => {
    const formatted = formatSeparatedNumber(val)
    const splits = selectedDongEvent
      ? (newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id))
      : []

    const nextEdited = new Set(manualEditedIds)
    if (digitsOnly(val) === '') {
      nextEdited.delete(participantId)
    } else {
      nextEdited.add(participantId)
      if (nextEdited.size >= splits.length && splits.length > 1) {
        nextEdited.clear()
        nextEdited.add(participantId)
      }
    }
    setManualEditedIds(nextEdited)

    const updatedAmounts = { ...newExpCustomAmounts, [participantId]: formatted }
    if (selectedDongEvent) {
      const totalUnits = Number(digitsOnly(newExpAmount)) || 0
      const balanced = recalculateManualDistribution(totalUnits, splits, nextEdited, updatedAmounts)
      setNewExpCustomAmounts(balanced)
    } else {
      setNewExpCustomAmounts(updatedAmounts)
    }
  }

  return (
    <div className="app-scroll" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      {/* Header */}
      <div className="top-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1>مدیریت بودجه و دارایی‌ها</h1>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 8,
                background: 'rgba(37, 99, 235, 0.15)',
                color: 'var(--hy-accent)',
                fontWeight: 700,
              }}
            >
              نسخه ۰.۳.۰
            </span>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--hy-text-secondary)' }}>
            بودجه‌بندی هوشمند، اهداف پس‌انداز، سبد سرمایه‌گذاری و محاسبه‌گر دونگ
          </p>
        </div>
        <SettingsButton />
      </div>

      {/* Top Summary Banner */}
      <div
        className="home-card lg"
        style={{
          margin: '12px 0 16px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(15, 118, 110, 0.22) 0%, rgba(30, 27, 75, 0.35) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>سقف بودجه ماهانه</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: 'var(--hy-text)' }}>
              {formatCompactMoney(totalBudgetSpent)}
              <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}> / {formatCompactMoney(totalBudgetLimit)}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--hy-teal)', marginTop: 2 }}>
              {totalBudgetLimit > 0
                ? `${toFaDigits(Math.round((totalBudgetSpent / totalBudgetLimit) * 100))}% مصرف شده`
                : 'بدون سقف تعیین‌شده'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>مجموع پس‌انداز هدف</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: 'var(--hy-income)' }}>
              {formatCompactMoney(totalSavedGoals)}
            </div>
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
              از کل هدف {formatCompactMoney(totalTargetGoals)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>ارزش کل سرمایه‌گذاری</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: 'var(--hy-accent)' }}>
              {formatCompactMoney(totalInvestmentValue)}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: totalInvestmentProfit >= 0 ? 'var(--hy-income)' : 'var(--hy-expense)',
                marginTop: 2,
              }}
            >
              {totalInvestmentProfit >= 0 ? '+' : ''}
              {toFaDigits(totalInvestmentRoi)}% بازدهی کل
            </div>
          </div>
        </div>
      </div>

      {/* Tab Segment Switcher */}
      <div
        className="seg"
        role="tablist"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          marginBottom: 16,
          background: 'var(--glass-chrome)',
          borderRadius: 14,
          padding: 4,
        }}
      >
        <button
          className={`seg-btn${activeTab === 'budget' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('budget')}
          style={{ fontSize: 13, fontWeight: 700, padding: '8px 4px' }}
        >
          📊 بودجه‌بندی
        </button>
        <button
          className={`seg-btn${activeTab === 'goals' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('goals')}
          style={{ fontSize: 13, fontWeight: 700, padding: '8px 4px' }}
        >
          🎯 اهداف مالی
        </button>
        <button
          className={`seg-btn${activeTab === 'investments' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('investments')}
          style={{ fontSize: 13, fontWeight: 700, padding: '8px 4px' }}
        >
          📈 سرمایه‌گذاری
        </button>
        <button
          className={`seg-btn${activeTab === 'dong' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('dong')}
          style={{ fontSize: 13, fontWeight: 700, padding: '8px 4px' }}
        >
          👥 محاسبه دونگ
        </button>
      </div>

      {/* ────────────────── 1. BUDGETING TAB ────────────────── */}
      {activeTab === 'budget' && (
        <div className="split-wide">
          {/* Visual Expense Distribution Chart */}
          <section className="lg report-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2>نمودار تحلیلی هزینه‌های این ماه</h2>
              <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>
                کل مخارج: {formatMoney(bars.reduce((sum, b) => sum + b.amount, 0))}
              </span>
            </div>

            {bars.length === 0 ? (
              <p className="sheet-sub" style={{ margin: '20px 0', textAlign: 'center' }}>
                هزینه‌ای در این ماه ثبت نشده است.
              </p>
            ) : (
              <div>
                {/* SVG Visual Donut Breakdown */}
                {(() => {
                  const totalExp = bars.reduce((sum, b) => sum + b.amount, 0)
                  if (totalExp === 0) return null
                  const radius = 60
                  const circumference = 2 * Math.PI * radius
                  let accumulatedPercent = 0

                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 24,
                        padding: '16px 8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
                        <svg width="150" height="150" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                          <circle cx="80" cy="80" r={radius} fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
                          {bars.map((bar, idx) => {
                            const percent = bar.amount / totalExp
                            const strokeDasharray = `${percent * circumference} ${circumference}`
                            const strokeDashoffset = -accumulatedPercent * circumference
                            accumulatedPercent += percent
                            const color = DONUT_COLORS[idx % DONUT_COLORS.length]
                            return (
                              <circle
                                key={bar.id}
                                cx="80"
                                cy="80"
                                r={radius}
                                fill="transparent"
                                stroke={color}
                                strokeWidth="18"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                style={{ transition: 'all 0.4s ease' }}
                              />
                            )
                          })}
                        </svg>
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            pointerEvents: 'none',
                          }}
                        >
                          <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>کل مخارج</span>
                          <span style={{ fontSize: 12, fontWeight: 800, marginTop: 2 }}>{formatCompactMoney(totalExp)}</span>
                        </div>
                      </div>

                      {/* Legend Grid */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 }}>
                        {bars.slice(0, 5).map((bar, idx) => {
                          const percent = Math.round((bar.amount / totalExp) * 100)
                          const color = DONUT_COLORS[idx % DONUT_COLORS.length]
                          return (
                            <div key={bar.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                                <span style={{ fontWeight: 600 }}>{bar.name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 700 }}>{formatMoney(bar.amount)}</span>
                                <span style={{ fontSize: 10, opacity: 0.6 }}>({toFaDigits(percent)}٪)</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Progress bars list */}
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bars.map((bar) => {
                    const maxBar = Math.max(1, ...bars.map((b) => b.amount))
                    const ratio = Math.min(100, Math.round((bar.amount / maxBar) * 100))
                    return (
                      <div key={bar.id} className="cat-bar-row">
                        <span className="name">{bar.name}</span>
                        <span className="track">
                          <span style={{ width: `${ratio}%` }} />
                        </span>
                        <span className="amt">{formatMoney(bar.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Budget Limits Section: ALWAYS SHOW REGISTERED LIST FIRST */}
          <section className="lg report-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2>سقف بودجه ماهانه دسته‌ها</h2>
                <p className="sheet-sub" style={{ margin: 0 }}>
                  برای هر دسته‌بندی سقف تعیین کنید تا مخارج از کنترل خارج نشود.
                </p>
              </div>
              <button
                className="cta-confirm"
                type="button"
                style={{ height: 36, fontSize: 12, padding: '0 14px', whiteSpace: 'nowrap' }}
                onClick={() => {
                  setBudgetLimitInput('')
                  setIsCreateBudgetOpen(true)
                }}
              >
                + سقف جدید
              </button>
            </div>

            {/* List of registered budgets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {budgets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 14px', color: 'var(--hy-text-secondary)' }}>
                  <span style={{ fontSize: 32 }}>📊</span>
                  <p style={{ marginTop: 8 }}>هنوز سقفی برای دسته‌بندی‌ها ثبت نشده است.</p>
                  <button
                    className="cat-mini"
                    type="button"
                    style={{ marginTop: 8 }}
                    onClick={() => setIsCreateBudgetOpen(true)}
                  >
                    + تعریف اولین سقف بودجه
                  </button>
                </div>
              ) : (
                budgets.map((budget) => {
                  const spent = spentInCategory(transactions, month, budget.categoryId)
                  const name =
                    categoriesFor('expense', customCategories).find((cat) => cat.id === budget.categoryId)?.name ??
                    'دسته'
                  const ratio = Math.min(100, Math.round((spent / budget.monthlyLimit) * 100))
                  const isOver = spent > budget.monthlyLimit
                  const isWarning = ratio >= 80 && !isOver

                  return (
                    <div key={budget.id} className="goal-row" style={{ padding: '12px 14px' }}>
                      <div className="plan-top" style={{ marginBottom: 6 }}>
                        <div>
                          <div className="plan-name" style={{ fontWeight: 700 }}>
                            {name}
                          </div>
                          <div className="plan-meta" style={{ fontSize: 11, marginTop: 2 }}>
                            {formatMoney(spent)} از {formatMoney(budget.monthlyLimit)}
                            {isOver ? (
                              <span style={{ color: 'var(--hy-expense)', fontWeight: 700, marginRight: 6 }}>
                                ⚠️ عبور از سقف!
                              </span>
                            ) : isWarning ? (
                              <span style={{ color: '#d97706', fontWeight: 600, marginRight: 6 }}>
                                ⚡ نزدیک به سقف
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <button
                          className="cat-mini danger"
                          type="button"
                          onClick={() => {
                            void deleteBudget(budget.id)
                            notifyUser('سقف بودجه حذف شد')
                          }}
                        >
                          حذف
                        </button>
                      </div>
                      <div className={`progress-bar${isOver ? ' overdue' : ''}`}>
                        <span
                          style={{
                            width: `${ratio}%`,
                            background: isOver ? 'var(--hy-expense)' : isWarning ? '#f59e0b' : 'var(--hy-teal)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Modal for Creating Budget Limit */}
          {isCreateBudgetOpen && (
            <WindowPopup
              title="تعریف سقف بودجه جدید"
              subtitle="تنظیم سقف ماهانه و مدیریت دسته‌بندی‌ها"
              icon="📊"
              isOpen={true}
              onClose={() => setIsCreateBudgetOpen(false)}
              defaultWidth={460}
              defaultHeight={480}
            >
              <div className="sheet-body-scroll" style={{ padding: '4px 0 16px' }}>
                <div className="field-stack">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>دسته‌بندی هزینه:</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="cat-mini"
                        type="button"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          setShowEditCatRow(!showEditCatRow)
                          setShowAddCatRow(false)
                          const cur = categoriesFor('expense', customCategories).find((c) => c.id === budgetCategoryId)
                          setEditCatName(cur?.name || '')
                        }}
                      >
                        {showEditCatRow ? 'انصراف' : '✏️ ویرایش نام'}
                      </button>
                      <button
                        className="cat-mini"
                        type="button"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          setShowAddCatRow(!showAddCatRow)
                          setShowEditCatRow(false)
                        }}
                      >
                        {showAddCatRow ? 'انصراف' : '+ دسته جدید'}
                      </button>
                    </div>
                  </div>

                  {showAddCatRow ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="field-input"
                        placeholder="نام دسته جدید…"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                      />
                      <button
                        className="cat-mini"
                        type="button"
                        onClick={async () => {
                          if (!newCatName.trim()) return
                          try {
                            const created = await createCategory('expense', newCatName.trim())
                            setBudgetCategoryId(created.id)
                            setNewCatName('')
                            setShowAddCatRow(false)
                            notifyUser(`دسته «${created.name}» ساخته شد`)
                          } catch (err) {
                            notifyUser(err instanceof Error ? err.message : 'خطا در ایجاد دسته')
                          }
                        }}
                      >
                        ثبت دسته
                      </button>
                    </div>
                  ) : null}

                  {showEditCatRow ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="field-input"
                        placeholder="نام جدید دسته…"
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                      />
                      <button
                        className="cat-mini"
                        type="button"
                        onClick={async () => {
                          if (!editCatName.trim()) return
                          try {
                            await renameCategory(budgetCategoryId, editCatName.trim())
                            setShowEditCatRow(false)
                            notifyUser('نام دسته با موفقیت ویرایش شد')
                          } catch (err) {
                            notifyUser(err instanceof Error ? err.message : 'خطا در ویرایش نام دسته')
                          }
                        }}
                      >
                        ذخیره نام
                      </button>
                    </div>
                  ) : null}

                  <select
                    className="field-input"
                    value={budgetCategoryId}
                    onChange={(e) => setBudgetCategoryId(e.target.value)}
                    aria-label="دسته بودجه"
                  >
                    {categoriesFor('expense', customCategories).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  <label style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>سقف ماهانه ({unitLabel}):</label>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    placeholder={`مثلاً ۵,۰۰۰,۰۰۰ ${unitLabel}`}
                    value={budgetLimitInput}
                    onChange={(e) => setBudgetLimitInput(formatSeparatedNumber(e.target.value))}
                  />

                  <button
                    className="cta-confirm"
                    type="button"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      const monthlyLimit = parseAmountToRials(budgetLimitInput)
                      if (!monthlyLimit) {
                        notifyUser('لطفاً مبلغ سقف را وارد کنید')
                        return
                      }
                      void saveBudget({ id: createId('bud'), categoryId: budgetCategoryId, monthlyLimit })
                      setBudgetLimitInput('')
                      setIsCreateBudgetOpen(false)
                      notifyUser('سقف بودجه ذخیره شد')
                    }}
                  >
                    ثبت و ذخیره سقف بودجه
                  </button>
                </div>
              </div>
            </WindowPopup>
          )}
        </div>
      )}

      {/* ────────────────── 2. SAVINGS GOALS TAB ────────────────── */}
      {activeTab === 'goals' && (
        <div>
          {/* Header row with + New Goal button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="seg" style={{ margin: 0, padding: 2 }}>
              <button
                className={`seg-btn${goalsTab === 'active' ? ' active' : ''}`}
                type="button"
                onClick={() => setGoalsTab('active')}
                style={{ fontSize: 12, padding: '4px 14px' }}
              >
                🎯 اهداف فعال ({toFaDigits(activeGoalsList.length)})
              </button>
              <button
                className={`seg-btn${goalsTab === 'archived' ? ' active' : ''}`}
                type="button"
                onClick={() => setGoalsTab('archived')}
                style={{ fontSize: 12, padding: '4px 14px' }}
              >
                🗄️ بایگانی شده ({toFaDigits(archivedGoalsList.length)})
              </button>
            </div>

            <button
              className="cta-confirm"
              type="button"
              style={{ height: 36, fontSize: 12, padding: '0 14px' }}
              onClick={() => {
                setGoalName('')
                setGoalTarget('')
                setIsCreateGoalOpen(true)
              }}
            >
              + هدف جدید
            </button>
          </div>

          {/* List of Goals */}
          <section className="lg report-card">
            {((goalsTab === 'active' ? activeGoalsList : archivedGoalsList).length === 0) ? (
              <div style={{ textAlign: 'center', padding: '36px 14px', color: 'var(--hy-text-secondary)' }}>
                <span style={{ fontSize: 32 }}>🎯</span>
                <p style={{ marginTop: 8 }}>
                  {goalsTab === 'active' ? 'هنوز هدفی برای پس‌انداز ایجاد نکرده‌اید.' : 'هدف بایگانی‌شده‌ای موجود نیست.'}
                </p>
                {goalsTab === 'active' ? (
                  <button
                    className="cat-mini"
                    type="button"
                    style={{ marginTop: 8 }}
                    onClick={() => setIsCreateGoalOpen(true)}
                  >
                    + ایجاد اولین هدف پس‌انداز
                  </button>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(goalsTab === 'active' ? activeGoalsList : archivedGoalsList).map((goal) => {
                  const ratio = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0
                  const marketInfo = DEFAULT_MARKETS.find((m) => m.id === goal.market)
                  const remaining = Math.max(0, goal.target - goal.saved)

                  return (
                    <div
                      key={goal.id}
                      className="goal-row"
                      style={{
                        padding: '14px 16px',
                        borderRadius: 16,
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      <div className="plan-top" style={{ marginBottom: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 16 }}>{marketInfo?.icon ?? '🎯'}</span>
                            <span style={{ fontWeight: 800, fontSize: 14 }}>{goal.name}</span>
                            {goal.archived ? (
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(255,255,255,0.1)' }}>
                                بایگانی
                              </span>
                            ) : null}
                          </div>
                          <div className="plan-meta" style={{ fontSize: 11, marginTop: 4 }}>
                            {formatMoney(goal.saved)} از {formatMoney(goal.target)} ({toFaDigits(ratio)}٪)
                            {remaining > 0 ? (
                              <span style={{ opacity: 0.7, marginRight: 6 }}>· باقیمانده: {formatMoney(remaining)}</span>
                            ) : (
                              <span style={{ color: 'var(--hy-income)', fontWeight: 700, marginRight: 6 }}>
                                🎉 هدف محقق شد!
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="cat-mini"
                            type="button"
                            title={goal.archived ? 'بازگردانی به اهداف فعال' : 'انتقال به بایگانی'}
                            onClick={() => {
                              void saveGoal({ ...goal, archived: !goal.archived })
                              notifyUser(goal.archived ? 'هدف به لیست فعال بازگردانده شد' : 'هدف بایگانی شد')
                            }}
                          >
                            {goal.archived ? '↺ بازگردانی' : '🗄️ بایگانی'}
                          </button>
                          <button
                            className="cat-mini danger"
                            type="button"
                            onClick={() => {
                              void deleteGoal(goal.id)
                              notifyUser('هدف پس‌انداز حذف شد')
                            }}
                          >
                            حذف
                          </button>
                        </div>
                      </div>

                      <div className="progress-bar" style={{ height: 8, marginBottom: 10 }}>
                        <span
                          style={{
                            width: `${ratio}%`,
                            background: ratio >= 100 ? 'var(--hy-income)' : 'var(--hy-accent)',
                          }}
                        />
                      </div>

                      {/* Deposit Actions if Active */}
                      {!goal.archived ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            className="cat-mini"
                            type="button"
                            style={{ background: 'rgba(16, 185, 129, 0.18)', color: 'var(--hy-income)', border: 'none' }}
                            onClick={() => {
                              const add = Math.round(goal.target * 0.1)
                              void saveGoal({ ...goal, saved: Math.min(goal.target, goal.saved + add) })
                              notifyUser(`۱۰٪ (${formatCompactMoney(add)}) به پس‌انداز اضافه شد`)
                            }}
                          >
                            +۱۰٪ واریز
                          </button>
                          <button
                            className="cat-mini"
                            type="button"
                            style={{ background: 'rgba(16, 185, 129, 0.18)', color: 'var(--hy-income)', border: 'none' }}
                            onClick={() => {
                              const add = Math.round(goal.target * 0.25)
                              void saveGoal({ ...goal, saved: Math.min(goal.target, goal.saved + add) })
                              notifyUser(`۲۵٪ به پس‌انداز اضافه شد`)
                            }}
                          >
                            +۲۵٪ واریز
                          </button>

                          <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 150 }}>
                            <input
                              className="field-input"
                              style={{ padding: '4px 8px', fontSize: 11, height: 30 }}
                              placeholder={`مبلغ دلخواه (${unitLabel})`}
                              value={goalDepositAmount[goal.id] || ''}
                              onChange={(e) =>
                                setGoalDepositAmount({ ...goalDepositAmount, [goal.id]: formatSeparatedNumber(e.target.value) })
                              }
                            />
                            <button
                              className="cat-mini"
                              type="button"
                              onClick={() => {
                                const deposit = parseAmountToRials(goalDepositAmount[goal.id] || '')
                                if (!deposit) return
                                void saveGoal({ ...goal, saved: goal.saved + deposit })
                                setGoalDepositAmount({ ...goalDepositAmount, [goal.id]: '' })
                                notifyUser(`${formatMoney(deposit)} به پس‌انداز اضافه شد`)
                              }}
                            >
                              واریز
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Modal for Creating Goal */}
          {isCreateGoalOpen && (
            <WindowPopup
              title="ساخت هدف پس‌انداز جدید"
              subtitle="تعیین هدف برای خرید مسکن، طلا، خودرو یا موارد دیگر"
              icon="🎯"
              isOpen={true}
              onClose={() => setIsCreateGoalOpen(false)}
              defaultWidth={480}
              defaultHeight={460}
            >
              <div className="sheet-body-scroll" style={{ padding: '4px 0 16px' }}>
                <div className="field-stack">
                  <label style={{ fontSize: 12, fontWeight: 700 }}>عنوان هدف:</label>
                  <input
                    className="field-input"
                    placeholder="نام هدف (مثلاً: رهن آپارتمان، خرید لپ‌تاپ)"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                  />

                  <label style={{ fontSize: 12, fontWeight: 700 }}>مبلغ کل هدف ({unitLabel}):</label>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    placeholder={`مبلغ هدف (${unitLabel})`}
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(formatSeparatedNumber(e.target.value))}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: 12, fontWeight: 700 }}>نوع و بازار پس‌انداز:</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="cat-mini"
                        type="button"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          setShowEditGoalCat(!showEditGoalCat)
                          setShowAddGoalCat(false)
                          const cur = goalMarkets.find((m) => m.id === goalMarket)
                          setEditGoalCatName(cur?.label || '')
                        }}
                      >
                        {showEditGoalCat ? 'انصراف' : '✏️ ویرایش نام'}
                      </button>
                      <button
                        className="cat-mini"
                        type="button"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          setShowAddGoalCat(!showAddGoalCat)
                          setShowEditGoalCat(false)
                        }}
                      >
                        {showAddGoalCat ? 'انصراف' : '+ دسته جدید'}
                      </button>
                    </div>
                  </div>

                  {showAddGoalCat ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="field-input"
                        style={{ width: 44, textAlign: 'center' }}
                        value={newGoalCatIcon}
                        onChange={(e) => setNewGoalCatIcon(e.target.value)}
                        title="آیکون دسته"
                      />
                      <input
                        className="field-input"
                        placeholder="نام دسته جدید (مثلاً: خودرو، سفر)…"
                        value={newGoalCatName}
                        onChange={(e) => setNewGoalCatName(e.target.value)}
                      />
                      <button
                        className="cat-mini"
                        type="button"
                        onClick={() => {
                          if (!newGoalCatName.trim()) return
                          const newId = `gcat_${Date.now()}`
                          const updated = [...goalMarkets, { id: newId, label: newGoalCatName.trim(), icon: newGoalCatIcon || '🎯' }]
                          saveGoalMarkets(updated)
                          setGoalMarket(newId)
                          setNewGoalCatName('')
                          setShowAddGoalCat(false)
                          notifyUser(`دسته «${newGoalCatName.trim()}» ایجاد شد`)
                        }}
                      >
                        ثبت دسته
                      </button>
                    </div>
                  ) : null}

                  {showEditGoalCat ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="field-input"
                        placeholder="نام جدید دسته…"
                        value={editGoalCatName}
                        onChange={(e) => setEditGoalCatName(e.target.value)}
                      />
                      <button
                        className="cat-mini"
                        type="button"
                        onClick={() => {
                          if (!editGoalCatName.trim()) return
                          const updated = goalMarkets.map((m) =>
                            m.id === goalMarket ? { ...m, label: editGoalCatName.trim() } : m
                          )
                          saveGoalMarkets(updated)
                          setShowEditGoalCat(false)
                          notifyUser('نام دسته‌بندی ویرایش شد')
                        }}
                      >
                        ذخیره
                      </button>
                    </div>
                  ) : null}

                  <select
                    className="field-input"
                    value={goalMarket}
                    onChange={(e) => setGoalMarket(e.target.value)}
                    aria-label="نوع پس‌انداز"
                  >
                    {goalMarkets.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.icon} {m.label}
                      </option>
                    ))}
                  </select>

                  <button
                    className="cta-confirm"
                    type="button"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      const target = parseAmountToRials(goalTarget)
                      if (!goalName.trim() || !target) {
                        notifyUser('نام و مبلغ هدف الزامی است')
                        return
                      }
                      void saveGoal({
                        name: goalName.trim(),
                        target,
                        saved: 0,
                        market: goalMarket,
                        archived: false,
                      })
                      setGoalName('')
                      setGoalTarget('')
                      setIsCreateGoalOpen(false)
                      notifyUser('هدف پس‌انداز با موفقیت ساخته شد')
                    }}
                  >
                    ثبت و ساخت هدف پس‌انداز
                  </button>
                </div>
              </div>
            </WindowPopup>
          )}
        </div>
      )}

      {/* ────────────────── 3. INVESTMENTS TAB ────────────────── */}
      {activeTab === 'investments' && (
        <div>
          {/* Top action row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            {/* Filter buttons: ONLY existing markets in user portfolio + all */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              <button
                className={`cat-mini${invMarketFilter === 'all' ? ' active' : ''}`}
                type="button"
                onClick={() => setInvMarketFilter('all')}
              >
                همه دارایی‌ها ({toFaDigits(investments.length)})
              </button>
              {existingInvMarkets.map((m) => {
                const count = investments.filter((i) => i.market === m.id).length
                return (
                  <button
                    key={m.id}
                    className={`cat-mini${invMarketFilter === m.id ? ' active' : ''}`}
                    type="button"
                    onClick={() => setInvMarketFilter(m.id)}
                  >
                    {m.icon} {m.label} ({toFaDigits(count)})
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                className="cat-mini"
                type="button"
                disabled={isRefreshingTse}
                title="استعلام آخرین قیمت روز از بورس تهران (TSETMC)"
                onClick={() => void refreshTseQuotes(false)}
                style={{ fontSize: 11, background: 'rgba(37, 99, 235, 0.15)', color: 'var(--hy-accent)' }}
              >
                {isRefreshingTse ? 'در حال دریافت...' : '🔄 به‌روزرسانی بورس'}
              </button>
              <button
                className="cta-confirm"
                type="button"
                style={{ height: 36, fontSize: 12, padding: '0 14px' }}
                onClick={() => {
                  setEditingInv(null)
                  setInvName('')
                  setInvSymbol('')
                  setInvInscode('')
                  setInvMarket('stock')
                  setInvQuantity('')
                  setInvUnitPrice('')
                  setInvCurrentUnitPrice('')
                  setInvBuyPrice('')
                  setInvCurrentValue('')
                  setInvNote('')
                  setTseInfo(null)
                  setTseDetails(null)
                  setIsCreateInvOpen(true)
                }}
              >
                + دارایی جدید
              </button>
            </div>
          </div>

          {/* Investment Portfolio List: ALWAYS DISPLAYED FIRST */}
          <section className="lg report-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2>سبد دارایی‌ها ({toFaDigits(filteredInvestments.length)})</h2>
              <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                ارزش روز کل: <strong>{formatMoney(totalInvestmentValue)}</strong>
              </span>
            </div>

            {filteredInvestments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 14px', color: 'var(--hy-text-secondary)' }}>
                <span style={{ fontSize: 32 }}>📈</span>
                <p style={{ marginTop: 8 }}>هیچ دارایی در این دسته‌بندی ثبت نشده است.</p>
                <button
                  className="cat-mini"
                  type="button"
                  style={{ marginTop: 8 }}
                  onClick={() => setIsCreateInvOpen(true)}
                >
                  + افزودن دارایی یا نماد بورسی
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredInvestments.map((asset) => {
                  const profit = asset.currentValue - asset.purchaseAmount
                  const roiNum = asset.purchaseAmount > 0 ? (profit / asset.purchaseAmount) * 100 : 0
                  const roiStr = Math.abs(roiNum).toFixed(1)
                  const isLoss = profit < 0
                  const isGain = profit > 0
                  const marketMeta = DEFAULT_INVESTMENT_MARKETS.find((m) => m.id === asset.market)

                  return (
                    <div
                      key={asset.id}
                      className="home-card lg"
                      style={{
                        padding: '14px 16px',
                        borderRadius: 16,
                        border: isLoss ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                        background: isLoss ? 'rgba(239, 68, 68, 0.04)' : 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 17 }}>{marketMeta?.icon ?? '📦'}</span>
                            <span style={{ fontWeight: 800, fontSize: 15 }}>{asset.name}</span>
                            {asset.symbol ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  background: 'rgba(37, 99, 235, 0.2)',
                                  color: 'var(--hy-accent)',
                                }}
                              >
                                نماد: {asset.symbol}
                              </span>
                            ) : null}
                            <span
                              style={{
                                fontSize: 10,
                                padding: '2px 6px',
                                borderRadius: 6,
                                background: 'rgba(255,255,255,0.08)',
                                color: 'var(--hy-text-secondary)',
                              }}
                            >
                              {marketMeta?.label}
                            </span>

                            {/* درصد اختلاف بهای کل خرید با ارزش روز کل - رنگ قرمز برای منفی/کاهش */}
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 8,
                                background: isLoss ? 'rgba(239, 68, 68, 0.18)' : isGain ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.1)',
                                color: isLoss ? '#ef4444' : isGain ? '#10b981' : 'var(--hy-text-secondary)',
                                border: `1px solid ${isLoss ? '#ef4444' : isGain ? '#10b981' : 'rgba(255, 255, 255, 0.2)'}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                            >
                              <span>اختلاف:</span>
                              <span style={{ direction: 'ltr', fontWeight: 900 }}>
                                {isLoss ? `-${toFaDigits(roiStr)}%` : isGain ? `+${toFaDigits(roiStr)}%` : '۰٪'}
                              </span>
                              {isLoss && <span style={{ fontSize: 10, color: '#ef4444' }}>(کاهش)</span>}
                              {isGain && <span style={{ fontSize: 10, color: '#10b981' }}>(افزایش)</span>}
                            </span>
                          </div>

                          {asset.quantity ? (
                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                              تعداد واحد/سهم: <b>{toFaDigits(asset.quantity)}</b>
                              {asset.unitPrice ? ` · بهای خرید هر واحد: ${formatMoney(asset.unitPrice)}` : ''}
                              {asset.currentUnitPrice ? ` · ارزش روز هر واحد: ${formatMoney(asset.currentUnitPrice)}` : ''}
                            </div>
                          ) : null}
                          {asset.note ? (
                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                              {asset.note}
                            </div>
                          ) : null}
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="cat-mini"
                            type="button"
                            onClick={() => {
                              setEditingInv(asset)
                              setInvName(asset.name)
                              setInvSymbol(asset.symbol || '')
                              setInvInscode(asset.inscode || '')
                              setInvMarket(asset.market)
                              setInvQuantity(asset.quantity ? String(asset.quantity) : '')
                              setInvUnitPrice(
                                asset.unitPrice
                                  ? String(currencyUnit === 'IRT' ? Math.round(asset.unitPrice / 10) : asset.unitPrice)
                                  : ''
                              )
                              setInvCurrentUnitPrice(
                                asset.currentUnitPrice
                                  ? String(
                                      currencyUnit === 'IRT'
                                        ? Math.round(asset.currentUnitPrice / 10)
                                        : asset.currentUnitPrice
                                    )
                                  : ''
                              )
                              setInvBuyPrice(
                                currencyUnit === 'IRT'
                                  ? String(Math.floor(asset.purchaseAmount / 10))
                                  : String(asset.purchaseAmount)
                              )
                              setInvCurrentValue(
                                currencyUnit === 'IRT'
                                  ? String(Math.floor(asset.currentValue / 10))
                                  : String(asset.currentValue)
                              )
                              setInvNote(asset.note || '')
                              setTseInfo(null)
                              setIsCreateInvOpen(true)
                            }}
                          >
                            ویرایش
                          </button>
                          <button
                            className="cat-mini danger"
                            type="button"
                            onClick={() => {
                              void deleteInvestment(asset.id)
                              notifyUser('دارایی از سبد حذف شد')
                            }}
                          >
                            حذف
                          </button>
                        </div>
                      </div>

                      {/* Values grid: بهای کل خرید، ارزش روز کل، و اختلاف به درصد */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: 8,
                          margin: '12px 0 6px',
                          background: 'rgba(0,0,0,0.18)',
                          padding: '10px 12px',
                          borderRadius: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>بهای کل خرید</div>
                          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                            {formatCompactMoney(asset.purchaseAmount)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>ارزش روز کل</div>
                          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: 'var(--hy-accent)' }}>
                            {formatCompactMoney(asset.currentValue)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>اختلاف با بهای خرید</div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 900,
                              marginTop: 2,
                              color: isLoss ? '#ef4444' : isGain ? '#10b981' : 'var(--hy-text-secondary)',
                            }}
                          >
                            {isLoss ? '-' : isGain ? '+' : ''}
                            {toFaDigits(roiStr)}% ({formatCompactMoney(Math.abs(profit))})
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Modal for Creating / Editing Investment */}
          {isCreateInvOpen && (
            <WindowPopup
              title={editingInv ? 'ویرایش دارایی سرمایه‌گذاری' : 'ثبت دارایی سرمایه‌گذاری جدید'}
              subtitle="اتصال به بورس و محاسبه خودکار ارزش سبد"
              icon="📈"
              isOpen={true}
              onClose={() => setIsCreateInvOpen(false)}
              defaultWidth={520}
              defaultHeight={620}
            >
              <div className="sheet-body-scroll" style={{ padding: '4px 0 16px' }}>
                <div className="field-stack">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>دسته‌بندی بازار:</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="cat-mini"
                          type="button"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={() => {
                            setShowEditInvCat(!showEditInvCat)
                            setShowAddInvCat(false)
                            const cur = invMarkets.find((m) => m.id === invMarket)
                            setEditInvCatName(cur?.label || '')
                          }}
                        >
                          {showEditInvCat ? 'انصراف' : '✏️ ویرایش نام'}
                        </button>
                        <button
                          className="cat-mini"
                          type="button"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={() => {
                            setShowAddInvCat(!showAddInvCat)
                            setShowEditInvCat(false)
                          }}
                        >
                          {showAddInvCat ? 'انصراف' : '+ دسته جدید'}
                        </button>
                      </div>
                    </div>

                    {showAddInvCat ? (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input
                          className="field-input"
                          style={{ width: 44, textAlign: 'center' }}
                          value={newInvCatIcon}
                          onChange={(e) => setNewInvCatIcon(e.target.value)}
                          title="آیکون دسته"
                        />
                        <input
                          className="field-input"
                          placeholder="نام دسته جدید (مثلاً: خودرو، عتیقه‌جات)…"
                          value={newInvCatName}
                          onChange={(e) => setNewInvCatName(e.target.value)}
                        />
                        <button
                          className="cat-mini"
                          type="button"
                          onClick={() => {
                            if (!newInvCatName.trim()) return
                            const newId = `inv_${Date.now()}`
                            const updated = [...invMarkets, { id: newId, label: newInvCatName.trim(), icon: newInvCatIcon || '📦' }]
                            saveInvMarkets(updated)
                            setInvMarket(newId)
                            setNewInvCatName('')
                            setShowAddInvCat(false)
                            notifyUser(`دسته «${newInvCatName.trim()}» افزوده شد`)
                          }}
                        >
                          ثبت دسته
                        </button>
                      </div>
                    ) : null}

                    {showEditInvCat ? (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input
                          className="field-input"
                          placeholder="نام جدید دسته…"
                          value={editInvCatName}
                          onChange={(e) => setEditInvCatName(e.target.value)}
                        />
                        <button
                          className="cat-mini"
                          type="button"
                          onClick={() => {
                            if (!editInvCatName.trim()) return
                            const updated = invMarkets.map((m) =>
                              m.id === invMarket ? { ...m, label: editInvCatName.trim() } : m
                            )
                            saveInvMarkets(updated)
                            setShowEditInvCat(false)
                            notifyUser('نام دسته‌بندی ویرایش شد')
                          }}
                        >
                          ذخیره
                        </button>
                      </div>
                    ) : null}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <select
                          className="field-input"
                          value={invMarket}
                          onChange={(e) => setInvMarket(e.target.value)}
                          aria-label="بازار سرمایه‌گذاری"
                        >
                          {invMarkets.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.icon} {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <input
                          className="field-input"
                          placeholder="نام دارایی (مثلاً: صندوق اهرم، طلای آبشده)"
                          value={invName}
                          onChange={(e) => setInvName(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* TSETMC Symbol Picker & Live Price Section */}
                  {(invMarket === 'stock' || invMarket === 'fund' || invMarket === 'gold') && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: 'rgba(37, 99, 235, 0.08)',
                        border: '1.5px solid rgba(37, 99, 235, 0.28)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--hy-accent)' }}>
                          استعلام برخط قیمت از بورس تهران (TSETMC):
                        </span>
                        {invInscode ? (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 8px',
                              borderRadius: 10,
                              background: 'rgba(37, 99, 235, 0.15)',
                              color: 'var(--hy-accent)',
                              direction: 'ltr',
                              fontWeight: 600,
                            }}
                          >
                            کد نماد: {invInscode}
                          </span>
                        ) : null}
                      </div>

                      {/* Primary Button to Open TSE Instruments List */}
                      <button
                        type="button"
                        onClick={() => {
                          setTseCategoryFilter(
                            invMarket === 'gold' ? 'gold' : invMarket === 'fund' ? 'leveraged' : 'all'
                          )
                          setIsTsePickerOpen(true)
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(15, 118, 110, 0.2) 100%)',
                          border: '1.5px dashed var(--hy-accent)',
                          color: 'var(--hy-text)',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                        }}
                      >
                        <span>📋</span>
                        <span>انتخاب نماد از فهرست رسمی سهام و صندوق‌های بورس</span>
                      </button>

                      {/* Manual/Search Input & Action Button */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="field-input"
                          placeholder="نام یا نماد (مثلاً: اهرم، فملی، فولاد، عیار، طلا)"
                          value={invSymbol}
                          onChange={(e) => setInvSymbol(e.target.value)}
                        />
                        <button
                          className="cat-mini"
                          type="button"
                          disabled={tseLoading}
                          onClick={() => void handleTseLookup()}
                          style={{
                            whiteSpace: 'nowrap',
                            background: 'var(--hy-accent)',
                            color: '#fff',
                            border: 'none',
                            padding: '0 12px',
                            fontWeight: 700,
                          }}
                        >
                          {tseLoading ? 'در حال دریافت...' : '🔍 استعلام قیمت'}
                        </button>
                      </div>

                      {/* Quick Chips for Immediate Pick */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)', fontWeight: 600 }}>
                          نمادهای پرکاربرد:
                        </span>
                        {(invMarket === 'gold'
                          ? [
                              { symbol: 'عیار', inscode: '48449429711961520' },
                              { symbol: 'طلا', inscode: '20915247313278296' },
                              { symbol: 'کهربا', inscode: '24959146199622558' },
                              { symbol: 'زر', inscode: '70808810243177651' },
                              { symbol: 'ناب', inscode: '65668614488347895' },
                            ]
                          : invMarket === 'fund'
                          ? [
                              { symbol: 'اهرم', inscode: '55263175855079634' },
                              { symbol: 'شتاب', inscode: '23062821213459632' },
                              { symbol: 'موج', inscode: '60155250495818967' },
                              { symbol: 'پالایش', inscode: '28107936665796340' },
                              { symbol: 'دارا یکم', inscode: '18320491910245084' },
                              { symbol: 'افران', inscode: '61730030232532729' },
                            ]
                          : [
                              { symbol: 'فولاد', inscode: '35700344742885862' },
                              { symbol: 'فملی', inscode: '35425587644337450' },
                              { symbol: 'شستا', inscode: '2400322364771558' },
                              { symbol: 'خودرو', inscode: '65883838195688438' },
                              { symbol: 'خساپا', inscode: '44891419777264879' },
                              { symbol: 'وبملت', inscode: '7745894403636165' },
                              { symbol: 'شپنا', inscode: '48000010188506899' },
                            ]
                        ).map((chip) => (
                          <button
                            key={chip.symbol}
                            type="button"
                            onClick={() => {
                              setInvSymbol(chip.symbol)
                              setInvInscode(chip.inscode)
                              void handleTseLookup(chip.symbol, chip.inscode)
                            }}
                            style={{
                              fontSize: 10,
                              padding: '2px 8px',
                              borderRadius: 8,
                              background:
                                invSymbol === chip.symbol ? 'var(--hy-accent)' : 'rgba(255, 255, 255, 0.08)',
                              color: invSymbol === chip.symbol ? '#fff' : 'var(--hy-text)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'pointer',
                              fontWeight: invSymbol === chip.symbol ? 800 : 500,
                            }}
                          >
                            {chip.symbol}
                          </button>
                        ))}
                      </div>

                      {/* TSE Live Info or Error */}
                      {tseInfo && (
                        <div
                          style={{
                            fontSize: 11,
                            color: tseDetails ? 'var(--hy-income)' : 'var(--hy-text-secondary)',
                            fontWeight: 600,
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: tseDetails ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: `1px solid ${tseDetails ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                          }}
                        >
                          {tseInfo}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text)' }}>
                        تعداد واحد و سهم <span style={{ color: '#ef4444' }}>*</span>:
                      </label>
                      <input
                        className="field-input"
                        inputMode="numeric"
                        placeholder="تعداد واحد یا سهم (مثلاً: ۱۰۰۰)"
                        value={invQuantity}
                        onChange={(e) => {
                          const qStr = e.target.value
                          setInvQuantity(qStr)
                          const q = Number(digitsOnly(qStr))
                          const u = Number(digitsOnly(invUnitPrice)) || Number(digitsOnly(invCurrentUnitPrice))
                          if (q > 0 && u > 0) {
                            const total = q * u
                            setInvCurrentValue(formatSeparatedNumber(total))
                            setInvBuyPrice(formatSeparatedNumber(total))
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text)' }}>
                        بهای خرید هر واحد ({unitLabel}) <span style={{ color: '#ef4444' }}>*</span>:
                      </label>
                      <input
                        className="field-input"
                        inputMode="numeric"
                        placeholder={`بهای خرید هر واحد (${unitLabel})`}
                        value={invUnitPrice}
                        onChange={(e) => {
                          const uStr = formatSeparatedNumber(e.target.value)
                          setInvUnitPrice(uStr)
                          const u = Number(digitsOnly(uStr))
                          if (!invCurrentUnitPrice) setInvCurrentUnitPrice(uStr)
                          const q = Number(digitsOnly(invQuantity))
                          if (q > 0 && u > 0) {
                            const total = q * u
                            setInvCurrentValue(formatSeparatedNumber(total))
                            setInvBuyPrice(formatSeparatedNumber(total))
                          }
                        }}
                      />
                      <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)', display: 'block', marginTop: 2 }}>
                        (اتوماتیک از نماد بورس یا وارد کردن دستی)
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>
                        بهای کل خرید ({unitLabel}): <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>(محاسبه خودکار)</span>
                      </label>
                      <input
                        className="field-input"
                        inputMode="numeric"
                        placeholder={`بهای کل خرید (${unitLabel})`}
                        value={invBuyPrice}
                        onChange={(e) => setInvBuyPrice(formatSeparatedNumber(e.target.value))}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>
                        ارزش روز کل ({unitLabel}): <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>(محاسبه خودکار)</span>
                      </label>
                      <input
                        className="field-input"
                        inputMode="numeric"
                        placeholder={`ارزش روز کل (${unitLabel})`}
                        value={invCurrentValue}
                        onChange={(e) => setInvCurrentValue(formatSeparatedNumber(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700 }}>یادداشت یا کارگزاری (اختیاری):</label>
                    <input
                      className="field-input"
                      placeholder="اختیاری (مثلاً: کارگزاری مفید، آگاه)"
                      value={invNote}
                      onChange={(e) => setInvNote(e.target.value)}
                    />
                  </div>

                  <button
                    className="cta-confirm"
                    type="button"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      const name = (invSymbol || invName).trim()
                      const q = Number(digitsOnly(invQuantity))
                      const unitPriceInput = Number(digitsOnly(invUnitPrice)) || Number(digitsOnly(invCurrentUnitPrice))

                      // فیلدهای اجباری بر اساس درخواست دقیق کاربر: نام نماد، تعداد واحد و سهم، بهای واحد
                      if (!name) {
                        notifyUser('وارد کردن نام یا نماد دارایی الزامی است')
                        return
                      }
                      if (!q || q <= 0) {
                        notifyUser('وارد کردن تعداد واحد و سهم الزامی است')
                        return
                      }
                      if (!unitPriceInput || unitPriceInput <= 0) {
                        notifyUser('وارد کردن بهای واحد (به‌صورت خودکار یا دستی) الزامی است')
                        return
                      }

                      // محاسبه مبالغ کل بر اساس تعداد × بهای واحد
                      const calculatedTotalInUserUnit = q * unitPriceInput
                      const calcRials = currencyUnit === 'IRT' ? calculatedTotalInUserUnit * 10 : calculatedTotalInUserUnit

                      const parsedCurrRials = invCurrentValue ? parseAmountToRials(invCurrentValue) : calcRials
                      const parsedBuyRials = invBuyPrice ? parseAmountToRials(invBuyPrice) : (parsedCurrRials || calcRials)

                      // پس از ثبت و افزودن نماد، بهای کل ارزش روز که محاسبه شد به عنوان مبلغ بهای کل خرید قرار گیرد
                      const purchaseAmount = editingInv ? parsedBuyRials : (parsedCurrRials || calcRials)
                      const currentValue = parsedCurrRials || purchaseAmount

                      const uPriceRials = currencyUnit === 'IRT' ? unitPriceInput * 10 : unitPriceInput
                      const currUPriceRials = invCurrentUnitPrice ? parseAmountToRials(invCurrentUnitPrice) : uPriceRials

                      void saveInvestment({
                        id: editingInv?.id || undefined,
                        name,
                        market: invMarket,
                        symbol: invSymbol.trim() || undefined,
                        inscode: invInscode.trim() || undefined,
                        purchaseAmount,
                        currentValue,
                        quantity: q,
                        unitPrice: uPriceRials,
                        currentUnitPrice: currUPriceRials,
                        note: invNote.trim() || undefined,
                      })

                      notifyUser(editingInv ? 'دارایی با موفقیت ویرایش شد' : 'دارایی با موفقیت به سبد سرمایه‌گذاری افزوده شد')
                      setIsCreateInvOpen(false)
                      setEditingInv(null)
                    }}
                  >
                    {editingInv ? 'ذخیره تغییرات دارایی' : 'افزودن دارایی به سبد'}
                  </button>
                </div>
              </div>
            </WindowPopup>
          )}

          {/* Modal: فهرست رسمی نمادهای بورس و فرابورس (TSETMC) */}
          {isTsePickerOpen && (
            <WindowPopup
              isOpen={isTsePickerOpen}
              title="فهرست رسمی نمادهای بورس تهران (TSETMC)"
              onClose={() => setIsTsePickerOpen(false)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '72vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--hy-text-secondary)', margin: 0 }}>
                    نماد مورد نظر را انتخاب کنید تا آخرین قیمت معامله مستقیماً در بخش ارزش روز هر واحد درج شود:
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isTseLoadingCatalog ? (
                      <span style={{ fontSize: 11, color: 'var(--hy-accent)', fontWeight: 600 }}>
                        ⏳ در حال فراخوانی کلیه نمادها...
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                        {toFaDigits(filteredTseInstruments.length)} نماد
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void loadAllTseInstruments()}
                      disabled={isTseLoadingCatalog}
                      style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--hy-text)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      title="فراخوانی مجدد فهرست نمادها از وب‌سرویس بورس"
                    >
                      {isTseLoadingCatalog ? '...' : '🔄 بازخوانی'}
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <input
                    className="field-input"
                    placeholder="🔍 جستجوی نماد، نام شرکت یا گروه (مثلاً: فولاد، خودرو، اهرم، عیار، طلا، شستا)..."
                    value={tseSearchQuery}
                    onChange={(e) => setTseSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {tseSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTseSearchQuery('')}
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--hy-text-secondary)',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Filters */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                  {[
                    { id: 'all', label: 'همه نمادها' },
                    { id: 'gold', label: '🪙 صندوق طلا' },
                    { id: 'leveraged', label: '⚡ اهرمی' },
                    { id: 'stock', label: '🏢 سهام بورس و فرابورس' },
                    { id: 'fund', label: '📈 صندوق‌های سهامی' },
                    { id: 'fixed_income', label: '💰 درآمد ثابت' },
                    { id: 'metals', label: '⛏️ فلزات و معادن' },
                    { id: 'oil', label: '🛢️ پتروپالایشی' },
                    { id: 'bank', label: '🏦 بانک و مالی' },
                    { id: 'auto', label: '🚗 خودرو و قطعات' },
                    { id: 'pharma', label: '💊 دارویی' },
                    { id: 'cement', label: '🏗️ سیمان و ساختمانی' },
                    { id: 'food', label: '🌾 غذایی و زراعت' },
                    { id: 'tech', label: '💻 فناوری و ارتباطات' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTseCategoryFilter(tab.id)}
                      className={`cat-mini${tseCategoryFilter === tab.id ? ' active' : ''}`}
                      style={{
                        whiteSpace: 'nowrap',
                        fontSize: 11,
                        padding: '5px 10px',
                        borderRadius: 14,
                        background: tseCategoryFilter === tab.id ? 'var(--hy-accent)' : 'rgba(255,255,255,0.06)',
                        color: tseCategoryFilter === tab.id ? '#fff' : 'var(--hy-text)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Instruments List */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    overflowY: 'auto',
                    maxHeight: '48vh',
                    paddingRight: 2,
                  }}
                >
                  {filteredTseInstruments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--hy-text-secondary)', fontSize: 13 }}>
                      نمادی با این مشخصات در فهرست پیدا نشد.
                    </div>
                  ) : (
                    filteredTseInstruments.map((item) => {
                      const isSelected = invSymbol === item.symbol || invInscode === item.inscode
                      const price = item.lastPrice || item.closingPrice || 0
                      const change = item.changePercent ?? 0
                      const isPositive = change > 0
                      const isZero = change === 0

                      return (
                        <div
                          key={item.inscode || item.symbol}
                          onClick={() => selectTseInstrument(item)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: 12,
                            background: isSelected
                              ? 'rgba(37, 99, 235, 0.2)'
                              : 'rgba(255, 255, 255, 0.04)',
                            border: isSelected
                              ? '1.5px solid var(--hy-accent)'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div
                              style={{
                                padding: '4px 10px',
                                borderRadius: 8,
                                background: 'rgba(37, 99, 235, 0.18)',
                                color: 'var(--hy-accent)',
                                fontWeight: 800,
                                fontSize: 13,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.symbol}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: 'var(--hy-text)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {item.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: 'var(--hy-text-secondary)',
                                  display: 'flex',
                                  gap: 6,
                                  marginTop: 2,
                                }}
                              >
                                <span>{item.category || item.categoryName || 'بورس تهران'}</span>
                                <span>·</span>
                                <span>کد: {item.inscode}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'left', flexShrink: 0, marginLeft: 6 }}>
                            {price > 0 && (
                              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--hy-text)' }}>
                                {formatMoney(price)}
                              </div>
                            )}
                            {change !== 0 && (
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: isPositive ? 'var(--hy-income)' : isZero ? 'var(--hy-text-secondary)' : 'var(--hy-expense)',
                                  direction: 'ltr',
                                }}
                              >
                                {isPositive ? '+' : ''}{toFaDigits(change)}%
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </WindowPopup>
          )}
        </div>
      )}

      {/* ────────────────── 4. DONG TAB ────────────────── */}
      {activeTab === 'dong' && (
        <div>
          {/* If NO event is selected: ONLY display list of events and "+ New Event" button */}
          {!selectedDongEvent ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                {/* Active vs Settled Events Filter */}
                <div className="seg" style={{ margin: 0, padding: 2 }}>
                  <button
                    className={`seg-btn${dongFilter === 'active' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setDongFilter('active')}
                    style={{ fontSize: 12, padding: '4px 14px' }}
                  >
                    👥 رویدادهای فعال ({toFaDigits(dongEvents.filter((d) => !d.settled).length)})
                  </button>
                  <button
                    className={`seg-btn${dongFilter === 'settled' ? ' active' : ''}`}
                    type="button"
                    onClick={() => setDongFilter('settled')}
                    style={{ fontSize: 12, padding: '4px 14px' }}
                  >
                    ✓ تسویه شده ({toFaDigits(dongEvents.filter((d) => d.settled).length)})
                  </button>
                </div>

                <button
                  className="cta-confirm"
                  type="button"
                  style={{ height: 36, fontSize: 12, padding: '0 14px' }}
                  onClick={() => {
                    setDongTitle('')
                    setDongMembers(['من'])
                    setDongMemberInput('')
                    setIsCreateDongOpen(true)
                  }}
                >
                  + رویداد جدید
                </button>
              </div>

              {/* Events List */}
              <section className="lg report-card">
                {dongEvents.filter((d) => (dongFilter === 'active' ? !d.settled : d.settled)).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 14px', color: 'var(--hy-text-secondary)' }}>
                    <span style={{ fontSize: 36 }}>👥</span>
                    <p style={{ marginTop: 8 }}>
                      {dongFilter === 'active'
                        ? 'هیچ رویداد فعالی وجود ندارد.'
                        : 'رویداد تسویه‌شده‌ای موجود نیست.'}
                    </p>
                    {dongFilter === 'active' ? (
                      <button
                        className="cat-mini"
                        type="button"
                        style={{ marginTop: 8 }}
                        onClick={() => setIsCreateDongOpen(true)}
                      >
                        + ایجاد اولین رویداد دونگ
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dongEvents
                      .filter((d) => (dongFilter === 'active' ? !d.settled : d.settled))
                      .map((evt) => {
                        const totalCost = evt.expenses.reduce((sum, e) => sum + e.amount, 0)
                        return (
                          <div
                            key={evt.id}
                            style={{
                              padding: '12px 16px',
                              borderRadius: 14,
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onClick={() => setSelectedDongId(evt.id)}
                          >
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--hy-text)' }}>
                                {evt.title}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                                <span>{toFaDigits(evt.participants.length)} نفر حاضر</span>
                                <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                                <span>کل مخارج: <b>{formatMoney(totalCost)}</b></span>
                                {evt.settled ? (
                                  <span style={{ color: 'var(--hy-income)', marginRight: 8, fontWeight: 700 }}>
                                    ✓ تسویه شده
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--hy-accent)', marginRight: 8 }}>
                                    در جریان
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                              <button
                                className="cat-mini"
                                type="button"
                                onClick={() => setSelectedDongId(evt.id)}
                              >
                                مشاهده و تسویه ←
                              </button>
                              <button
                                className="cat-mini"
                                type="button"
                                title={evt.settled ? 'بازگردانی به رویدادهای فعال' : 'اتمام و انتقال به تسویه شده'}
                                onClick={() => {
                                  void saveDongEvent({ ...evt, settled: !evt.settled })
                                  notifyUser(evt.settled ? 'رویداد به حالت فعال برگشت' : 'رویداد پایان یافت و تسویه شد')
                                }}
                              >
                                {evt.settled ? '↺ فعال کردن' : '✓ پایان و تسویه'}
                              </button>
                              <button
                                className="cat-mini danger"
                                type="button"
                                onClick={() => {
                                  if (confirm(`آیا از حذف رویداد «${evt.title}» اطمینان دارید؟`)) {
                                    void deleteDongEvent(evt.id)
                                    notifyUser('رویداد حذف شد')
                                  }
                                }}
                              >
                                حذف
                              </button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </section>

              {/* Modal for Creating New Dong Event */}
              {isCreateDongOpen && (
                <WindowPopup
                  title="ایجاد رویداد دونگ جدید"
                  subtitle="سفر، مهمانی، دورهمی یا خریدهای مشترک"
                  icon="👥"
                  isOpen={true}
                  onClose={() => setIsCreateDongOpen(false)}
                  defaultWidth={480}
                  defaultHeight={520}
                >
                  <div className="sheet-body-scroll" style={{ padding: '4px 0 16px' }}>
                    <div className="field-stack">
                      <label style={{ fontSize: 12, fontWeight: 700 }}>عنوان رویداد:</label>
                      <input
                        className="field-input"
                        placeholder="مثلاً: سفر شمال، کافه جمعه، شام تولد"
                        value={dongTitle}
                        onChange={(e) => setDongTitle(e.target.value)}
                      />

                      <label style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>
                        افراد حاضر در رویداد ({toFaDigits(dongMembers.length)} نفر):
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {dongMembers.map((m, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 12,
                              padding: '4px 10px',
                              borderRadius: 10,
                              background: 'rgba(37, 99, 235, 0.2)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {editingMemberIdx === idx ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  className="field-input"
                                  style={{ height: 24, fontSize: 11, padding: '2px 4px', width: 70 }}
                                  value={editingMemberName}
                                  autoFocus
                                  onChange={(e) => setEditingMemberName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editingMemberName.trim()) {
                                      e.preventDefault()
                                      const updated = [...dongMembers]
                                      updated[idx] = editingMemberName.trim()
                                      setDongMembers(updated)
                                      setEditingMemberIdx(null)
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--hy-income)' }}
                                  onClick={() => {
                                    if (editingMemberName.trim()) {
                                      const updated = [...dongMembers]
                                      updated[idx] = editingMemberName.trim()
                                      setDongMembers(updated)
                                    }
                                    setEditingMemberIdx(null)
                                  }}
                                >
                                  ✓
                                </button>
                              </div>
                            ) : (
                              <>
                                <span>👤 {m}</span>
                                <button
                                  type="button"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, opacity: 0.8 }}
                                  title="ویرایش نام"
                                  onClick={() => {
                                    setEditingMemberIdx(idx)
                                    setEditingMemberName(m)
                                  }}
                                >
                                  ✏️
                                </button>
                                {dongMembers.length > 1 ? (
                                  <button
                                    type="button"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, opacity: 0.7 }}
                                    title="حذف فرد"
                                    onClick={() => setDongMembers(dongMembers.filter((_, i) => i !== idx))}
                                  >
                                    ✕
                                  </button>
                                ) : null}
                              </>
                            )}
                          </span>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          className="field-input"
                          style={{ flex: 1, height: 34, fontSize: 12 }}
                          placeholder="نام نفر جدید…"
                          value={dongMemberInput}
                          onChange={(e) => setDongMemberInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && dongMemberInput.trim()) {
                              e.preventDefault()
                              if (!dongMembers.includes(dongMemberInput.trim())) {
                                setDongMembers([...dongMembers, dongMemberInput.trim()])
                              }
                              setDongMemberInput('')
                            }
                          }}
                        />
                        <button
                          className="cat-mini"
                          type="button"
                          onClick={() => {
                            if (dongMemberInput.trim() && !dongMembers.includes(dongMemberInput.trim())) {
                              setDongMembers([...dongMembers, dongMemberInput.trim()])
                              setDongMemberInput('')
                            }
                          }}
                        >
                          + افزودن فرد
                        </button>
                      </div>

                      <button
                        className="cta-confirm"
                        type="button"
                        style={{ marginTop: 14 }}
                        onClick={() => {
                          if (!dongTitle.trim() || dongMembers.length === 0) {
                            notifyUser('عنوان رویداد و حداقل یک عضو الزامی است')
                            return
                          }
                          const newEvent: Omit<DongEvent, 'id' | 'createdAt'> = {
                            title: dongTitle.trim(),
                            date: todayIso(),
                            participants: dongMembers.map((name, i) => ({ id: `p_${Date.now()}_${i + 1}`, name })),
                            expenses: [],
                            settled: false,
                          }
                          void saveDongEvent(newEvent).then((saved) => {
                            setSelectedDongId(saved.id)
                            setIsCreateDongOpen(false)
                            notifyUser('رویداد دونگ با موفقیت ساخته شد')
                          })
                        }}
                      >
                        ثبت و ایجاد رویداد دونگ
                      </button>
                    </div>
                  </div>
                </WindowPopup>
              )}
            </div>
          ) : (
            /* Dedicated Event Detail View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Event Header & Back Button */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--glass-chrome)',
                  padding: '12px 16px',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="cat-mini"
                    type="button"
                    onClick={() => setSelectedDongId(null)}
                    style={{ fontWeight: 700 }}
                  >
                    ← بازگشت به لیست رویدادها
                  </button>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedDongEvent.title}</h2>
                  {selectedDongEvent.settled ? (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', color: 'var(--hy-income)', fontWeight: 700 }}>
                      ✓ تسویه شده
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(37, 99, 235, 0.2)', color: 'var(--hy-accent)' }}>
                      در جریان
                    </span>
                  )}
                </div>

                <button
                  className="cat-mini"
                  type="button"
                  style={{
                    background: selectedDongEvent.settled ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255,255,255,0.1)',
                    color: selectedDongEvent.settled ? 'var(--hy-income)' : 'var(--hy-text)',
                  }}
                  onClick={() => {
                    void saveDongEvent({ ...selectedDongEvent, settled: !selectedDongEvent.settled })
                    notifyUser(selectedDongEvent.settled ? 'رویداد به حالت فعال بازگردانده شد' : 'رویداد تسویه اعلام شد')
                  }}
                >
                  {selectedDongEvent.settled ? '↺ بازگردانی به فعال' : '✓ پایان و علامت تسویه'}
                </button>
              </div>

              {/* Participants Section */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text-secondary)' }}>
                    👥 افراد حاضر ({toFaDigits(selectedDongEvent.participants.length)} نفر):
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {selectedDongEvent.participants.map((p) => (
                    <span
                      key={p.id}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 8,
                        background: 'rgba(37, 99, 235, 0.2)',
                        color: 'var(--hy-text)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {editingParticipantId === p.id ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <input
                            className="field-input"
                            style={{ height: 22, fontSize: 11, padding: '2px 4px', width: 80 }}
                            value={editingParticipantName}
                            autoFocus
                            onChange={(e) => setEditingParticipantName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editingParticipantName.trim()) {
                                e.preventDefault()
                                const updatedParticipants = selectedDongEvent.participants.map((item) =>
                                  item.id === p.id ? { ...item, name: editingParticipantName.trim() } : item
                                )
                                void saveDongEvent({ ...selectedDongEvent, participants: updatedParticipants })
                                setEditingParticipantId(null)
                                notifyUser('نام فرد ویرایش شد')
                              } else if (e.key === 'Escape') {
                                setEditingParticipantId(null)
                              }
                            }}
                          />
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--hy-income)' }}
                            onClick={() => {
                              if (editingParticipantName.trim()) {
                                const updatedParticipants = selectedDongEvent.participants.map((item) =>
                                  item.id === p.id ? { ...item, name: editingParticipantName.trim() } : item
                                )
                                void saveDongEvent({ ...selectedDongEvent, participants: updatedParticipants })
                                notifyUser('نام فرد ویرایش شد')
                              }
                              setEditingParticipantId(null)
                            }}
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <>
                          <span>👤 {p.name}</span>
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, opacity: 0.8 }}
                            title="ویرایش نام"
                            onClick={() => {
                              setEditingParticipantId(p.id)
                              setEditingParticipantName(p.name)
                            }}
                          >
                            ✏️
                          </button>
                          {selectedDongEvent.participants.length > 1 &&
                          !selectedDongEvent.expenses.some((e) => e.paidById === p.id || e.splitAmongIds.includes(p.id)) ? (
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, opacity: 0.7 }}
                              title="حذف فرد"
                              onClick={() => {
                                const updatedParticipants = selectedDongEvent.participants.filter((x) => x.id !== p.id)
                                void saveDongEvent({ ...selectedDongEvent, participants: updatedParticipants })
                                notifyUser('فرد از رویداد حذف شد')
                              }}
                            >
                              ✕
                            </button>
                          ) : null}
                        </>
                      )}
                    </span>
                  ))}
                </div>

                {/* Add new member to ongoing event */}
                <div style={{ display: 'flex', gap: 6, maxWidth: 280 }}>
                  <input
                    className="field-input"
                    style={{ height: 28, fontSize: 11, flex: 1 }}
                    placeholder="افزودن فرد جدید به این رویداد…"
                    value={eventNewMemberInput}
                    onChange={(e) => setEventNewMemberInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && eventNewMemberInput.trim()) {
                        e.preventDefault()
                        const newName = eventNewMemberInput.trim()
                        const newId = `p_${Date.now()}`
                        const updated = [...selectedDongEvent.participants, { id: newId, name: newName }]
                        void saveDongEvent({ ...selectedDongEvent, participants: updated })
                        setEventNewMemberInput('')
                        notifyUser(`${newName} اضافه شد`)
                      }
                    }}
                  />
                  <button
                    className="cat-mini"
                    type="button"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => {
                      if (eventNewMemberInput.trim()) {
                        const newName = eventNewMemberInput.trim()
                        const newId = `p_${Date.now()}`
                        const updated = [...selectedDongEvent.participants, { id: newId, name: newName }]
                        void saveDongEvent({ ...selectedDongEvent, participants: updated })
                        setEventNewMemberInput('')
                        notifyUser(`${newName} اضافه شد`)
                      }
                    }}
                  >
                    + افزودن
                  </button>
                </div>
              </div>

              {/* Add / Edit Expense Box */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>
                    {editingExpId ? '✏️ اصلاح هزینه ثبت‌شده' : '+ ثبت خرج جدید در این رویداد'}
                  </h3>
                  {editingExpId ? (
                    <button
                      className="cat-mini"
                      type="button"
                      onClick={() => {
                        setEditingExpId(null)
                        setNewExpTitle('')
                        setNewExpAmount('')
                        setNewExpSplits([])
                        setNewExpCustomAmounts({})
                        setManualEditedIds(new Set())
                        setNewExpSplitMode('equal')
                      }}
                    >
                      انصراف از ویرایش
                    </button>
                  ) : null}
                </div>

                <div className="field-stack">
                  <input
                    className="field-input"
                    placeholder="عنوان خرج (مثلاً: بنزین، ناهار رستوران، خرید گوشت)"
                    value={newExpTitle}
                    onChange={(e) => setNewExpTitle(e.target.value)}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      className="field-input"
                      inputMode="numeric"
                      placeholder={`مبلغ کل خرج (${unitLabel})`}
                      value={newExpAmount}
                      onChange={(e) => handleExpenseAmountChange(e.target.value)}
                    />
                    <select
                      className="field-input"
                      value={newExpPayer || selectedDongEvent.participants[0]?.id}
                      onChange={(e) => setNewExpPayer(e.target.value)}
                      aria-label="پرداخت‌کننده"
                    >
                      {selectedDongEvent.participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          پرداخت توسط: {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Participant Selection Checkboxes */}
                  <div
                    style={{
                      margin: '6px 0',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(0, 0, 0, 0.18)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text)' }}>
                        👥 این هزینه مربوط به چه کسانی است؟
                      </span>
                      <button
                        type="button"
                        className="cat-mini"
                        style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => {
                          const allIds = selectedDongEvent.participants.map((p) => p.id)
                          const current = newExpSplits.length > 0 ? newExpSplits : allIds
                          if (current.length === allIds.length) {
                            setNewExpSplits([])
                          } else {
                            setNewExpSplits(allIds)
                          }
                        }}
                      >
                        {newExpSplits.length === 0 || newExpSplits.length === selectedDongEvent.participants.length
                          ? 'لغو انتخاب همه'
                          : 'انتخاب همه'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedDongEvent.participants.map((p) => {
                        const effectiveSplits =
                          newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((x) => x.id)
                        const isChecked = effectiveSplits.includes(p.id)
                        return (
                          <label
                            key={p.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 10px',
                              borderRadius: 10,
                              background: isChecked ? 'rgba(15, 118, 110, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                              border: isChecked ? '1px solid var(--hy-teal)' : '1px solid rgba(255, 255, 255, 0.1)',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: isChecked ? 700 : 500,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const allIds = selectedDongEvent.participants.map((x) => x.id)
                                const current = newExpSplits.length > 0 ? [...newExpSplits] : allIds
                                let next: string[]
                                if (e.target.checked) {
                                  next = current.includes(p.id) ? current : [...current, p.id]
                                } else {
                                  next = current.filter((id) => id !== p.id)
                                }
                                setNewExpSplits(next)
                                if (newExpSplitMode === 'custom') {
                                  const totalUnits = Number(digitsOnly(newExpAmount)) || 0
                                  const updated = recalculateManualDistribution(totalUnits, next, manualEditedIds, newExpCustomAmounts)
                                  setNewExpCustomAmounts(updated)
                                }
                              }}
                            />
                            <span>{p.name}</span>
                          </label>
                        )
                      })}
                    </div>

                    {/* Split Mode Toggle: Equal vs Manual Split */}
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text-secondary)' }}>
                          نحوه تقسیم سهم افراد:
                        </span>
                        <div className="seg" style={{ margin: 0, padding: 2 }}>
                          <button
                            type="button"
                            className={`seg-btn${newExpSplitMode === 'equal' ? ' active' : ''}`}
                            onClick={() => setNewExpSplitMode('equal')}
                            style={{ fontSize: 11, padding: '3px 10px' }}
                          >
                            ⚖️ تقسیم مساوی
                          </button>
                          <button
                            type="button"
                            className={`seg-btn${newExpSplitMode === 'custom' ? ' active' : ''}`}
                            onClick={() => {
                              setNewExpSplitMode('custom')
                              const splits =
                                newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
                              const totalUnits = Number(digitsOnly(newExpAmount)) || 0
                              const updated = recalculateManualDistribution(totalUnits, splits, manualEditedIds, newExpCustomAmounts)
                              setNewExpCustomAmounts(updated)
                            }}
                            style={{ fontSize: 11, padding: '3px 10px' }}
                          >
                            تقسیم دستی
                          </button>
                        </div>
                      </div>

                      {newExpSplitMode === 'equal' ? (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--hy-teal)',
                            background: 'rgba(15, 118, 110, 0.1)',
                            padding: '6px 10px',
                            borderRadius: 8,
                          }}
                        >
                          {(() => {
                            const effectiveSplits =
                              newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
                            const totalRials = parseAmountToRials(newExpAmount)
                            if (effectiveSplits.length === 0) return 'هیچ فردی انتخاب نشده است.'
                            if (totalRials <= 0)
                              return `هزینه به صورت برابر بین ${toFaDigits(effectiveSplits.length)} نفر تقسیم می‌شود.`
                            const perShare = Math.round(totalRials / effectiveSplits.length)
                            return `سهم مساوی هر نفر: ${formatMoney(perShare)} (${toFaDigits(effectiveSplits.length)} نفر)`
                          })()}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--hy-text-secondary)', marginBottom: 2 }}>
                            <span>مبالغ دستی ثابت می‌مانند و باقیمانده به طور مساوی بین بقیه تقسیم می‌شود:</span>
                            <button
                              type="button"
                              className="cat-mini"
                              style={{ fontSize: 10, padding: '1px 8px' }}
                              onClick={resetCustomAmountsToEqual}
                              title="توزیع مجدد مبلغ کل به طور مساوی"
                            >
                              ↺ توزیع مساوی مجدد
                            </button>
                          </div>
                          {selectedDongEvent.participants.map((p) => {
                            const effectiveSplits =
                              newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((x) => x.id)
                            if (!effectiveSplits.includes(p.id)) return null
                            const isManuallySet = manualEditedIds.has(p.id)

                            return (
                              <div
                                key={p.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 10,
                                  padding: '5px 8px',
                                  borderRadius: 8,
                                  background: isManuallySet ? 'rgba(37, 99, 235, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                                  border: isManuallySet ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700 }}>{p.name}:</span>
                                  {isManuallySet ? (
                                    <span style={{ fontSize: 10, color: 'var(--hy-accent)' }}>(دستی)</span>
                                  ) : (
                                    <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>(توزیع خودکار)</span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 190 }}>
                                  <input
                                    className="field-input"
                                    inputMode="numeric"
                                    style={{ height: 32, fontSize: 12, textAlign: 'left', direction: 'rtl' }}
                                    placeholder="مبلغ"
                                    value={newExpCustomAmounts[p.id] ?? ''}
                                    onChange={(e) => handleUserCustomAmountChange(p.id, e.target.value)}
                                  />
                                  <span style={{ fontSize: 10, opacity: 0.7 }}>{unitLabel}</span>
                                </div>
                              </div>
                            )
                          })}

                          {/* Balance difference badge */}
                          {(() => {
                            const effectiveSplits =
                              newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)
                            const sumCustomRials = effectiveSplits.reduce((acc, id) => {
                              return acc + parseAmountToRials(newExpCustomAmounts[id] ?? '0')
                            }, 0)
                            const totalRials = parseAmountToRials(newExpAmount)
                            const diff = totalRials - sumCustomRials
                            return (
                              <div
                                style={{
                                  fontSize: 11,
                                  marginTop: 4,
                                  padding: '6px 10px',
                                  borderRadius: 8,
                                  background: Math.abs(diff) < 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: Math.abs(diff) < 100 ? 'var(--hy-income)' : 'var(--hy-expense)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontWeight: 700,
                                }}
                              >
                                <span>مجموع سهم‌ها: {formatMoney(sumCustomRials)}</span>
                                {diff !== 0 && totalRials > 0 ? (
                                  <span>
                                    {diff > 0 ? `باقی‌مانده: ${formatMoney(diff)}` : `اضافه بر کل: ${formatMoney(-diff)}`}
                                  </span>
                                ) : (
                                  <span>✓ تراز دقیق با کل هزینه (بدون کسری/مازاد)</span>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    className="cta-confirm"
                    type="button"
                    style={{ marginTop: 8 }}
                    onClick={() => {
                      const amount = parseAmountToRials(newExpAmount)
                      if (!newExpTitle.trim() || !amount) {
                        notifyUser('عنوان و مبلغ خرج الزامی است')
                        return
                      }
                      const payerId = newExpPayer || selectedDongEvent.participants[0]?.id
                      const targetSplits =
                        newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id)

                      if (targetSplits.length === 0) {
                        notifyUser('حداقل یک نفر را برای پرداخت دونگ انتخاب کنید')
                        return
                      }

                      let customShares: Record<string, number> | undefined
                      if (newExpSplitMode === 'custom') {
                        customShares = {}
                        let sumCustom = 0
                        for (const id of targetSplits) {
                          const val = parseAmountToRials(newExpCustomAmounts[id] ?? '0')
                          customShares[id] = val
                          sumCustom += val
                        }
                        if (sumCustom > 0 && sumCustom !== amount) {
                          const diff = amount - sumCustom
                          const firstId = targetSplits[0]
                          if (firstId) {
                            customShares[firstId] = Math.max(0, (customShares[firstId] || 0) + diff)
                          }
                        }
                      }

                      const updatedExpenses = [...selectedDongEvent.expenses]
                      if (editingExpId) {
                        // Edit existing expense
                        const idx = updatedExpenses.findIndex((e) => e.id === editingExpId)
                        if (idx >= 0) {
                          updatedExpenses[idx] = {
                            ...updatedExpenses[idx],
                            title: newExpTitle.trim(),
                            amount,
                            paidById: payerId,
                            splitAmongIds: targetSplits,
                            splitMode: newExpSplitMode,
                            customShares,
                          }
                        }
                        notifyUser('خرج ویرایش و اصلاح شد')
                      } else {
                        // Add new expense
                        const newItem: DongExpenseItem = {
                          id: createId('dexp'),
                          title: newExpTitle.trim(),
                          amount,
                          paidById: payerId,
                          splitAmongIds: targetSplits,
                          splitMode: newExpSplitMode,
                          customShares,
                          date: todayIso(),
                        }
                        updatedExpenses.push(newItem)
                        notifyUser('خرج ثبت شد و دونگ‌ها محاسبه شدند')
                      }

                      void saveDongEvent({
                        ...selectedDongEvent,
                        expenses: updatedExpenses,
                      })

                      setEditingExpId(null)
                      setNewExpTitle('')
                      setNewExpAmount('')
                      setNewExpSplits([])
                      setNewExpCustomAmounts({})
                      setManualEditedIds(new Set())
                      setNewExpSplitMode('equal')
                    }}
                  >
                    {editingExpId ? 'ذخیره اصلاح خرج' : 'افزودن خرج'}
                  </button>
                </div>
              </div>

              {/* Expense List with Edit & Delete */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>
                  ریز مخارج رویداد ({toFaDigits(selectedDongEvent.expenses.length)} مورد)
                </h3>
                {selectedDongEvent.expenses.length === 0 ? (
                  <p className="sheet-sub" style={{ margin: 0 }}>
                    هنوز خرجی در این رویداد ثبت نشده است.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedDongEvent.expenses.map((exp) => {
                      const payer = selectedDongEvent.participants.find((p) => p.id === exp.paidById)
                      return (
                        <div
                          key={exp.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(0,0,0,0.18)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 800, fontSize: 14 }}>{exp.title}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  background: exp.splitMode === 'custom' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 118, 110, 0.15)',
                                  color: exp.splitMode === 'custom' ? '#38bdf8' : 'var(--hy-teal)',
                                  fontWeight: 700,
                                }}
                              >
                                {exp.splitMode === 'custom' ? 'تقسیم دستی' : 'تقسیم مساوی'}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                              <span>پرداخت توسط: <b>{payer?.name || 'نامشخص'}</b></span>
                              <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                              <span>
                                سهم ({toFaDigits(exp.splitAmongIds.length)} نفر):{' '}
                                {exp.splitAmongIds
                                  .map((id) => {
                                    const part = selectedDongEvent.participants.find((p) => p.id === id)
                                    if (exp.splitMode === 'custom' && exp.customShares && exp.customShares[id] !== undefined) {
                                      return `${part?.name ?? id} (${formatMoney(exp.customShares[id]!)})`
                                    }
                                    return part?.name ?? id
                                  })
                                  .join('، ')}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-text)' }}>
                              {formatMoney(exp.amount)}
                            </span>
                            <button
                              className="cat-mini"
                              type="button"
                              onClick={() => {
                                // Load expense for editing
                                setEditingExpId(exp.id)
                                setNewExpTitle(exp.title)
                                const unitMultiplier = currencyUnit === 'IRT' ? 10 : 1
                                setNewExpAmount(formatSeparatedNumber(Math.round(exp.amount / unitMultiplier)))
                                setNewExpPayer(exp.paidById)
                                setNewExpSplits(exp.splitAmongIds)
                                setNewExpSplitMode(exp.splitMode || 'equal')
                                if (exp.customShares) {
                                  const formattedMap: Record<string, string> = {}
                                  for (const [uid, amt] of Object.entries(exp.customShares)) {
                                    formattedMap[uid] = formatSeparatedNumber(Math.round(amt / unitMultiplier))
                                  }
                                  setNewExpCustomAmounts(formattedMap)
                                  setManualEditedIds(new Set())
                                } else {
                                  setNewExpCustomAmounts({})
                                  setManualEditedIds(new Set())
                                }
                                notifyUser(`در حال ویرایش: ${exp.title}`)
                              }}
                            >
                              ویرایش
                            </button>
                            <button
                              className="cat-mini danger"
                              type="button"
                              onClick={() => {
                                if (confirm(`آیا از حذف خرج «${exp.title}» اطمینان دارید؟`)) {
                                  const updated = {
                                    ...selectedDongEvent,
                                    expenses: selectedDongEvent.expenses.filter((e) => e.id !== exp.id),
                                  }
                                  void saveDongEvent(updated)
                                  notifyUser('خرج حذف شد')
                                }
                              }}
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Participant Balances & Transparency Overview */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📊</span>
                    <span>تراز و سهم اعضا در این رویداد</span>
                  </h3>
                  <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                    مجموع مخارج کل: <b>{formatMoney(dongSummary.totalCost)}</b>
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                  {dongSummary.balances.map((b) => {
                    const isCreditor = b.net > 5
                    const isDebtor = b.net < -5
                    return (
                      <div
                        key={b.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          background: isCreditor
                            ? 'rgba(16, 185, 129, 0.1)'
                            : isDebtor
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(255, 255, 255, 0.04)',
                          border: isCreditor
                            ? '1px solid rgba(16, 185, 129, 0.25)'
                            : isDebtor
                            ? '1px solid rgba(239, 68, 68, 0.25)'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, fontSize: 13 }}>{b.name}</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 6,
                              background: isCreditor
                                ? 'rgba(16, 185, 129, 0.2)'
                                : isDebtor
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(255, 255, 255, 0.1)',
                              color: isCreditor ? 'var(--hy-income)' : isDebtor ? 'var(--hy-expense)' : 'var(--hy-text-secondary)',
                            }}
                          >
                            {isCreditor ? 'طلبکار' : isDebtor ? 'بدهکار' : 'بی‌حساب'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>پرداخت کرده:</span>
                          <b>{formatMoney(b.paid)}</b>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                          <span>سهم مصرفی:</span>
                          <b>{formatMoney(b.share)}</b>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 4,
                            paddingTop: 4,
                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                            color: isCreditor ? 'var(--hy-income)' : isDebtor ? 'var(--hy-expense)' : 'var(--hy-text-secondary)',
                          }}
                        >
                          <span>تراز نهایی:</span>
                          <span>
                            {isCreditor ? '+' : ''}
                            {formatMoney(b.net)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Settlement Calculator Box: Who pays whom? */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(15, 118, 110, 0.2) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚖️</span>
                    <span>فرمول تسویه حساب نهایی (چه کسی به چه کسی بدهد؟)</span>
                  </h3>
                  {activeDongTransfers.length > 0 && activeDongTransfers.every((t) => t.settled) ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-income)', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: 8 }}>
                      🎉 تمام پرداخت‌ها انجام شد
                    </span>
                  ) : null}
                </div>

                {activeDongTransfers.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--hy-income)', margin: '8px 0 0' }}>
                    🎉 تمام حساب‌ها کاملاً برابر است و کسی به دیگری بدهکار نیست!
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {activeDongTransfers.map((tr) => (
                      <div
                        key={tr.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: tr.settled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                          border: tr.settled ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                          opacity: tr.settled ? 0.85 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <span style={{ fontWeight: 800, color: tr.settled ? 'var(--hy-text-secondary)' : 'var(--hy-expense)', textDecoration: tr.settled ? 'line-through' : 'none' }}>
                            {tr.fromName}
                          </span>
                          <span style={{ opacity: 0.6 }}>باید بپردازد به</span>
                          <span style={{ fontWeight: 800, color: tr.settled ? 'var(--hy-text-secondary)' : 'var(--hy-income)', textDecoration: tr.settled ? 'line-through' : 'none' }}>
                            {tr.toName}
                          </span>
                          <span style={{ fontWeight: 800, color: tr.settled ? 'var(--hy-income)' : 'var(--hy-accent)', marginRight: 6 }}>
                            {formatMoney(tr.amount)}
                          </span>
                          {tr.settled ? (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--hy-income)', background: 'rgba(16, 185, 129, 0.2)', padding: '1px 6px', borderRadius: 6 }}>
                              (پرداخت شده)
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--hy-expense)', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 6px', borderRadius: 6 }}>
                              (در انتظار پرداخت)
                            </span>
                          )}
                        </div>

                        {/* Toggle Payment Status Button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="cat-mini"
                            style={{
                              background: tr.settled ? 'rgba(16, 185, 129, 0.25)' : 'var(--hy-accent)',
                              color: tr.settled ? 'var(--hy-income)' : '#fff',
                              fontWeight: 700,
                              fontSize: 11,
                              padding: '5px 12px',
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              const nextSettled = new Set(selectedDongEvent.settledTransfers || [])
                              if (nextSettled.has(tr.id)) {
                                nextSettled.delete(tr.id)
                                notifyUser(`وضعیت پرداخت ${tr.fromName} به حالت تسویه نشده بازگشت`)
                              } else {
                                nextSettled.add(tr.id)
                                notifyUser(`تسویه پرداخت ${tr.fromName} به ${tr.toName} ثبت شد`)
                              }
                              void saveDongEvent({
                                ...selectedDongEvent,
                                settledTransfers: Array.from(nextSettled),
                              })
                            }}
                          >
                            {tr.settled ? '✓ تسویه شده (لغو)' : '🔘 ثبت تسویه'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
