import { useState } from 'react'
import { categoriesFor } from '../lib/categories'
import { monthKey, monthlySeries, expenseByCategory, spentInCategory } from '../lib/reports'
import { todayIso } from '../lib/iso'
import { formatRial, parseRialInput } from '../lib/money'
import { createId } from '../lib/ids'
import { SettingsButton } from '../components/SettingsButton'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import type { CardMarket } from '../types'

const MARKETS: { id: CardMarket; label: string }[] = [
  { id: 'gold', label: 'طلا' },
  { id: 'stock', label: 'بورس' },
  { id: 'crypto', label: 'رمزارز' },
  { id: 'fund', label: 'صندوق' },
  { id: 'bank', label: 'سپرده' },
  { id: 'cash', label: 'نقد' },
]

export function ReportsPage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const { transactions, customCategories } = useStore()
  const { budgets, goals, saveBudget, deleteBudget, saveGoal, deleteGoal } = useExtras()
  const today = todayIso()
  const month = monthKey(today) ?? ''
  const series = monthlySeries(transactions, today)
  const bars = expenseByCategory(transactions, month, customCategories)
  const max = Math.max(1, ...series.flatMap((point) => [point.income, point.expense]))
  const catMax = Math.max(1, ...bars.map((bar) => bar.amount))
  const [limit, setLimit] = useState('')
  const [categoryId, setCategoryId] = useState(categoriesFor('expense', customCategories)[0]?.id ?? 'food')
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalMarket, setGoalMarket] = useState<CardMarket>('gold')

  return (
    <div className="app-scroll" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="top-row">
        <h1>گزارش</h1>
        <SettingsButton />
      </div>
      <div className="split-wide">
        <section className="lg report-card">
          <h2>شش ماه اخیر</h2>
          <svg className="chart" viewBox="0 0 320 140" role="img" aria-label="نمودار درآمد و هزینه">
            {series.map((point, index) => {
              const x = 18 + index * 50
              const incomeH = (point.income / max) * 90
              const expenseH = (point.expense / max) * 90
              return (
                <g key={point.label}>
                  <rect x={x} y={110 - incomeH} width="14" height={incomeH} rx="4" fill="#16A34A" />
                  <rect x={x + 16} y={110 - expenseH} width="14" height={expenseH} rx="4" fill="#DC2626" />
                  <text x={x + 14} y="128" textAnchor="middle" fontSize="10">{point.label}</text>
                </g>
              )
            })}
          </svg>
          <p className="sheet-sub">سبز درآمد · قرمز هزینه · ماه شمسی</p>
          {bars.map((bar) => (
            <div key={bar.id} className="cat-bar-row">
              <span className="name">{bar.name}</span>
              <span className="track"><span style={{ width: `${(bar.amount / catMax) * 100}%` }} /></span>
              <span className="amt">{formatRial(bar.amount)}</span>
            </div>
          ))}

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
              <div style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🏷️ هزینه‌ها بر اساس برچسب‌ها</h3>
                {tagList.slice(0, 5).map(([tagName, tagAmt]) => (
                  <div key={tagName} className="cat-bar-row">
                    <span className="name">#{tagName}</span>
                    <span className="track">
                      <span style={{ width: `${(tagAmt / maxTag) * 100}%`, background: 'var(--hy-accent)' }} />
                    </span>
                    <span className="amt">{formatRial(tagAmt)}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </section>
        <div>
          <section className="lg report-card">
            <h2>سقف بودجه</h2>
            <div className="field-stack">
              <select className="field-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="دسته بودجه">
                {categoriesFor('expense', customCategories).map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <input className="field-input" inputMode="numeric" placeholder="سقف ماهانه ریال" value={limit} onChange={(e) => setLimit(e.target.value)} />
              <button
                className="cta-confirm"
                type="button"
                onClick={() => {
                  const monthlyLimit = parseRialInput(limit)
                  if (!monthlyLimit) return
                  void saveBudget({ id: createId('bud'), categoryId, monthlyLimit })
                  setLimit('')
                }}
              >
                ثبت سقف
              </button>
            </div>
            {budgets.map((budget) => {
              const spent = spentInCategory(transactions, month, budget.categoryId)
              const name = categoriesFor('expense', customCategories).find((cat) => cat.id === budget.categoryId)?.name ?? 'دسته'
              const ratio = Math.min(100, Math.round((spent / budget.monthlyLimit) * 100))
              return (
                <div key={budget.id} className="goal-row">
                  <div className="plan-top">
                    <div>
                      <div className="plan-name">{name}</div>
                      <div className="plan-meta">{formatRial(spent)} از {formatRial(budget.monthlyLimit)}</div>
                    </div>
                    <button className="cat-mini danger" type="button" onClick={() => void deleteBudget(budget.id)}>حذف</button>
                  </div>
                  <div className={`progress-bar${ratio >= 100 ? ' overdue' : ''}`}><span style={{ width: `${ratio}%` }} /></div>
                </div>
              )
            })}
          </section>
          <section className="lg report-card">
            <h2>هدف پس‌انداز</h2>
            <div className="field-stack">
              <input className="field-input" placeholder="نام هدف" value={goalName} onChange={(e) => setGoalName(e.target.value)} />
              <input className="field-input" inputMode="numeric" placeholder="مبلغ هدف ریال" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
              <select className="field-input" value={goalMarket} onChange={(e) => setGoalMarket(e.target.value as CardMarket)} aria-label="بازار">
                {MARKETS.map((market) => <option key={market.id} value={market.id}>{market.label}</option>)}
              </select>
              <button
                className="cta-confirm"
                type="button"
                onClick={() => {
                  const target = parseRialInput(goalTarget)
                  if (!goalName.trim() || !target) return
                  void saveGoal({ name: goalName.trim(), target, saved: 0, market: goalMarket })
                  setGoalName('')
                  setGoalTarget('')
                }}
              >
                ساخت هدف
              </button>
            </div>
            {goals.map((goal) => {
              const ratio = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0
              const label = MARKETS.find((market) => market.id === goal.market)?.label ?? goal.market
              return (
                <div key={goal.id} className="goal-row">
                  <div className="plan-top">
                    <div>
                      <div className="plan-name">{goal.name}</div>
                      <div className="plan-meta">{label} · {formatRial(goal.saved)} از {formatRial(goal.target)}</div>
                    </div>
                    <button className="cat-mini danger" type="button" onClick={() => void deleteGoal(goal.id)}>حذف</button>
                  </div>
                  <div className="progress-bar"><span style={{ width: `${ratio}%` }} /></div>
                  <button
                    className="cat-mini"
                    type="button"
                    onClick={() => {
                      const add = Math.round(goal.target * 0.1)
                      void saveGoal({ ...goal, saved: Math.min(goal.target, goal.saved + add) })
                    }}
                  >
                    +۱۰٪ پس‌انداز
                  </button>
                </div>
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}
