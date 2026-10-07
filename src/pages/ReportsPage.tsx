import { useMemo, useState } from 'react'
import { categoriesFor } from '../lib/categories'
import { monthKey, expenseByCategory, spentInCategory } from '../lib/reports'
import { todayIso } from '../lib/iso'
import { createId } from '../lib/ids'
import { toFaDigits } from '../lib/money'
import { SettingsButton } from '../components/SettingsButton'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import { notifyUser } from '../lib/sync'
import type { CardMarket, InvestmentMarket, DongEvent, DongExpenseItem } from '../types'

const MARKETS: { id: CardMarket; label: string; icon: string }[] = [
  { id: 'gold', label: 'طلا و سکه', icon: '🪙' },
  { id: 'stock', label: 'بورس و سهام', icon: '📈' },
  { id: 'fund', label: 'صندوق سرمایه‌گذاری', icon: '🏦' },
  { id: 'crypto', label: 'ارز دیجیتال', icon: '💎' },
  { id: 'bank', label: 'سپرده بانکی', icon: '💳' },
  { id: 'cash', label: 'پس‌انداز نقدی', icon: '💵' },
]

const INVESTMENT_MARKETS: { id: InvestmentMarket; label: string; icon: string }[] = [
  { id: 'gold', label: 'طلا و سکه', icon: '🪙' },
  { id: 'stock', label: 'بورس و سهام', icon: '📈' },
  { id: 'fund', label: 'صندوق‌های مالی', icon: '🏦' },
  { id: 'crypto', label: 'ارز دیجیتال', icon: '💎' },
  { id: 'property', label: 'ملک و مسکن', icon: '🏠' },
  { id: 'bank', label: 'سپرده بلندمدت', icon: '💳' },
  { id: 'other', label: 'سایر دارایی‌ها', icon: '📦' },
]

type ActiveTab = 'budget' | 'goals' | 'investments' | 'dong'

interface SettlementTransfer {
  fromName: string
  toName: string
  amount: number
}

function computeDongSettlement(event: DongEvent): SettlementTransfer[] {
  const participants = event.participants
  if (participants.length <= 1 || event.expenses.length === 0) return []

  const balanceMap = new Map<string, number>()
  for (const p of participants) balanceMap.set(p.id, 0)

  for (const exp of event.expenses) {
    if (exp.amount <= 0) continue
    const splitCount = exp.splitAmongIds.length || participants.length
    const share = Math.round(exp.amount / splitCount)
    // Payer is credited
    balanceMap.set(exp.paidById, (balanceMap.get(exp.paidById) ?? 0) + exp.amount)
    // Consumers are debited
    const splits = exp.splitAmongIds.length > 0 ? exp.splitAmongIds : participants.map((p) => p.id)
    for (const id of splits) {
      balanceMap.set(id, (balanceMap.get(id) ?? 0) - share)
    }
  }

  const debtors: { id: string; name: string; amount: number }[] = []
  const creditors: { id: string; name: string; amount: number }[] = []

  for (const p of participants) {
    const net = balanceMap.get(p.id) ?? 0
    if (net < -100) debtors.push({ id: p.id, name: p.name, amount: -net })
    else if (net > 100) creditors.push({ id: p.id, name: p.name, amount: net })
  }

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const transfers: SettlementTransfer[] = []
  let dIdx = 0
  let cIdx = 0

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx]
    const creditor = creditors[cIdx]
    const pay = Math.min(debtor.amount, creditor.amount)

    if (pay > 0) {
      transfers.push({
        fromName: debtor.name,
        toName: creditor.name,
        amount: Math.round(pay),
      })
    }

    debtor.amount -= pay
    creditor.amount -= pay

    if (debtor.amount <= 100) dIdx++
    if (creditor.amount <= 100) cIdx++
  }

  return transfers
}

