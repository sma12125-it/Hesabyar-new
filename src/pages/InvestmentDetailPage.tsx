import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DateField } from '../components/DateField'
import { SettingsButton } from '../components/SettingsButton'
import { formatPersianDateFull } from '../lib/dates'
import { todayIso } from '../lib/iso'
import {
  COST_BASIS_METHOD_FA,
  COST_BASIS_NOTE_FA,
  KIND_LABEL,
  defaultKindForMarket,
  explainLedger,
  formatQuantity,
  isInflowKind,
  kindsForMarket,
  parseQuantity,
  snapshotAsset,
} from '../lib/investments'
import { digitsOnly, formatSeparatedNumber, toFaDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useExtras } from '../store/Extras'
import type { InvestmentMarket, InvestmentTransaction, InvestmentTxKind } from '../types'

const MARKET_LABEL: Record<string, string> = {
  gold: 'طلا و سکه',
  stock: 'بورس و سهام',
  fund: 'صندوق سرمایه‌گذاری',
  crypto: 'ارز دیجیتال',
  property: 'ملک و مسکن',
  bank: 'سپرده بلندمدت',
  other: 'سایر',
}

function toRials(raw: string, unit: 'IRT' | 'IRR'): number {
  const amount = Number(digitsOnly(raw))
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return unit === 'IRT' ? amount * 10 : amount
}

function fromRials(rials: number, unit: 'IRT' | 'IRR'): string {
  if (!(rials > 0)) return ''
  const display = unit === 'IRT' ? Math.round(rials / 10) : Math.round(rials)
  return formatSeparatedNumber(display)
}

