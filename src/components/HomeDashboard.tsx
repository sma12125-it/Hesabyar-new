import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { JALALI_MONTHS, isoToJalali } from '../lib/jalaali'
import { expenseByCategory, lastJalaliMonths, monthKey, monthTotals, monthlySeries, spentInCategory } from '../lib/reports'
import { formatPersianDateFull, formatRelativeFromIso } from '../lib/dates'
import { homeInstallmentHints } from '../lib/installments'
import { todayIso, compareIso } from '../lib/iso'
import { toFaDigits } from '../lib/money'
import { txTitle, visibleLedger } from './TxRow'
import { useUiActions } from './UiActions'
import { useExtras } from '../store/Extras'
import { useSmsDrafts } from '../lib/sms/useSmsDrafts'
import { useStore } from '../store/Store'

function percent(part: number, whole: number) {
  if (whole <= 0) return 0
  return Math.max(0, Math.round((part / whole) * 100))
}

type CashflowPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'sixMonths' | 'yearly' | 'custom'

export function HomeDashboard({ onAll }: { onAll: () => void }) {
  const { transactions, accounts, plans, items, customCategories, activeAccounts } = useStore()
  const { budgets, formatMoney, formatCompactMoney, cheques, debts, currencyUnit, setCurrencyUnit } = useExtras()
  const [hideAmounts, setHideAmounts] = useState(true)
  const [showAllObligations, setShowAllObligations] = useState(false)
  const [cashflowPeriod, setCashflowPeriod] = useState<CashflowPeriod>('sixMonths')
  const [customStart, setCustomStart] = useState<number>(1)
  const actions = useUiActions()
  const navigate = useNavigate()
  const today = todayIso()
  const month = monthKey(today) ?? ''
  const jalali = isoToJalali(today)
  const [customEnd, setCustomEnd] = useState<number>(() => jalali?.jm ?? 6)

  const cashAccounts = useMemo(
    () => activeAccounts.filter((a) => (a.classification ?? 'cash') === 'cash'),
    [activeAccounts],
  )
  const creditAccounts = useMemo(
    () => activeAccounts.filter((a) => a.classification === 'credit'),
    [activeAccounts],
  )
  const investmentAccounts = useMemo(
    () => activeAccounts.filter((a) => a.classification === 'investment'),
    [activeAccounts],
  )

  const cashBalance = useMemo(() => cashAccounts.reduce((sum, a) => sum + a.balance, 0), [cashAccounts])
  const creditBalance = useMemo(() => creditAccounts.reduce((sum, a) => sum + a.balance, 0), [creditAccounts])
  const investmentBalance = useMemo(
    () => investmentAccounts.reduce((sum, a) => sum + a.balance, 0),
    [investmentAccounts],
  )

  const totals = monthTotals(transactions, month)
  const baseMonthlySeries = monthlySeries(transactions, today).map((point) => ({
    ...point,
    label: JALALI_MONTHS[Number(point.label) - 1] ?? point.label,
  }))

  const activeSeries = useMemo(() => {
    if (cashflowPeriod === 'daily') {
      const days: Array<{ label: string; income: number; expense: number }> = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const iso = d.toISOString().slice(0, 10)
        const j = isoToJalali(iso)
        let income = 0
        let expense = 0
        for (const tx of transactions) {
          if (tx.date === iso) {
            if (tx.kind === 'income') income += tx.amount
            if (tx.kind === 'expense') expense += tx.amount
          }
        }
        days.push({
          label: j ? `${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]?.slice(0, 3)}` : iso.slice(5),
          income,
          expense,
        })
      }
      return days
    }

    if (cashflowPeriod === 'weekly') {
      const weeks: Array<{ label: string; income: number; expense: number }> = []
      for (let i = 3; i >= 0; i--) {
        const dEnd = new Date()
        dEnd.setDate(dEnd.getDate() - i * 7)
        const dStart = new Date(dEnd)
        dStart.setDate(dStart.getDate() - 6)
        const isoStart = dStart.toISOString().slice(0, 10)
        const isoEnd = dEnd.toISOString().slice(0, 10)
        let income = 0
        let expense = 0
        for (const tx of transactions) {
          if (tx.date >= isoStart && tx.date <= isoEnd) {
            if (tx.kind === 'income') income += tx.amount
            if (tx.kind === 'expense') expense += tx.amount
          }
        }
        weeks.push({
          label: `هفته ${toFaDigits(4 - i)}`,
          income,
          expense,
        })
      }
      return weeks
    }

    if (cashflowPeriod === 'monthly') {
      const keys = lastJalaliMonths(today, 3)
      return keys.map((key) => {
        let income = 0
        let expense = 0
        for (const tx of transactions) {
          if (monthKey(tx.date) === key) {
            if (tx.kind === 'income') income += tx.amount
            if (tx.kind === 'expense') expense += tx.amount
          }
        }
        const [, m] = key.split('-')
        const monthNum = Number(m)
        return {
          label: JALALI_MONTHS[monthNum - 1] ?? key,
          income,
          expense,
        }
      })
    }

    if (cashflowPeriod === 'quarterly') {
      const keys = lastJalaliMonths(today, 4)
      return keys.map((key) => {
        let income = 0
        let expense = 0
        for (const tx of transactions) {
          if (monthKey(tx.date) === key) {
            if (tx.kind === 'income') income += tx.amount
            if (tx.kind === 'expense') expense += tx.amount
          }
        }
        const [, m] = key.split('-')
        const monthNum = Number(m)
        return {
          label: JALALI_MONTHS[monthNum - 1] ?? key,
          income,
          expense,
        }
      })
    }

    if (cashflowPeriod === 'yearly') {
      const keys = lastJalaliMonths(today, 12)
      return keys.map((key) => {
        let income = 0
        let expense = 0
        for (const tx of transactions) {
          if (monthKey(tx.date) === key) {
            if (tx.kind === 'income') income += tx.amount
            if (tx.kind === 'expense') expense += tx.amount
          }
        }
        const [, m] = key.split('-')
        const monthNum = Number(m)
        return {
          label: JALALI_MONTHS[monthNum - 1]?.slice(0, 3) ?? key,
          income,
          expense,
        }
      })
    }

    if (cashflowPeriod === 'custom') {
      const curYear = jalali ? jalali.jy : 1403
      const s = Math.min(customStart, customEnd)
      const e = Math.max(customStart, customEnd)
      const list: Array<{ label: string; income: number; expense: number }> = []
      for (let m = s; m <= e; m++) {
        const key = `${curYear}-${String(m).padStart(2, '0')}`
        let income = 0
        let expense = 0
        for (const tx of transactions) {
          if (monthKey(tx.date) === key) {
            if (tx.kind === 'income') income += tx.amount
            if (tx.kind === 'expense') expense += tx.amount
          }
        }
        list.push({
          label: JALALI_MONTHS[m - 1] ?? String(m),
          income,
          expense,
        })
      }
      return list.length > 0 ? list : baseMonthlySeries
    }

    return baseMonthlySeries
  }, [cashflowPeriod, customStart, customEnd, transactions, today, jalali, baseMonthlySeries])

  const bars = expenseByCategory(transactions, month, customCategories).slice(0, 5)
  const catMax = Math.max(1, ...bars.map((bar) => bar.amount))
  const incomeCount = transactions.filter((tx) => tx.kind === 'income' && monthKey(tx.date) === month).length
  const expenseShare = percent(totals.expense, totals.income)
  const budgetLimit = budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0)
  const budgetSpent = budgets.reduce((sum, budget) => sum + spentInCategory(transactions, month, budget.categoryId), 0)
  const usingBudget = budgetLimit > 0
  const ringSpent = usingBudget ? budgetSpent : totals.expense
  const ringLimit = usingBudget ? budgetLimit : totals.income
  const ringRatio = Math.min(100, percent(ringSpent, ringLimit))
  const ringLeft = Math.max(ringLimit - ringSpent, 0)
  const hints = homeInstallmentHints(plans, items, today)

  const obligations = useMemo(() => {
    const list: Array<{
      id: string
      title: string
      subtitle: string
      amount: number
      dueDate: string
      isOverdue: boolean
      badge: string
      badgeClass: string
    }> = []

    for (const hint of hints) {
      list.push({
        id: `hint-${hint.plan.id}-${hint.item.id}`,
        title: `قسط ${hint.plan.name}`,
        subtitle: `موعد قسط: ${formatPersianDateFull(hint.item.dueDate)}`,
        amount: hint.plan.installmentAmount,
        dueDate: hint.item.dueDate,
        isOverdue: hint.kind === 'overdue',
        badge: hint.kind === 'overdue' ? 'معوق' : 'نزدیک',
        badgeClass: hint.kind === 'overdue' ? 'overdue' : 'pending',
      })
    }

    for (const c of cheques.filter((c) => c.status === 'pending')) {
      const isOverdue = compareIso(c.dueDate, today) < 0
      list.push({
        id: `cheque-${c.id}`,
        title: `چک ${c.bankName} (${c.direction === 'payable' ? 'صادره / پرداختی' : 'دریافتی'})`,
        subtitle: `طرف‌حساب: ${c.party || 'نامشخص'} · سررسید ${formatPersianDateFull(c.dueDate)}`,
        amount: c.amount,
        dueDate: c.dueDate,
        isOverdue,
        badge: isOverdue ? 'سررسید گذشته' : 'در جریان وصول',
        badgeClass: isOverdue ? 'overdue' : 'pending',
      })
    }

    for (const d of debts.filter((d) => d.status === 'active')) {
      const isOverdue = Boolean(d.dueDate && compareIso(d.dueDate, today) < 0)
      list.push({
        id: `debt-${d.id}`,
        title: `${d.direction === 'borrowed' ? 'بدهی من به' : 'طلب من از'} ${d.party}`,
        subtitle: d.dueDate ? `سررسید: ${formatPersianDateFull(d.dueDate)}` : 'بدون تاریخ سررسید',
        amount: d.amount,
        dueDate: d.dueDate || '9999',
        isOverdue,
        badge: d.direction === 'borrowed' ? 'بدهی' : 'طلب',
        badgeClass: d.direction === 'borrowed' ? 'overdue' : 'ok',
      })
    }

    return list.sort((a, b) => compareIso(a.dueDate, b.dueDate))
  }, [hints, cheques, debts, today])

  const { pending } = useSmsDrafts()
  const recent = visibleLedger(transactions).slice(0, 4)
  const chartMax = Math.max(1, ...activeSeries.flatMap((point) => [point.income, point.expense]))

  const displayMoney = (amt: number) => (hideAmounts ? '••••••' : formatCompactMoney(amt))

  return (
    <div className="home-board">
      {/* Privacy & Currency Controls Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
        <button
          type="button"
          className="cat-mini"
          onClick={() => setHideAmounts((v) => !v)}
          title="حفظ حریم خصوصی"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
        >
          <span>{hideAmounts ? '👁️' : '🙈'}</span>
          <span>{hideAmounts ? 'نمایش مبالغ' : 'مخفی‌سازی'}</span>
        </button>

        <div style={{ display: 'inline-flex', gap: 4 }}>
          <button
            type="button"
            className={`cat-mini${currencyUnit === 'IRT' ? ' active' : ''}`}
            onClick={() => void setCurrencyUnit('IRT')}
          >
            تومان
          </button>
          <button
            type="button"
            className={`cat-mini${currencyUnit === 'IRR' ? ' active' : ''}`}
            onClick={() => void setCurrencyUnit('IRR')}
          >
            ریال
          </button>
        </div>
      </div>

      {/* Classic 4-KPI Glass Grid */}
      <div className="home-kpis">
        <div className="home-kpi lg">
          <span>💵 نقدینگی در دسترس</span>
          <strong>{displayMoney(cashBalance)}</strong>
          <small>{toFaDigits(cashAccounts.length)} حساب بانکی و نقدی</small>
        </div>

        <div className="home-kpi lg">
          <span>💳 اعتبار خرید</span>
          <strong style={{ color: 'var(--hy-transfer)' }}>{displayMoney(creditBalance)}</strong>
          <small>{toFaDigits(creditAccounts.length)} حساب اعتباری</small>
        </div>

        <div className="home-kpi lg">
          <span>📈 پس‌انداز و سرمایه</span>
          <strong style={{ color: 'var(--hy-violet)' }}>{displayMoney(investmentBalance)}</strong>
          <small>{toFaDigits(investmentAccounts.length)} صندوق / سپرده</small>
        </div>

        <div className="home-kpi lg">
          <span>📊 درآمد و هزینه این ماه</span>
          <strong className={totals.net >= 0 ? 'up' : 'down'}>{displayMoney(totals.net)}</strong>
          <small className={totals.net >= 0 ? 'up' : 'down'}>
            {incomeCount === 0 && totals.expense === 0
              ? 'بدون تراکنش در این ماه'
              : totals.income > 0
                ? `${toFaDigits(expenseShare)}٪ مصرف درآمد`
                : `هزینه ${displayMoney(totals.expense)}`}
          </small>
        </div>
      </div>

      {/* Classic Monthly Insight Card */}
      <section className="home-card lg home-insight">
        <header>
          <div>
            <h2>💡 تحلیل سریع وضعیت</h2>
            <p>
              درآمد ماه: {displayMoney(totals.income)} · هزینه ماه: {displayMoney(totals.expense)}
            </p>
          </div>
        </header>
        <p>{insightText(baseMonthlySeries, totals.income, totals.expense, totals.net, formatCompactMoney)}</p>
      </section>

      {/* Upcoming Obligations */}
      {obligations.length > 0 ? (
        <section className="home-card lg">
          <header>
            <div>
              <h2>⏳ تعهدات مالی پیش رو ({toFaDigits(obligations.length)})</h2>
              <p>اقساط نزدیک، چک‌های در جریان و بدهی‌ها</p>
            </div>
            <button
              className="home-chip"
              type="button"
              onClick={() => navigate('/installments')}
            >
              مدیریت همه
            </button>
          </header>

          <div className="home-dues">
            {(showAllObligations ? obligations : obligations.slice(0, 3)).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate('/installments')}
              >
                <span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <strong>{item.title}</strong>
                    <span className={`badge ${item.badgeClass}`} style={{ fontSize: 10 }}>
                      {item.badge}
                    </span>
                  </span>
                  <small>{item.subtitle}</small>
                </span>
                <b style={{ color: item.isOverdue ? 'var(--hy-expense)' : 'var(--hy-text)' }}>
                  {displayMoney(item.amount)}
                </b>
              </button>
            ))}
          </div>

          {obligations.length > 3 ? (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                type="button"
                className="cat-mini"
                onClick={() => setShowAllObligations((v) => !v)}
              >
                {showAllObligations ? '▲ نمایش کمتر' : `▼ مشاهده همه (${toFaDigits(obligations.length)} مورد)`}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <Link to="/transactions/pending" className="home-card lg sms-pending-link">
        <div>
          <h2>📩 تراکنش‌های در انتظار تأیید</h2>
          <p>{pending.length === 0 ? 'مورد جدیدی نیست' : `${toFaDigits(pending.length)} تراکنش منتظر تأیید`}</p>
        </div>
        <span className="home-chip">مشاهده</span>
      </Link>

      <div className="home-split">
        <section className="home-card lg">
          <header style={{ flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
            <div>
              <h2>جریان نقدی</h2>
              <p>درآمد و هزینه بر اساس دوره انتخابی</p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(
                [
                  { id: 'daily', label: 'روزانه' },
                  { id: 'weekly', label: 'هفتگی' },
                  { id: 'monthly', label: 'ماهانه' },
                  { id: 'quarterly', label: '۳ ماه' },
                  { id: 'sixMonths', label: '۶ ماه' },
                  { id: 'yearly', label: 'سالانه' },
                  { id: 'custom', label: 'بازه دستی' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`cat-mini${cashflowPeriod === p.id ? ' active' : ''}`}
                  onClick={() => setCashflowPeriod(p.id)}
                  style={{ fontSize: 11 }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </header>

          {cashflowPeriod === 'custom' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0', fontSize: 11 }}>
              <span>از ماه:</span>
              <select
                className="cat-mini"
                value={customStart}
                onChange={(e) => setCustomStart(Number(e.target.value))}
                style={{ fontSize: 11, padding: '3px 6px' }}
              >
                {JALALI_MONTHS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <span>تا ماه:</span>
              <select
                className="cat-mini"
                value={customEnd}
                onChange={(e) => setCustomEnd(Number(e.target.value))}
                style={{ fontSize: 11, padding: '3px 6px' }}
              >
                {JALALI_MONTHS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <CashflowChart series={activeSeries} max={chartMax} />
          <div className="home-legend">
            <span><i className="dot income" />درآمد</span>
            <span><i className="dot expense" />هزینه</span>
          </div>
        </section>

        <section className="home-card lg">
          <header>
            <div>
              <h2>وضعیت بودجه</h2>
              <p>{usingBudget ? 'تا پایان این ماه' : 'سهم هزینه از درآمد ماه'}</p>
            </div>
          </header>
          <div className="home-donut-wrap">
            <Donut ratio={ringRatio} />
            <p>{usingBudget ? 'مصرف بودجه' : totals.income > 0 ? 'مصرف از درآمد' : 'بودجه‌ای تعیین نشده'}</p>
          </div>
          <div className="home-budget-lines">
            <div>
              <span>{usingBudget ? 'بودجه ماهانه' : 'درآمد ماه'}</span>
              <strong>{formatCompactMoney(ringLimit)}</strong>
            </div>
            <div>
              <span>باقی‌مانده</span>
              <strong>{formatCompactMoney(ringLeft)}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="home-split even">
        <section className="home-card lg">
          <header>
            <div>
              <h2>ترکیب هزینه‌ها</h2>
              <p>{jalali ? JALALI_MONTHS[jalali.jm - 1] : 'این ماه'}</p>
            </div>
          </header>
          {bars.length === 0 ? (
            <p className="sheet-sub">هزینه‌ای در این ماه ثبت نشده.</p>
          ) : (
            <div className="home-cats">
              {bars.map((bar) => (
                <div key={bar.id} className="home-cat">
                  <span>{bar.name}</span>
                  <span className="track"><span style={{ width: `${(bar.amount / catMax) * 100}%` }} /></span>
                  <strong>{formatCompactMoney(bar.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="home-card lg">
          <header>
            <div>
              <h2>آخرین تراکنش‌ها</h2>
            </div>
            {recent.length > 0 ? (
              <button className="home-chip" type="button" onClick={onAll}>همه</button>
            ) : null}
          </header>
          {recent.length === 0 ? (
            <p className="sheet-sub">با دکمه هزینه یا درآمد، اولین تراکنش را ثبت کنید.</p>
          ) : (
            <div className="home-txs">
              {recent.map((tx) => {
                const positive = tx.kind === 'income' || tx.kind === 'transferIn'
                return (
                  <button key={tx.id} type="button" onClick={() => actions?.editTransaction(tx.id)}>
                    <span>
                      <strong>{txTitle(tx, accounts, customCategories)}</strong>
                      <small>
                        {formatRelativeFromIso(tx.date)}
                        {tx.source === 'sms' ? ' · پیامک' : ''}
                      </small>
                    </span>
                    <b className={positive ? 'up' : 'down'}>
                      {positive ? '+' : '−'}
                      {formatMoney(tx.amount)}
                    </b>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function insightText(
  series: Array<{ income: number; expense: number }>,
  income: number,
  expense: number,
  net: number,
  formatCompact: (amount: number) => string,
) {
  if (series.every((point) => point.income === 0 && point.expense === 0)) {
    return 'با ثبت چند درآمد و هزینه، اینجا جمع‌بندی وضع حساب را می‌بینید.'
  }
  const prev = series[series.length - 2]
  const curr = series[series.length - 1]
  if (prev && curr && prev.expense > 0 && curr.expense > prev.expense) {
    const rise = Math.round(((curr.expense - prev.expense) / prev.expense) * 100)
    return `هزینه این ماه ${toFaDigits(rise)}٪ بیشتر از ماه قبل است. اگر همین روند بماند، تا پایان ماه فشار روی موجودی بیشتر می‌شود.`
  }
  if (net > 0 && income > 0) {
    return `این ماه ${formatCompact(net)} از هزینه جلو هستید. این مازاد می‌تواند به پس‌انداز یا قسط‌های نزدیک برسد.`
  }
  if (expense > income) {
    return 'هزینه این ماه از درآمد بیشتر شده است. دسته‌های بزرگ‌تر را در ترکیب هزینه‌ها ببینید تا موجودی حفظ شود.'
  }
  return 'درآمد و هزینه این ماه نزدیک هم‌اند. ثبت منظم، تصویر ماه بعد را دقیق‌تر می‌کند.'
}

function CashflowChart({
  series,
  max,
}: {
  series: Array<{ label: string; income: number; expense: number }>
  max: number
}) {
  const width = Math.max(320, series.length * 48)
  const height = 150
  const padX = 22
  const top = 16
  const base = 112
  const step = series.length > 1 ? (width - padX * 2) / (series.length - 1) : 0
  const xAt = (index: number) => padX + (series.length - 1 - index) * step
  const yAt = (value: number) => base - (value / max) * (base - top)
  const path = (key: 'income' | 'expense') =>
    series.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(point[key])}`).join(' ')

  return (
    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <svg
        className="home-chart"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: width, height: 150, display: 'block' }}
        role="img"
        aria-label="نمودار جریان نقدی"
      >
        {[0, 1, 2].map((line) => (
          <line key={line} x1={padX} x2={width - padX} y1={top + line * 32} y2={top + line * 32} className="grid" />
        ))}
        <path d={path('income')} className="line income" />
        <path d={path('expense')} className="line expense" />
        {series.map((point, index) => (
          <g key={index}>
            <circle cx={xAt(index)} cy={yAt(point.income)} r="3.2" className="point income" />
            <circle cx={xAt(index)} cy={yAt(point.expense)} r="3.2" className="point expense" />
            <text x={xAt(index)} y="136" textAnchor="middle" fontSize="10">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function Donut({ ratio }: { ratio: number }) {
  const r = 42
  const c = 2 * Math.PI * r
  const filled = (Math.min(100, Math.max(0, ratio)) / 100) * c
  return (
    <svg className="home-donut" viewBox="0 0 120 120" role="img" aria-label={`${toFaDigits(ratio)} درصد`}>
      <circle cx="60" cy="60" r={r} className="track" />
      <circle
        cx="60"
        cy="60"
        r={r}
        className="value"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="66" textAnchor="middle">{toFaDigits(ratio)}٪</text>
    </svg>
  )
}
