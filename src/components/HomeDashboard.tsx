import { Link, useNavigate } from 'react-router-dom'
import { JALALI_MONTHS, isoToJalali } from '../lib/jalaali'
import { expenseByCategory, monthKey, monthTotals, monthlySeries, spentInCategory } from '../lib/reports'
import { formatPersianDate, formatRelativeFromIso } from '../lib/dates'
import { homeInstallmentHints } from '../lib/installments'
import { todayIso } from '../lib/iso'
import { formatCompactRial, formatRial, toFaDigits } from '../lib/money'
import { txTitle, visibleLedger } from './TxRow'
import { useUiActions } from './UiActions'
import { useExtras } from '../store/Extras'
import { useSmsDrafts } from '../lib/sms/useSmsDrafts'
import { useStore } from '../store/Store'

function faNumber(value: number) {
  const rounded = Math.round(Math.abs(value) * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return toFaDigits(text).replace('.', '\u066b')
}

function percent(part: number, whole: number) {
  if (whole <= 0) return 0
  return Math.max(0, Math.round((part / whole) * 100))
}

export function HomeDashboard({ onAll }: { onAll: () => void }) {
  const { transactions, accounts, plans, items, customCategories, totalBalance, activeAccounts } = useStore()
  const { budgets, goals } = useExtras()
  const actions = useUiActions()
  const navigate = useNavigate()
  const today = todayIso()
  const month = monthKey(today) ?? ''
  const jalali = isoToJalali(today)
  const totals = monthTotals(transactions, month)
  const series = monthlySeries(transactions, today).map((point) => ({
    ...point,
    label: JALALI_MONTHS[Number(point.label) - 1] ?? point.label,
  }))
  const bars = expenseByCategory(transactions, month, customCategories).slice(0, 5)
  const catMax = Math.max(1, ...bars.map((bar) => bar.amount))
  const incomeCount = transactions.filter((tx) => tx.kind === 'income' && monthKey(tx.date) === month).length
  const expenseShare = percent(totals.expense, totals.income)
  const previousBalance = totalBalance - totals.net
  const balanceDelta = previousBalance !== 0 ? Math.round((totals.net / Math.abs(previousBalance)) * 1000) / 10 : null
  const saved = goals.reduce((sum, goal) => sum + goal.saved, 0)
  const goalTarget = goals.reduce((sum, goal) => sum + goal.target, 0)
  const savingsAmount = goals.length > 0 ? saved : Math.max(totals.net, 0)
  const savingsRate = goals.length > 0 ? percent(saved, goalTarget) : percent(Math.max(totals.net, 0), totals.income)
  const budgetLimit = budgets.reduce((sum, budget) => sum + budget.monthlyLimit, 0)
  const budgetSpent = budgets.reduce((sum, budget) => sum + spentInCategory(transactions, month, budget.categoryId), 0)
  const usingBudget = budgetLimit > 0
  const ringSpent = usingBudget ? budgetSpent : totals.expense
  const ringLimit = usingBudget ? budgetLimit : totals.income
  const ringRatio = Math.min(100, percent(ringSpent, ringLimit))
  const ringLeft = Math.max(ringLimit - ringSpent, 0)
  const hints = homeInstallmentHints(plans, items, today).slice(0, 4)
  const { pending } = useSmsDrafts()
  const recent = visibleLedger(transactions).slice(0, 4)
  const chartMax = Math.max(1, ...series.flatMap((point) => [point.income, point.expense]))

  return (
    <div className="home-board">
      <div className="home-kpis">
        <article className="home-kpi lg">
          <span>موجودی کل</span>
          <strong>{formatCompactRial(totalBalance)}</strong>
          <small className={balanceDelta != null && balanceDelta >= 0 ? 'up' : 'down'}>
            {balanceDelta == null
              ? `${toFaDigits(activeAccounts.length)} حساب فعال`
              : `${balanceDelta > 0 ? '+' : ''}${faNumber(balanceDelta)}٪ ماه قبل`}
          </small>
        </article>
        <article className="home-kpi lg">
          <span>درآمد این ماه</span>
          <strong className="up">{formatCompactRial(totals.income)}</strong>
          <small>{incomeCount === 0 ? 'دریافتی ثبت نشده' : `${toFaDigits(incomeCount)} دریافت`}</small>
        </article>
        <article className="home-kpi lg">
          <span>هزینه این ماه</span>
          <strong className="down">{formatCompactRial(totals.expense)}</strong>
          <small>{totals.income > 0 ? `${toFaDigits(expenseShare)}٪ از درآمد` : 'هنوز درآمدی ثبت نشده'}</small>
        </article>
        <article className="home-kpi lg">
          <span>پس‌انداز</span>
          <strong>{formatCompactRial(savingsAmount)}</strong>
          <small>نرخ {toFaDigits(savingsRate)}٪</small>
        </article>
      </div>

      <Link to="/transactions/pending" className="home-card lg sms-pending-link">
        <div>
          <h2>تراکنش‌های در انتظار تأیید</h2>
          <p>{pending.length === 0 ? 'مورد جدیدی نیست' : `${toFaDigits(pending.length)} تراکنش منتظر تأیید`}</p>
        </div>
        <span className="home-chip">مشاهده</span>
      </Link>

      <div className="home-split">
        <section className="home-card lg">
          <header>
            <div>
              <h2>جریان نقدی</h2>
              <p>درآمد و هزینه در ۶ ماه اخیر</p>
            </div>
            <span className="home-chip">۶ ماه</span>
          </header>
          <CashflowChart series={series} max={chartMax} />
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
              <strong>{formatCompactRial(ringLimit)}</strong>
            </div>
            <div>
              <span>باقی‌مانده</span>
              <strong>{formatCompactRial(ringLeft)}</strong>
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
                  <strong>{formatCompactRial(bar.amount)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="home-card lg">
          <header>
            <div>
              <h2>تعهدات پیش‌رو</h2>
              <p>اقساط نزدیک و معوق</p>
            </div>
            <button className="home-chip" type="button" onClick={() => navigate('/installments')}>
              {toFaDigits(hints.length)} مورد
            </button>
          </header>
          {hints.length === 0 ? (
            <p className="sheet-sub">قسط نزدیکی در لیست فعال نیست.</p>
          ) : (
            <div className="home-dues">
              {hints.map(({ plan, item, kind }) => (
                <button key={item.id} type="button" onClick={() => navigate(`/installments/${plan.id}`)}>
                  <span>
                    <strong>{plan.name}</strong>
                    <small>{kind === 'overdue' ? 'معوق' : 'به‌زودی'}</small>
                  </span>
                  <em>{formatPersianDate(item.dueDate)}</em>
                  <b>{formatCompactRial(item.amount)}</b>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="home-split even">
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
                      {formatRial(tx.amount)}
                    </b>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="home-card lg home-insight">
          <header>
            <div>
              <h2>بینش مالی</h2>
            </div>
          </header>
          <p>{insightText(series, totals.income, totals.expense, totals.net)}</p>
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
    return `این ماه ${formatCompactRial(net)} ریال از هزینه جلو هستید. این مازاد می‌تواند به پس‌انداز یا قسط‌های نزدیک برسد.`
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
  const width = 320
  const height = 150
  const padX = 16
  const top = 16
  const base = 112
  const step = series.length > 1 ? (width - padX * 2) / (series.length - 1) : 0
  const xAt = (index: number) => padX + (series.length - 1 - index) * step
  const yAt = (value: number) => base - (value / max) * (base - top)
  const path = (key: 'income' | 'expense') =>
    series.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(point[key])}`).join(' ')

  return (
    <svg className="home-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="نمودار درآمد و هزینه شش ماه">
      {[0, 1, 2].map((line) => (
        <line key={line} x1={padX} x2={width - padX} y1={top + line * 32} y2={top + line * 32} className="grid" />
      ))}
      <path d={path('income')} className="line income" />
      <path d={path('expense')} className="line expense" />
      {series.map((point, index) => (
        <g key={point.label}>
          <circle cx={xAt(index)} cy={yAt(point.income)} r="3.2" className="point income" />
          <circle cx={xAt(index)} cy={yAt(point.expense)} r="3.2" className="point expense" />
          <text x={xAt(index)} y="136" textAnchor="middle">{point.label}</text>
        </g>
      ))}
    </svg>
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
