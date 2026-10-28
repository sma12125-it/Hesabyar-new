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
import { TSE_INSTRUMENTS, normalizePersian } from '../lib/tseCatalog'
import { formatPersianDateFull } from '../lib/dates'




import type {
  CardMarket,
  InvestmentMarket,
  InvestmentAsset,
  InvestmentTransaction,
  InvestmentTransactionType,
} from '../types'

export function recomputeAssetFromTransactions(
  asset: InvestmentAsset,
  txs: InvestmentTransaction[],
  currentUnitPrice?: number
): InvestmentAsset {
  const sorted = [...txs].sort((a, b) => {
    const da = a.date || ''
    const db = b.date || ''
    if (da !== db) return da.localeCompare(db)
    return (a.createdAt || 0) - (b.createdAt || 0)
  })

  let qty = 0
  let totalCost = 0
  let totalRealized = 0

  const processedTxs: InvestmentTransaction[] = []

  for (const t of sorted) {
    if (t.type === 'buy') {
      qty += t.quantity
      totalCost += t.quantity * t.unitPrice
      processedTxs.push({
        ...t,
        realizedProfit: undefined,
        avgCostAtSale: undefined,
      })
    } else {
      const avgCostAtSale = qty > 0 ? totalCost / qty : t.unitPrice
      const profit = t.quantity * (t.unitPrice - avgCostAtSale)
      totalRealized += profit
      qty = Math.max(0, qty - t.quantity)
      totalCost = qty * avgCostAtSale
      processedTxs.push({
        ...t,
        avgCostAtSale: Math.round(avgCostAtSale),
        realizedProfit: Math.round(profit),
      })
    }
  }

  const finalAvgUnitPrice = qty > 0 ? Math.round(totalCost / qty) : (asset.unitPrice || 0)
  const effectiveCurrentUnitPrice = currentUnitPrice ?? asset.currentUnitPrice ?? finalAvgUnitPrice
  const currentValue = Math.round(qty * effectiveCurrentUnitPrice)

  return {
    ...asset,
    transactions: processedTxs,
    quantity: qty,
    unitPrice: finalAvgUnitPrice,
    currentUnitPrice: effectiveCurrentUnitPrice,
    purchaseAmount: Math.round(totalCost),
    currentValue,
    realizedProfit: Math.round(totalRealized),
    updatedAt: Date.now(),
  }
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

type ActiveTab = 'budget' | 'goals'

export function ReportsPage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const { transactions, customCategories, createCategory, renameCategory } = useStore()
  const {
    budgets,
    goals,
    investments,
    saveBudget,
    deleteBudget,
    saveGoal,
    deleteGoal,
    saveInvestment,
    deleteInvestment,
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
  const totalInvestmentValue = useMemo(() => investments.reduce((sum, i) => sum + i.currentValue, 0), [investments])

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

  // Dedicated Asset Detail View & Transactions State
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const selectedAsset = useMemo(
    () => (selectedAssetId ? investments.find((i) => i.id === selectedAssetId) || null : null),
    [investments, selectedAssetId]
  )
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [txType, setTxType] = useState<InvestmentTransactionType>('buy')
  const [txDate, setTxDate] = useState(() => todayIso())
  const [txQuantity, setTxQuantity] = useState('')
  const [txUnitPrice, setTxUnitPrice] = useState('')
  const [txNote, setTxNote] = useState('')

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
    if (activeTab === 'budget') {
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
        if (tseCategoryFilter === 'mofid') {
          return (
            cat.includes('مفید') ||
            (item.name || '').includes('مفید') ||
            ['عیار', 'توان', 'پیشتاز', 'پیشرو', 'امید توسعه', 'حامی', 'نامی', 'آوند', 'اونیکس', 'تضمین', 'آرامش', 'مفید'].includes(item.symbol)
          )
        }
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

    // درج فوری و خودکار آخرین ارزش/قیمت معامله در فیلد «ارزش روز هر واحد» و «بهای خرید هر واحد»
    const pricePerUnit = item.lastPrice || item.closingPrice || 0
    if (pricePerUnit > 0) {
      const displayPrice = currencyUnit === 'IRT' ? Math.round(pricePerUnit / 10) : pricePerUnit
      setInvCurrentUnitPrice(formatSeparatedNumber(displayPrice))
      if (!invUnitPrice) {
        setInvUnitPrice(formatSeparatedNumber(displayPrice))
      }

      // محاسبه خودکار ارزش روز کل و بهای کل بر اساس تعداد واحد
      const q = Number(digitsOnly(invQuantity))
      if (q > 0) {
        const buyPrice = Number(digitsOnly(invUnitPrice)) || displayPrice
        setInvBuyPrice(formatSeparatedNumber(q * buyPrice))
        setInvCurrentValue(formatSeparatedNumber(q * displayPrice))
      }

      setTseDetails({
        lastPrice: item.lastPrice || pricePerUnit,
        closingPrice: item.closingPrice || pricePerUnit,
        changePercent: item.changePercent || 0,
        source: 'tsetmc',
      })
      const sign = (item.changePercent || 0) > 0 ? '+' : ''
      setTseInfo(
        `✓ نماد «${item.symbol}» با موفقیت انتخاب شد. آخرین ارزش روز هر واحد: ${formatMoney(displayPrice)} (${sign}${toFaDigits(item.changePercent || 0)}٪).`
      )
      notifyUser(`ارزش روز هر واحد نماد «${item.symbol}» درج شد`)
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
    const tseAssets = investments.filter(
      (i) => i.symbol || i.inscode || i.market === 'stock' || i.market === 'fund' || i.market === 'gold'
    )
    if (tseAssets.length === 0) {
      if (!silent) notifyUser('دارایی بورسی یا صندوق در سبد سرمایه‌گذاری برای به‌روزرسانی یافت نشد.')
      return
    }
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
          const sym = asset.symbol || ''
          const code = asset.inscode || ''
          const nm = asset.name || ''
          const quote =
            quotes[sym] ||
            quotes[code] ||
            quotes[nm] ||
            quotes[normalizePersian(sym)] ||
            quotes[normalizePersian(nm)]

          if (quote && typeof quote.price === 'number' && quote.price > 0) {
            const newUnitPrice = quote.lastPrice || quote.price
            const q = asset.quantity || 1
            const newTotalValue = Math.round(q * newUnitPrice)
            // بروزرسانی ارزش روز هر واحد و ارزش روز کل، با حفظ بهای خرید اولیه
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
      if (!silent) {
        notifyUser(
          updatedCount > 0
            ? `${toFaDigits(updatedCount)} دارایی با آخرین قیمت‌های بورس و صندوق‌ها بروزرسانی شدند.`
            : 'قیمت دارایی‌های بورس به روز است.'
        )
      }
    } catch {
      if (!silent) notifyUser('خطا در به‌روزرسانی قیمت‌های بورس')
    } finally {
      setIsRefreshingTse(false)
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
            بودجه‌بندی هوشمند دسته‌بندی‌ها و اهداف پس‌انداز مالی
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
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
        </div>
      </div>

      {/* Tab Segment Switcher */}
      <div
        className="seg"
        role="tablist"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
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
          📊 بودجه‌بندی ماهانه
        </button>
        <button
          className={`seg-btn${activeTab === 'goals' ? ' active' : ''}`}
          type="button"
          onClick={() => setActiveTab('goals')}
          style={{ fontSize: 13, fontWeight: 700, padding: '8px 4px' }}
        >
          🎯 اهداف پس‌انداز
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

      {/* ────────────────── 3. INVESTMENTS TAB (Temporarily hidden per Item 5) ────────────────── */}
      {(activeTab as string) === 'investments' && (
        <div>
          {selectedAsset ? (
            /* DEDICATED ASSET DETAIL VIEW (صفحه اختصاصی دارایی) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Back breadcrumb and top actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  className="cat-mini"
                  onClick={() => setSelectedAssetId(null)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px', background: 'rgba(255,255,255,0.08)' }}
                >
                  <span>←</span>
                  <span>بازگشت به سبد سرمایه‌گذاری</span>
                </button>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="cta-confirm"
                    style={{ background: 'var(--hy-income)', color: '#fff', fontSize: 12, height: 34, padding: '0 12px' }}
                    onClick={() => {
                      setTxType('buy')
                      setTxDate(todayIso())
                      setTxQuantity('')
                      const defaultPrice = selectedAsset.currentUnitPrice || selectedAsset.unitPrice || 0
                      const displayPrice = currencyUnit === 'IRT' ? Math.round(defaultPrice / 10) : defaultPrice
                      setTxUnitPrice(displayPrice > 0 ? formatSeparatedNumber(displayPrice) : '')
                      setTxNote('')
                      setIsTxModalOpen(true)
                    }}
                  >
                    ＋ ثبت خرید / صدور
                  </button>
                  <button
                    type="button"
                    className="cat-mini"
                    style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)', fontSize: 12, height: 34, padding: '0 12px', fontWeight: 700 }}
                    onClick={() => {
                      setTxType('sell')
                      setTxDate(todayIso())
                      setTxQuantity('')
                      const defaultPrice = selectedAsset.currentUnitPrice || selectedAsset.unitPrice || 0
                      const displayPrice = currencyUnit === 'IRT' ? Math.round(defaultPrice / 10) : defaultPrice
                      setTxUnitPrice(displayPrice > 0 ? formatSeparatedNumber(displayPrice) : '')
                      setTxNote('')
                      setIsTxModalOpen(true)
                    }}
                  >
                    − ثبت فروش / ابطال
                  </button>
                  <button
                    type="button"
                    className="cat-mini"
                    disabled={isRefreshingTse}
                    title="استعلام آخرین قیمت روز بازار"
                    onClick={async () => {
                      if (selectedAsset.symbol || selectedAsset.inscode) {
                        setIsRefreshingTse(true)
                        try {
                          const quote = await fetchTseQuote(selectedAsset.symbol || '', selectedAsset.inscode)
                          if (quote && quote.price > 0) {
                            const newPrice = quote.lastPrice || quote.price
                            const updated = recomputeAssetFromTransactions(
                              selectedAsset,
                              selectedAsset.transactions || [],
                              newPrice
                            )
                            await saveInvestment(updated)
                            notifyUser(`ارزش روز هر واحد نماد «${selectedAsset.name}» به ${formatMoney(newPrice)} به‌روز شد`)
                          } else {
                            notifyUser('قیمت روز از بورس دریافت نشد')
                          }
                        } finally {
                          setIsRefreshingTse(false)
                        }
                      } else {
                        const curDisplay = selectedAsset.currentUnitPrice
                          ? (currencyUnit === 'IRT' ? Math.round(selectedAsset.currentUnitPrice / 10) : selectedAsset.currentUnitPrice)
                          : 0
                        const input = prompt(`ارزش روز هر واحد دارایی (${unitLabel}) را وارد کنید:`, String(curDisplay))
                        if (input && Number(digitsOnly(input)) > 0) {
                          const p = Number(digitsOnly(input))
                          const rials = currencyUnit === 'IRT' ? p * 10 : p
                          const updated = recomputeAssetFromTransactions(
                            selectedAsset,
                            selectedAsset.transactions || [],
                            rials
                          )
                          await saveInvestment(updated)
                          notifyUser('ارزش روز دارایی به‌روزرسانی شد')
                        }
                      }
                    }}
                    style={{ fontSize: 11, background: 'rgba(37, 99, 235, 0.15)', color: 'var(--hy-accent)' }}
                  >
                    {isRefreshingTse ? 'در حال دریافت...' : '🔄 به‌روزرسانی قیمت'}
                  </button>
                  <button
                    type="button"
                    className="cat-mini"
                    onClick={() => {
                      setEditingInv(selectedAsset)
                      setInvName(selectedAsset.name)
                      setInvSymbol(selectedAsset.symbol || '')
                      setInvInscode(selectedAsset.inscode || '')
                      setInvMarket(selectedAsset.market)
                      setInvQuantity(selectedAsset.quantity ? String(selectedAsset.quantity) : '')
                      setInvUnitPrice(
                        selectedAsset.unitPrice
                          ? String(currencyUnit === 'IRT' ? Math.round(selectedAsset.unitPrice / 10) : selectedAsset.unitPrice)
                          : ''
                      )
                      setInvCurrentUnitPrice(
                        selectedAsset.currentUnitPrice
                          ? String(
                              currencyUnit === 'IRT'
                                ? Math.round(selectedAsset.currentUnitPrice / 10)
                                : selectedAsset.currentUnitPrice
                            )
                          : ''
                      )
                      setInvBuyPrice(
                        currencyUnit === 'IRT'
                          ? String(Math.floor(selectedAsset.purchaseAmount / 10))
                          : String(selectedAsset.purchaseAmount)
                      )
                      setInvCurrentValue(
                        currencyUnit === 'IRT'
                          ? String(Math.floor(selectedAsset.currentValue / 10))
                          : String(selectedAsset.currentValue)
                      )
                      setInvNote(selectedAsset.note || '')
                      setTseInfo(null)
                      setIsCreateInvOpen(true)
                    }}
                  >
                    ویرایش
                  </button>
                  <button
                    type="button"
                    className="cat-mini danger"
                    onClick={() => {
                      if (confirm(`آیا از حذف دارایی «${selectedAsset.name}» و کلیه سوابق معاملات آن اطمینان دارید؟`)) {
                        void deleteInvestment(selectedAsset.id)
                        setSelectedAssetId(null)
                        notifyUser('دارایی از سبد حذف شد')
                      }
                    }}
                  >
                    حذف
                  </button>
                </div>
              </div>

              {/* Asset Title & Market Meta Banner */}
              <div
                className="report-card lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(15, 118, 110, 0.1) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 18,
                  padding: '16px 20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 28 }}>
                      {DEFAULT_INVESTMENT_MARKETS.find((m) => m.id === selectedAsset.market)?.icon || '📈'}
                    </span>
                    <div>
                      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{selectedAsset.name}</h1>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                        {selectedAsset.symbol && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(37, 99, 235, 0.25)', color: 'var(--hy-accent)' }}>
                            نماد: {selectedAsset.symbol}
                          </span>
                        )}
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255, 255, 255, 0.08)', color: 'var(--hy-text-secondary)' }}>
                          {DEFAULT_INVESTMENT_MARKETS.find((m) => m.id === selectedAsset.market)?.label}
                        </span>
                        {selectedAsset.note && (
                          <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                            · {selectedAsset.note}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total Profit badge */}
                  {(() => {
                    const remainingProfit = selectedAsset.currentValue - selectedAsset.purchaseAmount
                    const realizedProfit = selectedAsset.realizedProfit || 0
                    const totalProfit = realizedProfit + remainingProfit
                    const isGain = totalProfit > 0
                    const isLoss = totalProfit < 0
                    const totalCostBasis = selectedAsset.purchaseAmount > 0 ? selectedAsset.purchaseAmount : 1
                    const totalRoi = ((totalProfit / totalCostBasis) * 100).toFixed(1)

                    return (
                      <div
                        style={{
                          textAlign: 'left',
                          background: isGain ? 'rgba(16, 185, 129, 0.15)' : isLoss ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)',
                          padding: '8px 14px',
                          borderRadius: 12,
                          border: `1px solid ${isGain ? 'rgba(16, 185, 129, 0.3)' : isLoss ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                        }}
                      >
                        <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>مجموع کل سود / زیان دارایی</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: isGain ? '#10b981' : isLoss ? '#ef4444' : 'var(--hy-text)', marginTop: 2 }}>
                          {isGain ? '+' : ''}{formatMoney(totalProfit)}
                          <span style={{ fontSize: 12, fontWeight: 800, marginRight: 6, direction: 'ltr' }}>
                            ({isGain ? '+' : isLoss ? '-' : ''}{toFaDigits(Math.abs(Number(totalRoi)))}٪)
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {/* 1. مقدار باقی‌مانده */}
                <div className="report-card sm" style={{ padding: '12px 14px', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>مقدار باقیمانده</div>
                  <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4, color: 'var(--hy-text)' }}>
                    {toFaDigits(selectedAsset.quantity || 0)}{' '}
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--hy-text-secondary)' }}>سهم / واحد</span>
                  </div>
                </div>

                {/* 2. میانگین بهای خرید هر واحد */}
                <div className="report-card sm" style={{ padding: '12px 14px', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>میانگین بهای خرید هر واحد</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: 'var(--hy-text)' }}>
                    {formatMoney(selectedAsset.unitPrice || 0)}
                  </div>
                </div>

                {/* 3. ارزش روز هر واحد */}
                <div className="report-card sm" style={{ padding: '12px 14px', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>ارزش روز هر واحد (قیمت لحظه‌ای)</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: 'var(--hy-accent)' }}>
                    {formatMoney(selectedAsset.currentUnitPrice || selectedAsset.unitPrice || 0)}
                  </div>
                </div>

                {/* 4. بهای تمام‌شده باقیمانده */}
                <div className="report-card sm" style={{ padding: '12px 14px', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>بهای تمام‌شده باقیمانده</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: 'var(--hy-text)' }}>
                    {formatMoney(selectedAsset.purchaseAmount)}
                  </div>
                </div>

                {/* 5. ارزش روز باقیمانده */}
                <div className="report-card sm" style={{ padding: '12px 14px', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>ارزش روز مقدار باقیمانده</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: 'var(--hy-accent)' }}>
                    {formatMoney(selectedAsset.currentValue)}
                  </div>
                </div>

                {/* 6. سود حاصل از فروش (Realized Profit) */}
                {(() => {
                  const rp = selectedAsset.realizedProfit || 0
                  const isGain = rp > 0
                  const isLoss = rp < 0
                  return (
                    <div
                      className="report-card sm"
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: isGain ? 'rgba(16, 185, 129, 0.08)' : isLoss ? 'rgba(239, 68, 68, 0.08)' : undefined,
                        border: isGain ? '1px solid rgba(16, 185, 129, 0.25)' : isLoss ? '1px solid rgba(239, 68, 68, 0.25)' : undefined,
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>سود حاصل از فروش</span>
                        <span style={{ fontSize: 10, color: isGain ? 'var(--hy-income)' : 'var(--hy-text-secondary)' }}>(قطعی)</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: isGain ? '#10b981' : isLoss ? '#ef4444' : 'var(--hy-text)' }}>
                        {isGain ? '+' : ''}{formatMoney(rp)}
                      </div>
                    </div>
                  )
                })()}

                {/* 7. سود حاصل از مقدار باقیمانده (Unrealized Profit) */}
                {(() => {
                  const up = selectedAsset.currentValue - selectedAsset.purchaseAmount
                  const isGain = up > 0
                  const isLoss = up < 0
                  const roi = selectedAsset.purchaseAmount > 0 ? ((up / selectedAsset.purchaseAmount) * 100).toFixed(1) : '0'
                  return (
                    <div
                      className="report-card sm"
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: isGain ? 'rgba(16, 185, 129, 0.08)' : isLoss ? 'rgba(239, 68, 68, 0.08)' : undefined,
                        border: isGain ? '1px solid rgba(16, 185, 129, 0.25)' : isLoss ? '1px solid rgba(239, 68, 68, 0.25)' : undefined,
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>سود مقدار باقیمانده</span>
                        <span style={{ fontSize: 10, color: isGain ? 'var(--hy-income)' : isLoss ? '#ef4444' : 'var(--hy-text-secondary)', direction: 'ltr' }}>
                          ({isGain ? '+' : isLoss ? '-' : ''}{toFaDigits(Math.abs(Number(roi)))}٪)
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4, color: isGain ? '#10b981' : isLoss ? '#ef4444' : 'var(--hy-text)' }}>
                        {isGain ? '+' : ''}{formatMoney(up)}
                      </div>
                    </div>
                  )
                })()}

                {/* 8. مجموع کل سود دارایی */}
                {(() => {
                  const totalP = (selectedAsset.realizedProfit || 0) + (selectedAsset.currentValue - selectedAsset.purchaseAmount)
                  const isGain = totalP > 0
                  const isLoss = totalP < 0
                  return (
                    <div
                      className="report-card sm"
                      style={{
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: isGain ? 'rgba(16, 185, 129, 0.14)' : isLoss ? 'rgba(239, 68, 68, 0.14)' : undefined,
                        border: isGain ? '1.5px solid rgba(16, 185, 129, 0.4)' : isLoss ? '1.5px solid rgba(239, 68, 68, 0.4)' : undefined,
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>کل سود (فروش + باقیمانده)</div>
                      <div style={{ fontSize: 15, fontWeight: 900, marginTop: 4, color: isGain ? '#10b981' : isLoss ? '#ef4444' : 'var(--hy-text)' }}>
                        {isGain ? '+' : ''}{formatMoney(totalP)}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Explanatory Summary Note */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: 12,
                  lineHeight: '1.9',
                  color: 'var(--hy-text)',
                }}
              >
                📊 <strong>خلاصه وضعیت دارایی:</strong> مقدار باقیمانده شما{' '}
                <strong>{toFaDigits(selectedAsset.quantity || 0)} واحد</strong> با بهای میانگین تمام‌شده{' '}
                <strong>{formatMoney(selectedAsset.unitPrice || 0)}</strong> است. تاکنون مبلغ{' '}
                <strong style={{ color: (selectedAsset.realizedProfit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatMoney(selectedAsset.realizedProfit || 0)}
                </strong>{' '}
                سود قطعی از فروش‌های گذشته محقق شده و واحدهای موجود در سبد نیز دارای{' '}
                <strong style={{ color: (selectedAsset.currentValue - selectedAsset.purchaseAmount) >= 0 ? '#10b981' : '#ef4444' }}>
                  {formatMoney(selectedAsset.currentValue - selectedAsset.purchaseAmount)}
                </strong>{' '}
                سود لحظه‌ای می‌باشند.
              </div>

              {/* Transaction History Section */}
              <section className="lg report-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                    📜 سابقه معاملات و تراکنش‌ها ({toFaDigits(selectedAsset.transactions?.length || 0)})
                  </h2>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="cat-mini"
                      style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--hy-income)', fontWeight: 700 }}
                      onClick={() => {
                        setTxType('buy')
                        setTxDate(todayIso())
                        setTxQuantity('')
                        const defaultPrice = selectedAsset.currentUnitPrice || selectedAsset.unitPrice || 0
                        const displayPrice = currencyUnit === 'IRT' ? Math.round(defaultPrice / 10) : defaultPrice
                        setTxUnitPrice(displayPrice > 0 ? formatSeparatedNumber(displayPrice) : '')
                        setTxNote('')
                        setIsTxModalOpen(true)
                      }}
                    >
                      ＋ ثبت خرید / صدور
                    </button>
                    <button
                      type="button"
                      className="cat-mini"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}
                      onClick={() => {
                        setTxType('sell')
                        setTxDate(todayIso())
                        setTxQuantity('')
                        const defaultPrice = selectedAsset.currentUnitPrice || selectedAsset.unitPrice || 0
                        const displayPrice = currencyUnit === 'IRT' ? Math.round(defaultPrice / 10) : defaultPrice
                        setTxUnitPrice(displayPrice > 0 ? formatSeparatedNumber(displayPrice) : '')
                        setTxNote('')
                        setIsTxModalOpen(true)
                      }}
                    >
                      − ثبت فروش / ابطال
                    </button>
                  </div>
                </div>

                {(!selectedAsset.transactions || selectedAsset.transactions.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '30px 14px', color: 'var(--hy-text-secondary)' }}>
                    <span style={{ fontSize: 28 }}>📝</span>
                    <p style={{ marginTop: 8 }}>هنوز تراکنش یا معامله‌ای برای این دارایی ثبت نشده است.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedAsset.transactions.map((tx) => {
                      const isBuy = tx.type === 'buy'
                      return (
                        <div
                          key={tx.id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 12,
                            background: isBuy ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                            border: `1px solid ${isBuy ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: isBuy ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                  color: isBuy ? 'var(--hy-income)' : '#ef4444',
                                }}
                              >
                                {isBuy ? 'خرید / صدور' : 'فروش / ابطال'}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>
                                {toFaDigits(tx.quantity)} واحد
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                                به ارزش هر واحد {formatMoney(tx.unitPrice)}
                              </span>
                            </div>

                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                              <span>تاریخ: <b>{formatPersianDateFull(tx.date) || tx.date}</b></span>
                              <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                              <span>ارزش کل معامله: <b>{formatMoney(tx.totalAmount ?? (tx.quantity * tx.unitPrice))}</b></span>
                              {(tx.type === 'sell' || tx.kind === 'sell' || tx.kind === 'redeem') && tx.realizedProfit !== undefined && (
                                <>
                                  <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                                  <span style={{ color: tx.realizedProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                                    سود حاصل از فروش: {tx.realizedProfit >= 0 ? '+' : ''}{formatMoney(tx.realizedProfit)}
                                  </span>
                                  {tx.avgCostAtSale ? (
                                    <span style={{ fontSize: 10, opacity: 0.8, marginRight: 4 }}>
                                      (مبنای میانگین: {formatMoney(tx.avgCostAtSale)})
                                    </span>
                                  ) : null}
                                </>
                              )}
                              {tx.note && (
                                <>
                                  <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                                  <span>{tx.note}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <button
                              type="button"
                              className="cat-mini danger"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => {
                                if (confirm('آیا از حذف این معامله اطمینان دارید؟ دارایی مجدداً بر اساس باقیمانده سوابق محاسبه خواهد شد.')) {
                                  const updatedTxs = (selectedAsset.transactions || []).filter((t) => t.id !== tx.id)
                                  const recomputed = recomputeAssetFromTransactions(selectedAsset, updatedTxs)
                                  void saveInvestment(recomputed)
                                  notifyUser('معامله حذف و سبد دارایی بازتراز شد')
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
            </div>
          ) : (
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
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedAssetId(asset.id)}
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
                              تعداد باقیمانده: <b>{toFaDigits(asset.quantity)}</b>
                              {asset.unitPrice ? ` · میانگین خرید: ${formatMoney(asset.unitPrice)}` : ''}
                              {asset.currentUnitPrice ? ` · ارزش روز: ${formatMoney(asset.currentUnitPrice)}` : ''}
                              {asset.realizedProfit ? (
                                <span style={{ marginRight: 6, color: asset.realizedProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                  · سود فروش گذشته: {asset.realizedProfit >= 0 ? '+' : ''}{formatMoney(asset.realizedProfit)}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          {asset.note ? (
                            <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                              {asset.note}
                            </div>
                          ) : null}
                        </div>

                        <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="cat-mini"
                            type="button"
                            style={{ background: 'rgba(37, 99, 235, 0.2)', color: 'var(--hy-accent)', fontWeight: 800, fontSize: 11 }}
                            onClick={() => setSelectedAssetId(asset.id)}
                          >
                            🔍 سوابق و معاملات
                          </button>
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
        </div>
      )}

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
                          const buyU = Number(digitsOnly(invUnitPrice))
                          const currU = Number(digitsOnly(invCurrentUnitPrice)) || buyU
                          if (q > 0) {
                            if (buyU > 0) setInvBuyPrice(formatSeparatedNumber(q * buyU))
                            if (currU > 0) setInvCurrentValue(formatSeparatedNumber(q * currU))
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
                          const buyU = Number(digitsOnly(uStr))
                          if (!invCurrentUnitPrice) setInvCurrentUnitPrice(uStr)
                          const q = Number(digitsOnly(invQuantity))
                          if (q > 0 && buyU > 0) {
                            setInvBuyPrice(formatSeparatedNumber(q * buyU))
                            if (!invCurrentValue) {
                              const currU = Number(digitsOnly(invCurrentUnitPrice)) || buyU
                              setInvCurrentValue(formatSeparatedNumber(q * currU))
                            }
                          }
                        }}
                      />
                      <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)', display: 'block', marginTop: 2 }}>
                        (قیمت واحد در زمان خرید)
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text)' }}>
                        ارزش روز هر واحد ({unitLabel}):
                      </label>
                      <input
                        className="field-input"
                        inputMode="numeric"
                        placeholder={`ارزش روز هر واحد (${unitLabel})`}
                        value={invCurrentUnitPrice}
                        onChange={(e) => {
                          const uStr = formatSeparatedNumber(e.target.value)
                          setInvCurrentUnitPrice(uStr)
                          const currU = Number(digitsOnly(uStr))
                          const q = Number(digitsOnly(invQuantity))
                          if (q > 0 && currU > 0) {
                            setInvCurrentValue(formatSeparatedNumber(q * currU))
                          }
                        }}
                      />
                      <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)', display: 'block', marginTop: 2 }}>
                        (قیمت لحظه‌ای روز بازار)
                      </span>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>
                        بهای کل خرید ({unitLabel}):
                      </label>
                      <input
                        className="field-input"
                        inputMode="numeric"
                        placeholder={`بهای کل خرید (${unitLabel})`}
                        value={invBuyPrice}
                        onChange={(e) => setInvBuyPrice(formatSeparatedNumber(e.target.value))}
                      />
                      <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)', display: 'block', marginTop: 2 }}>
                        (تعداد × بهای خرید هر واحد)
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700 }}>
                      ارزش روز کل دارایی ({unitLabel}):
                    </label>
                    <input
                      className="field-input"
                      inputMode="numeric"
                      placeholder={`ارزش روز کل (${unitLabel})`}
                      value={invCurrentValue}
                      onChange={(e) => setInvCurrentValue(formatSeparatedNumber(e.target.value))}
                    />
                    <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)', display: 'block', marginTop: 2 }}>
                      (تعداد × ارزش روز هر واحد — بر اساس قیمت لحظه‌ای)
                    </span>
                  </div>

                  {/* پیش‌نمایش زنده سود و زیان */}
                  {(() => {
                    const buyTotal = Number(digitsOnly(invBuyPrice)) || (Number(digitsOnly(invQuantity)) * Number(digitsOnly(invUnitPrice)))
                    const currTotal = Number(digitsOnly(invCurrentValue)) || (Number(digitsOnly(invQuantity)) * (Number(digitsOnly(invCurrentUnitPrice)) || Number(digitsOnly(invUnitPrice))))
                    if (!buyTotal || !currTotal) return null
                    const diff = currTotal - buyTotal
                    const roi = buyTotal > 0 ? (diff / buyTotal) * 100 : 0
                    const isProfit = diff > 0
                    const isLoss = diff < 0

                    return (
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: 14,
                          background: isProfit ? 'rgba(16, 185, 129, 0.12)' : isLoss ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${isProfit ? 'rgba(16, 185, 129, 0.3)' : isLoss ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 4,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text)' }}>
                          📊 برآورد سود / زیان اولیه:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: isProfit ? '#10b981' : isLoss ? '#ef4444' : 'var(--hy-text-secondary)' }}>
                          <span>{isProfit ? 'سود:' : isLoss ? 'زیان:' : 'سر به سر'}</span>
                          <span>{formatMoney(currencyUnit === 'IRT' ? Math.abs(diff) * 10 : Math.abs(diff))}</span>
                          <span style={{ direction: 'ltr', fontWeight: 900 }}>
                            ({isProfit ? '+' : isLoss ? '-' : ''}{toFaDigits(Math.abs(roi).toFixed(1))}٪)
                          </span>
                        </div>
                      </div>
                    )
                  })()}

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
                      const buyUnitPriceNum = Number(digitsOnly(invUnitPrice))
                      const currUnitPriceNum = Number(digitsOnly(invCurrentUnitPrice)) || buyUnitPriceNum

                      // فیلدهای اجباری: نام نماد، تعداد واحد و سهم، بهای خرید هر واحد
                      if (!name) {
                        notifyUser('وارد کردن نام یا نماد دارایی الزامی است')
                        return
                      }
                      if (!q || q <= 0) {
                        notifyUser('وارد کردن تعداد واحد و سهم الزامی است')
                        return
                      }
                      if (!buyUnitPriceNum || buyUnitPriceNum <= 0) {
                        notifyUser('وارد کردن بهای خرید هر واحد الزامی است')
                        return
                      }

                      // تبدیل مبالغ به ریال برای ذخیره‌سازی استاندارد در پایگاه داده
                      const buyUnitPriceRials = currencyUnit === 'IRT' ? buyUnitPriceNum * 10 : buyUnitPriceNum
                      const currUnitPriceRials = currencyUnit === 'IRT' ? currUnitPriceNum * 10 : currUnitPriceNum

                      const defaultBuyTotal = q * buyUnitPriceRials
                      const defaultCurrTotal = q * currUnitPriceRials

                      const purchaseAmount = invBuyPrice ? parseAmountToRials(invBuyPrice) : defaultBuyTotal
                      const currentValue = invCurrentValue ? parseAmountToRials(invCurrentValue) : defaultCurrTotal

                      const existingTxs = editingInv?.transactions
                      let updatedTxs = existingTxs
                      if (!updatedTxs || updatedTxs.length === 0) {
                        updatedTxs = [
                          {
                            id: createId('itx'),
                            assetId: editingInv?.id || '',
                            kind: 'buy',
                            type: 'buy',
                            date: todayIso(),
                            quantity: q,
                            unitPrice: buyUnitPriceRials,
                            totalAmount: purchaseAmount,
                            note: 'خرید اولیه دارایی',
                            createdAt: Date.now(),
                          },
                        ]
                      }

                      void saveInvestment({
                        id: editingInv?.id || undefined,
                        name,
                        market: invMarket,
                        symbol: invSymbol.trim() || undefined,
                        inscode: invInscode.trim() || undefined,
                        purchaseAmount, // بهای کل خرید بر اساس زمان خرید (ثابت می‌ماند)
                        currentValue,   // ارزش روز دارایی (با به‌روزرسانی قیمت تغییر می‌کند)
                        quantity: q,
                        unitPrice: buyUnitPriceRials, // بهای خرید هر واحد در زمان خرید
                        currentUnitPrice: currUnitPriceRials, // ارزش روز هر واحد بر اساس آخرین قیمت روز
                        note: invNote.trim() || undefined,
                        realizedProfit: editingInv?.realizedProfit || 0,
                        transactions: updatedTxs,
                      })

                      notifyUser(editingInv ? 'دارایی با موفقیت ویرایش شد' : 'دارایی با بهای خرید زمان معامله و ارزش روز ثبت شد')
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
                    { id: 'mofid', label: '⭐ صندوق‌های کارگزاری مفید' },
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

          {/* Modal for Buy / Sell Transaction (صدور / ابطال یا خرید و فروش) */}
          {isTxModalOpen && selectedAsset && (
            <WindowPopup
              isOpen={isTxModalOpen}
              title={txType === 'buy' ? `ثبت خرید / صدور نماد ${selectedAsset.name}` : `ثبت فروش / ابطال نماد ${selectedAsset.name}`}
              icon={txType === 'buy' ? '📈' : '📉'}
              onClose={() => setIsTxModalOpen(false)}
              defaultWidth={460}
              defaultHeight={540}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Buy vs Sell segmented toggle */}
                <div className="seg" style={{ margin: '0 0 6px' }}>
                  <button
                    type="button"
                    className={`seg-btn${txType === 'buy' ? ' active' : ''}`}
                    onClick={() => setTxType('buy')}
                    style={{
                      background: txType === 'buy' ? 'var(--hy-income)' : undefined,
                      color: txType === 'buy' ? '#fff' : undefined,
                      fontWeight: 800,
                    }}
                  >
                    ＋ خرید / صدور
                  </button>
                  <button
                    type="button"
                    className={`seg-btn${txType === 'sell' ? ' active' : ''}`}
                    onClick={() => setTxType('sell')}
                    style={{
                      background: txType === 'sell' ? '#ef4444' : undefined,
                      color: txType === 'sell' ? '#fff' : undefined,
                      fontWeight: 800,
                    }}
                  >
                    − فروش / ابطال
                  </button>
                </div>

                <div className="field-stack">
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700 }}>تاریخ معامله:</label>
                    <input
                      className="field-input"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                    />
                    <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)', display: 'block', marginTop: 2 }}>
                      تاریخ شمسی: {formatPersianDateFull(txDate) || 'امروز'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>
                        {txType === 'buy' ? 'تعداد خرید / صدور:' : 'تعداد فروش / ابطال:'}
                      </label>
                      <input
                        className="field-input"
                        inputMode="numeric"
                        placeholder="مثلاً: ۲۵۰"
                        value={txQuantity}
                        onChange={(e) => setTxQuantity(formatSeparatedNumber(e.target.value))}
                      />
                      {txType === 'sell' && (
                        <span style={{ fontSize: 10, color: 'var(--hy-text-secondary)', display: 'block', marginTop: 2 }}>
                          موجودی فعلی: {toFaDigits(selectedAsset.quantity || 0)} واحد
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>
                        قیمت هر واحد ({unitLabel}):
                      </label>
                      <input
                        className="field-input"
                        inputMode="numeric"
                        placeholder={`قیمت هر واحد (${unitLabel})`}
                        value={txUnitPrice}
                        onChange={(e) => setTxUnitPrice(formatSeparatedNumber(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Real-time transaction simulation */}
                  {(() => {
                    const q = Number(digitsOnly(txQuantity))
                    const p = Number(digitsOnly(txUnitPrice))
                    if (!q || !p) return null

                    const unitMultiplier = currencyUnit === 'IRT' ? 10 : 1
                    const totalRials = q * p * unitMultiplier
                    const remainingQty = selectedAsset.quantity || 0
                    const avgCost = selectedAsset.unitPrice || 0
                    const pRials = p * unitMultiplier

                    if (txType === 'sell') {
                      const isOverSell = q > remainingQty
                      const profitRials = q * (pRials - avgCost)
                      const isGain = profitRials > 0
                      const isLoss = profitRials < 0
                      const newRemaining = Math.max(0, remainingQty - q)

                      return (
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: isOverSell ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${isOverSell ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                            fontSize: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>ارزش کل فروش:</span>
                            <b>{formatMoney(totalRials)}</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: isGain ? '#10b981' : isLoss ? '#ef4444' : undefined }}>
                            <span>سود حاصل از این فروش:</span>
                            <b>{isGain ? '+' : ''}{formatMoney(profitRials)}</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hy-text-secondary)', fontSize: 11 }}>
                            <span>مقدار باقیمانده پس از فروش:</span>
                            <b>{toFaDigits(newRemaining)} واحد</b>
                          </div>
                          {isOverSell && (
                            <div style={{ color: '#ef4444', fontWeight: 800, marginTop: 4 }}>
                              ⚠️ تعداد فروش نمی‌تواند بیشتر از موجودی باقیمانده ({toFaDigits(remainingQty)} واحد) باشد.
                            </div>
                          )}
                        </div>
                      )
                    } else {
                      // Buy simulation
                      const newTotalQty = remainingQty + q
                      const currentTotalCost = selectedAsset.purchaseAmount || 0
                      const newTotalCost = currentTotalCost + totalRials
                      const newAvgPrice = newTotalQty > 0 ? Math.round(newTotalCost / newTotalQty) : 0

                      return (
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            fontSize: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>ارزش کل خرید:</span>
                            <b>{formatMoney(totalRials)}</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>کل تعداد پس از خرید:</span>
                            <b>{toFaDigits(newTotalQty)} واحد</b>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--hy-teal)' }}>
                            <span>میانگین موزون بهای خرید جدید:</span>
                            <b>{formatMoney(newAvgPrice)}</b>
                          </div>
                        </div>
                      )
                    }
                  })()}

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700 }}>یادداشت / بابت معامله (اختیاری):</label>
                    <input
                      className="field-input"
                      placeholder="اختیاری (مثلاً: خرید پله‌ای، شناسایی سود)"
                      value={txNote}
                      onChange={(e) => setTxNote(e.target.value)}
                    />
                  </div>

                  <button
                    className="cta-confirm"
                    type="button"
                    style={{
                      marginTop: 8,
                      background: txType === 'buy' ? 'var(--hy-income)' : '#ef4444',
                    }}
                    disabled={
                      txType === 'sell' &&
                      Number(digitsOnly(txQuantity)) > (selectedAsset.quantity || 0)
                    }
                    onClick={() => {
                      const q = Number(digitsOnly(txQuantity))
                      const p = Number(digitsOnly(txUnitPrice))
                      if (!q || q <= 0 || !p || p <= 0) {
                        notifyUser('تعداد و قیمت هر واحد الزامی است')
                        return
                      }
                      if (txType === 'sell' && q > (selectedAsset.quantity || 0)) {
                        notifyUser('تعداد فروش نمی‌تواند بیشتر از موجودی باقیمانده باشد')
                        return
                      }

                      const unitMultiplier = currencyUnit === 'IRT' ? 10 : 1
                      const pRials = p * unitMultiplier
                      const totalRials = q * pRials

                      const newTx: InvestmentTransaction = {
                        id: createId('itx'),
                        assetId: selectedAsset.id,
                        kind: txType,
                        type: txType,
                        date: txDate.trim() || todayIso(),
                        quantity: q,
                        unitPrice: pRials,
                        totalAmount: totalRials,
                        note: txNote.trim() || undefined,
                        createdAt: Date.now(),
                      }

                      let currentTxs = selectedAsset.transactions || []
                      if (currentTxs.length === 0 && (selectedAsset.quantity || 0) > 0) {
                        currentTxs = [
                          {
                            id: createId('itx'),
                            assetId: selectedAsset.id,
                            kind: 'buy',
                            type: 'buy',
                            date: selectedAsset.purchaseDate || todayIso(new Date(selectedAsset.createdAt)),
                            quantity: selectedAsset.quantity || 1,
                            unitPrice: selectedAsset.unitPrice || 0,
                            totalAmount: selectedAsset.purchaseAmount || 0,
                            note: 'خرید اولیه دارایی',
                            createdAt: selectedAsset.createdAt || Date.now(),
                          },
                        ]
                      }

                      const allTxs = [...currentTxs, newTx]
                      const recomputed = recomputeAssetFromTransactions(selectedAsset, allTxs)

                      void saveInvestment(recomputed)
                      setIsTxModalOpen(false)
                      notifyUser(
                        txType === 'buy'
                          ? `خرید ${toFaDigits(q)} واحد نماد «${selectedAsset.name}» ثبت شد`
                          : `فروش ${toFaDigits(q)} واحد نماد «${selectedAsset.name}» ثبت و سود قطعی محاسبه شد`
                      )
                    }}
                  >
                    {txType === 'buy' ? 'ثبت خرید / صدور' : 'ثبت فروش / ابطال'}
                  </button>
                </div>
              </div>
            </WindowPopup>
          )}
        </div>
      )}
    </div>
  )
}