export function InvestmentDetailPage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    investments,
    currencyUnit,
    unitLabel,
    formatMoney,
    saveInvestment,
    saveInvestmentTransaction,
    deleteInvestmentTransaction,
  } = useExtras()
  const asset = investments.find((item) => item.id === id)
  const [priceText, setPriceText] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [kind, setKind] = useState<InvestmentTxKind>('buy')
  const [qtyText, setQtyText] = useState('')
  const [tradePrice, setTradePrice] = useState('')
  const [tradeDate, setTradeDate] = useState(todayIso())
  const [tradeNote, setTradeNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const snap = useMemo(() => (asset ? snapshotAsset(asset) : null), [asset])
  const history = useMemo(() => (snap ? snap.rows.slice().reverse() : []), [snap])
  const editingTx = asset?.transactions?.find((tx) => tx.id === editingId)

  const preview = useMemo(() => {
    if (!asset || !formOpen) return null
    const quantity = parseQuantity(qtyText)
    const unitPrice = toRials(tradePrice, currencyUnit)
    if (!(quantity > 0) || !(unitPrice > 0)) return null
    const draft: InvestmentTransaction = {
      id: editingId || 'draft',
      assetId: asset.id,
      kind,
      quantity,
      unitPrice,
      date: tradeDate,
      note: tradeNote.trim() || undefined,
      createdAt: editingTx?.createdAt ?? Date.now(),
    }
    const others = (asset.transactions ?? []).filter((tx) => tx.id !== editingId)
    try {
      const rows = explainLedger([...others, draft])
      const row = rows.find((item) => item.tx.id === draft.id)
      const last = rows[rows.length - 1]
      return {
        error: null as string | null,
        quantity: last?.runningQuantity ?? 0,
        realized: row?.realizedProfit ?? null,
        average: last?.averageCostAfter ?? 0,
      }
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'معامله معتبر نیست',
        quantity: 0,
        realized: null,
        average: 0,
      }
    }
  }, [asset, currencyUnit, editingId, editingTx?.createdAt, formOpen, kind, qtyText, tradeDate, tradeNote, tradePrice])

  if (!asset || !snap) {
    return (
      <div className="app-scroll">
        <div className="empty-state lg">
          <h2>دارایی پیدا نشد</h2>
          <button className="cta-confirm" type="button" onClick={() => navigate('/reports?tab=investments')}>
            بازگشت به سرمایه‌گذاری
          </button>
        </div>
      </div>
    )
  }

  const marketLabel = MARKET_LABEL[asset.market] ?? asset.market
  const priceField = priceText ?? fromRials(asset.currentUnitPrice ?? 0, currencyUnit)
  const unrealized = snap.unrealizedProfit
  const kinds = kindsForMarket(asset.market as InvestmentMarket)
  const kindChoices = kinds.includes(kind) ? kinds : [kind, ...kinds]

  function openCreate() {
    setEditingId(null)
    setKind(defaultKindForMarket(asset!.market))
    setQtyText('')
    setTradePrice('')
    setTradeDate(todayIso())
    setTradeNote('')
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(tx: InvestmentTransaction) {
    setEditingId(tx.id)
    setKind(tx.kind)
    setQtyText(String(tx.quantity))
    setTradePrice(fromRials(tx.unitPrice, currencyUnit))
    setTradeDate(tx.date)
    setTradeNote(tx.note ?? '')
    setFormError(null)
    setFormOpen(true)
  }

  async function savePrice() {
    const unitPrice = toRials(priceField, currencyUnit)
    if (!(unitPrice > 0)) {
      notifyUser('قیمت روز هر واحد را وارد کنید')
      return
    }
    await saveInvestment({ ...asset!, currentUnitPrice: unitPrice })
    setPriceText(null)
    notifyUser('قیمت روز ذخیره شد')
  }

  async function saveTrade() {
    const quantity = parseQuantity(qtyText)
    const unitPrice = toRials(tradePrice, currencyUnit)
    if (!(quantity > 0)) {
      setFormError('تعداد واحد باید بیشتر از صفر باشد')
      return
    }
    if (!(unitPrice > 0)) {
      setFormError('قیمت هر واحد باید بیشتر از صفر باشد')
      return
    }
    if (preview?.error) {
      setFormError(preview.error)
      return
    }
    try {
      await saveInvestmentTransaction(asset!.id, {
        id: editingId || undefined,
        kind,
        quantity,
        unitPrice,
        date: tradeDate,
        note: tradeNote.trim() || undefined,
        createdAt: editingTx?.createdAt,
      })
      setFormOpen(false)
      notifyUser(editingId ? 'معامله ویرایش شد' : 'معامله ثبت شد')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'ثبت معامله ممکن نشد')
    }
  }

  async function removeTrade(txId: string) {
    try {
      await deleteInvestmentTransaction(asset!.id, txId)
      setPendingDelete(null)
      if (editingId === txId) setFormOpen(false)
      notifyUser('معامله حذف شد')
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'حذف معامله ممکن نشد')
    }
  }

  return (
    <div className="app-scroll" onScroll={(event) => onScroll(event.currentTarget.scrollTop > 28)}>
      <div className="detail-top">
        <button className="back-btn" type="button" onClick={() => navigate('/reports?tab=investments')} aria-label="بازگشت">
          ›
        </button>
        <h1>{asset.name}</h1>
        <SettingsButton />
      </div>

      <div className="inv-page">
        <section className="home-card lg inv-note">
          <div className="inv-title-row">
            <strong>{marketLabel}</strong>
            {asset.symbol ? <span className="badge">نماد: {asset.symbol}</span> : null}
            <span className="badge">روش بها: {COST_BASIS_METHOD_FA}</span>
          </div>
          <p>{COST_BASIS_NOTE_FA}</p>
          {asset.note ? <p>{asset.note}</p> : null}
        </section>

        <section className="inv-summary" aria-label="خلاصه دارایی">
          <Stat label="تعداد مانده" value={formatQuantity(snap.quantity)} />
          <Stat label="میانگین بهای هر واحد" value={snap.quantity > 0 ? formatMoney(snap.averageCost) : '—'} />
          <Stat label="مبلغ سرمایه‌گذاری" value={formatMoney(snap.investedAmount)} hint="بهای تمام‌شده مانده" />
          <Stat label="ارزش روز" value={formatMoney(snap.currentValue)} />
          <Stat
            label="سود و زیان تحقق‌یافته"
            value={signed(formatMoney, snap.realizedProfit)}
            tone={toneOf(snap.realizedProfit)}
            hint="از فروش و ابطال"
          />
          <Stat
            label="سود و زیان تحقق‌نیافته"
            value={unrealized == null ? 'قیمت روز ندارد' : signed(formatMoney, unrealized)}
            tone={unrealized == null ? undefined : toneOf(unrealized)}
            hint="روی تعداد مانده"
          />
        </section>

        <section className="home-card lg inv-block">
          <h2>قیمت روز هر واحد</h2>
          <p className="inv-meta">این قیمت معامله نیست. سود تحقق‌نیافته تعداد مانده با همین قیمت حساب می‌شود و هر زمان قابل تغییر است.</p>
          <div className="inv-price-row">
            <input
              className="field-input"
              inputMode="numeric"
              aria-label={`قیمت روز هر واحد به ${unitLabel}`}
              placeholder={`قیمت روز (${unitLabel})`}
              value={priceField}
              onChange={(event) => setPriceText(formatSeparatedNumber(event.target.value))}
            />
            <button className="cta-confirm" type="button" onClick={() => void savePrice()}>
              ذخیره قیمت
            </button>
          </div>
        </section>

        <section className="home-card lg inv-block">
          <div className="inv-title-row">
            <h2>تاریخچه معاملات ({toFaDigits(history.length)})</h2>
            <button className="cat-mini" type="button" onClick={openCreate}>
              + معامله
            </button>
          </div>
          <p className="inv-meta">
            {asset.market === 'fund'
              ? 'برای صندوق، صدور و ابطال همان ورود و خروج واحد است. خرید و فروش هم ثبت می‌شود.'
              : 'خرید موجودی را زیاد می‌کند و فروش از همان میانگین موزون کم می‌کند.'}
          </p>

          {formOpen ? (
            <div className="inv-form">
              <div className="inv-kinds" role="group" aria-label="نوع معامله">
                {kindChoices.map((item) => (
                  <button
                    key={item}
                    className={`cat-mini${kind === item ? ' active' : ''}`}
                    type="button"
                    onClick={() => {
                      setKind(item)
                      setFormError(null)
                    }}
                  >
                    {KIND_LABEL[item]}
                  </button>
                ))}
              </div>
              <label className="inv-meta">
                تعداد واحد
                <input
                  className="field-input"
                  inputMode="decimal"
                  placeholder="مثلاً ۱۰۰۰"
                  value={qtyText}
                  onChange={(event) => {
                    setQtyText(event.target.value)
                    setFormError(null)
                  }}
                />
              </label>
              <label className="inv-meta">
                قیمت هر واحد ({unitLabel})
                <input
                  className="field-input"
                  inputMode="numeric"
                  placeholder={`قیمت به ${unitLabel}`}
                  value={tradePrice}
                  onChange={(event) => {
                    setTradePrice(formatSeparatedNumber(event.target.value))
                    setFormError(null)
                  }}
                />
              </label>
              <DateField label="تاریخ معامله" value={tradeDate} onChange={setTradeDate} />
              <label className="inv-meta">
                یادداشت
                <input
                  className="field-input"
                  placeholder="اختیاری"
                  value={tradeNote}
                  onChange={(event) => setTradeNote(event.target.value)}
                />
              </label>
              {preview?.error || formError ? <div className="banner error">{preview?.error || formError}</div> : null}
              {preview && !preview.error ? (
                <p className="inv-meta">
                  بعد از این معامله، مانده {formatQuantity(preview.quantity)} واحد و میانگین بها {formatMoney(preview.average)} است.
                  {preview.realized != null ? ` سود تحقق‌یافته همین معامله: ${signed(formatMoney, preview.realized)}.` : ''}
                </p>
              ) : null}
              <div className="inv-actions">
                <button className="cta-confirm" type="button" onClick={() => void saveTrade()}>
                  {editingId ? 'ذخیره معامله' : 'ثبت معامله'}
                </button>
                <button className="cat-mini" type="button" onClick={() => setFormOpen(false)}>
                  انصراف
                </button>
              </div>
            </div>
          ) : null}

          {history.length === 0 ? (
            <p className="inv-meta">هنوز معامله‌ای ثبت نشده است.</p>
          ) : (
            <div className="inv-history">
              {history.map((row) => {
                const inflow = isInflowKind(row.tx.kind)
                const total = row.tx.quantity * row.tx.unitPrice
                return (
                  <article key={row.tx.id} className="inv-tx">
                    <div className="inv-tx-top">
                      <div>
                        <span className={`inv-kind ${inflow ? 'in' : 'out'}`}>{KIND_LABEL[row.tx.kind]}</span>
                        <strong> {formatPersianDateFull(row.tx.date)}</strong>
                      </div>
                      <div className="inv-actions">
                        <button className="cat-mini" type="button" onClick={() => openEdit(row.tx)}>
                          ویرایش
                        </button>
                        {pendingDelete === row.tx.id ? (
                          <>
                            <button className="cat-mini danger" type="button" onClick={() => void removeTrade(row.tx.id)}>
                              تأیید حذف
                            </button>
                            <button className="cat-mini" type="button" onClick={() => setPendingDelete(null)}>
                              انصراف
                            </button>
                          </>
                        ) : (
                          <button className="cat-mini danger" type="button" onClick={() => setPendingDelete(row.tx.id)}>
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="inv-meta">
                      {formatQuantity(row.tx.quantity)} واحد × {formatMoney(row.tx.unitPrice)} = {formatMoney(total)}
                    </p>
                    <p className="inv-meta">
                      مانده پس از معامله: {formatQuantity(row.runningQuantity)}
                      {row.realizedProfit != null ? ` · سود تحقق‌یافته: ${signed(formatMoney, row.realizedProfit)}` : ''}
                    </p>
                    {row.tx.note ? <p className="inv-meta">{row.tx.note}</p> : null}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'up' | 'down'
}) {
  return (
    <div className="home-card lg inv-stat">
      <div className="lbl">{label}</div>
      <div className={`val${tone ? ` ${tone}` : ''}`}>{value}</div>
      {hint ? <div className="lbl">{hint}</div> : null}
    </div>
  )
}

function toneOf(amount: number): 'up' | 'down' | undefined {
  if (amount > 0.5) return 'up'
  if (amount < -0.5) return 'down'
  return undefined
}

function signed(formatMoney: (amount: number) => string, amount: number): string {
  if (Math.abs(amount) < 0.5) return formatMoney(0)
  const text = formatMoney(Math.abs(amount))
  return amount > 0 ? `+${text}` : `−${text}`
}