export function ReportsPage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const { transactions, customCategories } = useStore()
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
  const catMax = Math.max(1, ...bars.map((bar) => bar.amount))

  // Budget form states
  const [limit, setLimit] = useState('')
  const [categoryId, setCategoryId] = useState(categoriesFor('expense', customCategories)[0]?.id ?? 'food')

  // Goal form states
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalMarket, setGoalMarket] = useState<CardMarket>('gold')
  const [goalDepositAmount, setGoalDepositAmount] = useState<Record<string, string>>({})

  // Investment form states
  const [invName, setInvName] = useState('')
  const [invMarket, setInvMarket] = useState<InvestmentMarket>('gold')
  const [invBuyPrice, setInvBuyPrice] = useState('')
  const [invCurrentValue, setInvCurrentValue] = useState('')
  const [invQuantity, setInvQuantity] = useState('')
  const [invNote, setInvNote] = useState('')
  const [invMarketFilter, setInvMarketFilter] = useState<string>('all')
  const [editingInvId, setEditingInvId] = useState<string | null>(null)
  const [quickUpdateValue, setQuickUpdateValue] = useState<Record<string, string>>({})

  // Dong form states
  const [dongTitle, setDongTitle] = useState('')
  const [dongMemberInput, setDongMemberInput] = useState('')
  const [dongMembers, setDongMembers] = useState<string[]>(['من', 'همراه ۱'])
  const [selectedDongId, setSelectedDongId] = useState<string | null>(null)
  const [newExpTitle, setNewExpTitle] = useState('')
  const [newExpAmount, setNewExpAmount] = useState('')
  const [newExpPayer, setNewExpPayer] = useState('')
  const [newExpSplits, setNewExpSplits] = useState<string[]>([])

  // Parse Rial amount taking into account current currency unit (IRT is x10 Rial)
  const parseAmountToRials = (val: string): number => {
    const raw = Number(val.replace(/[,،\s]/g, ''))
    if (isNaN(raw) || raw <= 0) return 0
    return currencyUnit === 'IRT' ? raw * 10 : raw
  }

  // Summary Metrics
  const totalBudgetLimit = useMemo(() => budgets.reduce((sum, b) => sum + b.monthlyLimit, 0), [budgets])
  const totalBudgetSpent = useMemo(
    () => budgets.reduce((sum, b) => sum + spentInCategory(transactions, month, b.categoryId), 0),
    [budgets, transactions, month]
  )

  const totalSavedGoals = useMemo(() => goals.reduce((sum, g) => sum + g.saved, 0), [goals])
  const totalTargetGoals = useMemo(() => goals.reduce((sum, g) => sum + g.target, 0), [goals])

  const totalInvestmentCost = useMemo(() => investments.reduce((sum, i) => sum + i.purchaseAmount, 0), [investments])
  const totalInvestmentValue = useMemo(() => investments.reduce((sum, i) => sum + i.currentValue, 0), [investments])
  const totalInvestmentProfit = totalInvestmentValue - totalInvestmentCost
  const totalInvestmentRoi =
    totalInvestmentCost > 0 ? ((totalInvestmentProfit / totalInvestmentCost) * 100).toFixed(1) : '0'

  const selectedDongEvent = useMemo(
    () => (selectedDongId ? dongEvents.find((d) => d.id === selectedDongId) : null),
    [dongEvents, selectedDongId]
  )

  const activeDongTransfers = useMemo(() => {
    if (!selectedDongEvent) return []
    return computeDongSettlement(selectedDongEvent)
  }, [selectedDongEvent])

  const filteredInvestments = useMemo(() => {
    if (invMarketFilter === 'all') return investments
    return investments.filter((i) => i.market === invMarketFilter)
  }, [investments, invMarketFilter])

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
              نسخه ۰.۲.۰
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
          <section className="lg report-card">
            <h2>هزینه‌های این ماه به تفکیک دسته‌بندی</h2>
            {bars.length === 0 ? (
              <p className="sheet-sub" style={{ margin: '14px 0' }}>
                هزینه‌ای در این ماه ثبت نشده است.
              </p>
            ) : (
              bars.map((bar) => (
                <div key={bar.id} className="cat-bar-row">
                  <span className="name">{bar.name}</span>
                  <span className="track">
                    <span style={{ width: `${(bar.amount / catMax) * 100}%` }} />
                  </span>
                  <span className="amt">{formatMoney(bar.amount)}</span>
                </div>
              ))
            )}

            {/* Tag-based spending insights */}
            {(() => {
              const tagMap = new Map<string, number>()
              for (const tx of transactions) {
                if (tx.kind === 'expense' && tx.tags) {
                  for (const t of tx.tags) {
                    tagMap.set(t, (tagMap.get(t) ?? 0) + tx.amount)
                  }
                }
              }
              const tagList = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1])
              if (tagList.length === 0) return null
              const maxTag = Math.max(1, ...tagList.map(([, v]) => v))
              return (
                <div style={{ marginTop: 24 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🏷️ هزینه‌ها بر اساس برچسب‌ها</h3>
                  {tagList.slice(0, 6).map(([tagName, tagAmt]) => (
                    <div key={tagName} className="cat-bar-row">
                      <span className="name">#{tagName}</span>
                      <span className="track">
                        <span style={{ width: `${(tagAmt / maxTag) * 100}%`, background: 'var(--hy-accent)' }} />
                      </span>
                      <span className="amt">{formatMoney(tagAmt)}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </section>

          <div>
            <section className="lg report-card">
              <h2>سقف بودجه ماهانه دسته‌ها</h2>
              <p className="sheet-sub" style={{ marginBottom: 12 }}>
                برای هر دسته‌بندی سقف تعیین کنید تا مخارج از کنترل خارج نشود.
              </p>

              <div className="field-stack">
                <select
                  className="field-input"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  aria-label="دسته بودجه"
                >
                  {categoriesFor('expense', customCategories).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <input
                  className="field-input"
                  inputMode="numeric"
                  placeholder={`سقف ماهانه (${unitLabel})`}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
                <button
                  className="cta-confirm"
                  type="button"
                  onClick={() => {
                    const monthlyLimit = parseAmountToRials(limit)
                    if (!monthlyLimit) return
                    void saveBudget({ id: createId('bud'), categoryId, monthlyLimit })
                    setLimit('')
                    notifyUser('سقف بودجه ذخیره شد')
                  }}
                >
                  ثبت سقف جدید
                </button>
              </div>

              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {budgets.length === 0 ? (
                  <p className="sheet-sub">هنوز سقفی برای دسته‌بندی‌ها ثبت نشده است.</p>
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
          </div>
        </div>
      )}

      {/* ────────────────── 2. SAVINGS GOALS TAB ────────────────── */}
      {activeTab === 'goals' && (
        <div className="split-wide">
          <section className="lg report-card">
            <h2>ثبت هدف پس‌انداز جدید</h2>
            <p className="sheet-sub" style={{ marginBottom: 12 }}>
              یک هدف مشخص تعیین کنید (خرید خانه، تعویض ماشین، سفر یا طلا) و به مرور آن را پر کنید.
            </p>
            <div className="field-stack">
              <input
                className="field-input"
                placeholder="نام هدف (مثلاً: رهن آپارتمان، خرید لپ‌تاپ)"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
              />
              <input
                className="field-input"
                inputMode="numeric"
                placeholder={`مبلغ هدف (${unitLabel})`}
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
              />
              <select
                className="field-input"
                value={goalMarket}
                onChange={(e) => setGoalMarket(e.target.value as CardMarket)}
                aria-label="نوع پس‌انداز"
              >
                {MARKETS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.icon} {m.label}
                  </option>
                ))}
              </select>
              <button
                className="cta-confirm"
                type="button"
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
                  })
                  setGoalName('')
                  setGoalTarget('')
                  notifyUser('هدف پس‌انداز با موفقیت ساخته شد')
                }}
              >
                ساخت هدف پس‌انداز
              </button>
            </div>
          </section>

          <section className="lg report-card">
            <h2>اهداف فعال ({toFaDigits(goals.length)})</h2>
            {goals.length === 0 ? (
              <p className="sheet-sub" style={{ margin: '14px 0' }}>
                هنوز هدفی برای پس‌انداز ایجاد نکرده‌اید.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                {goals.map((goal) => {
                  const ratio = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0
                  const marketInfo = MARKETS.find((m) => m.id === goal.market)
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

                      <div className="progress-bar" style={{ height: 8, marginBottom: 10 }}>
                        <span
                          style={{
                            width: `${ratio}%`,
                            background: ratio >= 100 ? 'var(--hy-income)' : 'var(--hy-accent)',
                          }}
                        />
                      </div>

                      {/* Deposit Actions */}
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
                              setGoalDepositAmount({ ...goalDepositAmount, [goal.id]: e.target.value })
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
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ────────────────── 3. INVESTMENTS TAB ────────────────── */}
      {activeTab === 'investments' && (
        <div>
          {/* Sub-market Filter */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 12 }}>
            <button
              className={`cat-mini${invMarketFilter === 'all' ? ' active' : ''}`}
              type="button"
              onClick={() => setInvMarketFilter('all')}
            >
              همه دارایی‌ها ({toFaDigits(investments.length)})
            </button>
            {INVESTMENT_MARKETS.map((m) => {
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

          <div className="split-wide">
            {/* Add / Edit Investment Asset */}
            <section className="lg report-card">
              <h2>{editingInvId ? 'ویرایش دارایی سرمایه‌گذاری' : 'ثبت دارایی سرمایه‌گذاری جدید'}</h2>
              <p className="sheet-sub" style={{ marginBottom: 12 }}>
                ارزش روز طلا، سهام، رمزارز یا صندوق را ثبت کنید تا از سود یا زیان سبد خود باخبر باشید.
              </p>

              <div className="field-stack">
                <input
                  className="field-input"
                  placeholder="نام دارایی (مثلاً: طلای ۱۸ عیار، نماد فملی، تتر)"
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                />

                <select
                  className="field-input"
                  value={invMarket}
                  onChange={(e) => setInvMarket(e.target.value as InvestmentMarket)}
                  aria-label="بازار سرمایه‌گذاری"
                >
                  {INVESTMENT_MARKETS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.icon} {m.label}
                    </option>
                  ))}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    placeholder={`بهای خرید کل (${unitLabel})`}
                    value={invBuyPrice}
                    onChange={(e) => setInvBuyPrice(e.target.value)}
                  />
                  <input
                    className="field-input"
                    inputMode="numeric"
                    placeholder={`ارزش روز کل (${unitLabel})`}
                    value={invCurrentValue}
                    onChange={(e) => setInvCurrentValue(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    className="field-input"
                    placeholder="مقدار / تعداد (اختیاری)"
                    value={invQuantity}
                    onChange={(e) => setInvQuantity(e.target.value)}
                  />
                  <input
                    className="field-input"
                    placeholder="یادداشت یا کارگزاری"
                    value={invNote}
                    onChange={(e) => setInvNote(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="cta-confirm"
                    type="button"
                    style={{ flex: 1 }}
                    onClick={() => {
                      const purchaseAmount = parseAmountToRials(invBuyPrice)
                      const currentValue = parseAmountToRials(invCurrentValue)
                      if (!invName.trim() || !purchaseAmount || !currentValue) {
                        notifyUser('نام، قیمت خرید و ارزش روز الزامی است')
                        return
                      }

                      void saveInvestment({
                        id: editingInvId || undefined,
                        name: invName.trim(),
                        market: invMarket,
                        purchaseAmount,
                        currentValue,
                        quantity: invQuantity ? Number(invQuantity.replace(/[^\d.]/g, '')) : undefined,
                        note: invNote.trim() || undefined,
                      })

                      notifyUser(editingInvId ? 'دارایی بروزرسانی شد' : 'دارایی جدید به سبد اضافه شد')
                      setEditingInvId(null)
                      setInvName('')
                      setInvBuyPrice('')
                      setInvCurrentValue('')
                      setInvQuantity('')
                      setInvNote('')
                    }}
                  >
                    {editingInvId ? 'ذخیره تغییرات' : 'افزودن به سبد سرمایه‌گذاری'}
                  </button>
                  {editingInvId ? (
                    <button
                      className="cat-mini"
                      type="button"
                      onClick={() => {
                        setEditingInvId(null)
                        setInvName('')
                        setInvBuyPrice('')
                        setInvCurrentValue('')
                        setInvQuantity('')
                        setInvNote('')
                      }}
                    >
                      انصراف
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Investment List */}
            <section className="lg report-card">
              <h2>سبد دارایی‌ها ({toFaDigits(filteredInvestments.length)})</h2>
              {filteredInvestments.length === 0 ? (
                <p className="sheet-sub" style={{ margin: '14px 0' }}>
                  هیچ دارایی در این دسته‌بندی یافت نشد.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {filteredInvestments.map((asset) => {
                    const profit = asset.currentValue - asset.purchaseAmount
                    const roi =
                      asset.purchaseAmount > 0 ? ((profit / asset.purchaseAmount) * 100).toFixed(1) : '0'
                    const isProfitable = profit >= 0
                    const marketMeta = INVESTMENT_MARKETS.find((m) => m.id === asset.market)

                    return (
                      <div
                        key={asset.id}
                        className="home-card lg"
                        style={{
                          padding: '14px 16px',
                          borderRadius: 16,
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          background: 'rgba(255, 255, 255, 0.03)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 17 }}>{marketMeta?.icon ?? '📦'}</span>
                              <span style={{ fontWeight: 800, fontSize: 15 }}>{asset.name}</span>
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
                            </div>
                            {asset.note ? (
                              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 4 }}>
                                {asset.note}
                              </div>
                            ) : null}
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="cat-mini"
                              type="button"
                              onClick={() => {
                                setEditingInvId(asset.id)
                                setInvName(asset.name)
                                setInvMarket(asset.market)
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
                                setInvQuantity(asset.quantity ? String(asset.quantity) : '')
                                setInvNote(asset.note || '')
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

                        {/* Values grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 8,
                            margin: '12px 0 8px',
                            background: 'rgba(0,0,0,0.18)',
                            padding: '10px 12px',
                            borderRadius: 12,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>بهای خرید</div>
                            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                              {formatCompactMoney(asset.purchaseAmount)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>ارزش روز</div>
                            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: 'var(--hy-accent)' }}>
                              {formatCompactMoney(asset.currentValue)}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>سود / زیان</div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                marginTop: 2,
                                color: isProfitable ? 'var(--hy-income)' : 'var(--hy-expense)',
                              }}
                            >
                              {isProfitable ? '+' : ''}
                              {formatCompactMoney(profit)} ({toFaDigits(roi)}%)
                            </div>
                          </div>
                        </div>

                        {/* Quick Update Current Value */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                          <input
                            className="field-input"
                            style={{ height: 30, fontSize: 11, padding: '4px 8px', flex: 1 }}
                            placeholder={`ارزش روز تازه (${unitLabel})`}
                            value={quickUpdateValue[asset.id] || ''}
                            onChange={(e) =>
                              setQuickUpdateValue({ ...quickUpdateValue, [asset.id]: e.target.value })
                            }
                          />
                          <button
                            className="cat-mini"
                            type="button"
                            onClick={() => {
                              const nextVal = parseAmountToRials(quickUpdateValue[asset.id] || '')
                              if (!nextVal) return
                              void saveInvestment({ ...asset, currentValue: nextVal })
                              setQuickUpdateValue({ ...quickUpdateValue, [asset.id]: '' })
                              notifyUser(`ارزش روز ${asset.name} بروزرسانی شد`)
                            }}
                          >
                            بروزرسانی ارزش
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ────────────────── 4. DONG / BILL SPLIT TAB ────────────────── */}
      {activeTab === 'dong' && (
        <div className="split-wide">
          {/* Create Dong Event or list */}
          <section className="lg report-card">
            <h2>محاسبه‌گر دونگ گروهی</h2>
            <p className="sheet-sub" style={{ marginBottom: 12 }}>
              برای سفرها، مهمانی‌ها، اجاره و خریدها دونگ‌ها را ثبت کنید تا سیستم خودکار محاسبه کند چه کسی به چه کسی
              چقدر بدهکار است.
            </p>

            <div className="field-stack">
              <input
                className="field-input"
                placeholder="عنوان رویداد (مثلاً: سفر شمال، دورهمی رستوران، اجاره خانه)"
                value={dongTitle}
                onChange={(e) => setDongTitle(e.target.value)}
              />

              {/* Members Manager */}
              <div style={{ marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  افراد حاضر در رویداد ({toFaDigits(dongMembers.length)} نفر):
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {dongMembers.map((m, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 8,
                        background: 'rgba(37, 99, 235, 0.18)',
                        color: 'var(--hy-text)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>👤 {m}</span>
                      {dongMembers.length > 2 ? (
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, opacity: 0.7 }}
                          onClick={() => setDongMembers(dongMembers.filter((_, i) => i !== idx))}
                        >
                          ✕
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="field-input"
                    style={{ flex: 1, height: 34, fontSize: 12 }}
                    placeholder="نام عضو جدید…"
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
              </div>

              <button
                className="cta-confirm"
                type="button"
                style={{ marginTop: 8 }}
                onClick={() => {
                  if (!dongTitle.trim() || dongMembers.length < 2) {
                    notifyUser('عنوان و حداقل ۲ عضو الزامی است')
                    return
                  }
                  const newEvent: Omit<DongEvent, 'id' | 'createdAt'> = {
                    title: dongTitle.trim(),
                    date: todayIso(),
                    participants: dongMembers.map((name, i) => ({ id: `p_${i + 1}`, name })),
                    expenses: [],
                    settled: false,
                  }
                  void saveDongEvent(newEvent).then((saved) => {
                    setSelectedDongId(saved.id)
                    setDongTitle('')
                    notifyUser('رویداد دونگ ایجاد شد')
                  })
                }}
              >
                ایجاد رویداد دونگ جدید
              </button>
            </div>

            {/* List of existing dong events */}
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>رویدادهای ثبت‌شده</h3>
              {dongEvents.length === 0 ? (
                <p className="sheet-sub">رویدادی موجود نیست.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dongEvents.map((evt) => {
                    const isSelected = selectedDongId === evt.id
                    const totalCost = evt.expenses.reduce((sum, e) => sum + e.amount, 0)
                    return (
                      <div
                        key={evt.id}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 12,
                          background: isSelected ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255,255,255,0.04)',
                          border: isSelected ? '1px solid var(--hy-accent)' : '1px solid rgba(255,255,255,0.08)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedDongId(evt.id)}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{evt.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                            {toFaDigits(evt.participants.length)} نفر · کل مخارج: {formatMoney(totalCost)}
                            {evt.settled ? (
                              <span style={{ color: 'var(--hy-income)', marginRight: 6 }}>✓ تسویه شده</span>
                            ) : null}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="cat-mini"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedDongId(evt.id)
                            }}
                          >
                            مشاهده و تسویه
                          </button>
                          <button
                            className="cat-mini danger"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void deleteDongEvent(evt.id)
                              if (selectedDongId === evt.id) setSelectedDongId(null)
                              notifyUser('رویداد دونگ حذف شد')
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
          </section>

          {/* Dong Event Details & Settlement */}
          <section className="lg report-card">
            {selectedDongEvent ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2>{selectedDongEvent.title}</h2>
                    <p className="sheet-sub">
                      شرکت‌کنندگان: {selectedDongEvent.participants.map((p) => p.name).join('، ')}
                    </p>
                  </div>
                  <button
                    className="cat-mini"
                    type="button"
                    style={{
                      background: selectedDongEvent.settled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)',
                      color: selectedDongEvent.settled ? 'var(--hy-income)' : 'var(--hy-text)',
                    }}
                    onClick={() => {
                      void saveDongEvent({ ...selectedDongEvent, settled: !selectedDongEvent.settled })
                      notifyUser(selectedDongEvent.settled ? 'وضعیت به جاری تغییر کرد' : 'رویداد تسویه اعلام شد')
                    }}
                  >
                    {selectedDongEvent.settled ? '✓ تسویه شده' : 'علامت‌گذاری به عنوان تسویه'}
                  </button>
                </div>

                {/* Add Expense to this Dong */}
                <div
                  style={{
                    margin: '16px 0',
                    padding: 14,
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>+ ثبت خرج جدید در این رویداد</h3>
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
                        placeholder={`مبلغ (${unitLabel})`}
                        value={newExpAmount}
                        onChange={(e) => setNewExpAmount(e.target.value)}
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

                    <button
                      className="cta-confirm"
                      type="button"
                      onClick={() => {
                        const amount = parseAmountToRials(newExpAmount)
                        if (!newExpTitle.trim() || !amount) {
                          notifyUser('عنوان و مبلغ خرج الزامی است')
                          return
                        }
                        const payerId = newExpPayer || selectedDongEvent.participants[0]?.id
                        const newItem: DongExpenseItem = {
                          id: createId('dexp'),
                          title: newExpTitle.trim(),
                          amount,
                          paidById: payerId,
                          splitAmongIds:
                            newExpSplits.length > 0 ? newExpSplits : selectedDongEvent.participants.map((p) => p.id),
                          date: todayIso(),
                        }
                        const updated: DongEvent = {
                          ...selectedDongEvent,
                          expenses: [...selectedDongEvent.expenses, newItem],
                        }
                        void saveDongEvent(updated)
                        setNewExpTitle('')
                        setNewExpAmount('')
                        setNewExpSplits([])
                        notifyUser('خرج ثبت شد و دونگ‌ها محاسبه شدند')
                      }}
                    >
                      افزودن خرج
                    </button>
                  </div>
                </div>

                {/* Expense List */}
                <h3 style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 8px' }}>
                  ریز مخارج رویداد ({toFaDigits(selectedDongEvent.expenses.length)} مورد)
                </h3>
                {selectedDongEvent.expenses.length === 0 ? (
                  <p className="sheet-sub">هنوز خرجی در این رویداد ثبت نشده است.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedDongEvent.expenses.map((exp) => {
                      const payer = selectedDongEvent.participants.find((p) => p.id === exp.paidById)
                      return (
                        <div
                          key={exp.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            background: 'rgba(0,0,0,0.15)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{exp.title}</span>
                            <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginRight: 8 }}>
                              پرداخت: {payer?.name || 'نامشخص'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--hy-text)' }}>
                              {formatMoney(exp.amount)}
                            </span>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hy-expense)', fontSize: 12 }}
                              onClick={() => {
                                const updated = {
                                  ...selectedDongEvent,
                                  expenses: selectedDongEvent.expenses.filter((e) => e.id !== exp.id),
                                }
                                void saveDongEvent(updated)
                                notifyUser('خرج حذف شد')
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Settlement Calculator Box */}
                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(15, 118, 110, 0.2) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚖️</span>
                    <span>فرمول تسویه حساب نهایی (چه کسی به چه کسی بدهد؟)</span>
                  </h3>

                  {activeDongTransfers.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--hy-income)', margin: 0 }}>
                      🎉 تمام حساب‌ها برابر است و کسی به دیگری بدهکار نیست!
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {activeDongTransfers.map((tr, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                            <span style={{ fontWeight: 800, color: 'var(--hy-expense)' }}>{tr.fromName}</span>
                            <span style={{ opacity: 0.6 }}>باید بپردازد به</span>
                            <span style={{ fontWeight: 800, color: 'var(--hy-income)' }}>{tr.toName}</span>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--hy-accent)' }}>
                            {formatMoney(tr.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 14px', color: 'var(--hy-text-secondary)' }}>
                <span style={{ fontSize: 32 }}>👥</span>
                <p style={{ marginTop: 8 }}>یک رویداد را از ستون کنار انتخاب کنید تا ریز مخارج و نحوه تسویه را ببینید.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
