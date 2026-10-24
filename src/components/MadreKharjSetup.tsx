import { useEffect, useState } from 'react'
import { DateField } from './DateField'
import { formatPersianDateFull } from '../lib/dates'
import {
  dongPayerLabel,
  hasPotPayments,
  isMadreKharjEnabled,
  knownDeposits,
  MADRE_KHARJ_NAME,
  type DongCalculationSummary,
  type PotLedgerEntry,
} from '../lib/dong'
import { createId } from '../lib/ids'
import { todayIso } from '../lib/iso'
import { digitsOnly, formatSeparatedNumber, toFaDigits } from '../lib/money'
import type { CurrencyUnit, DongEvent, DongPotDeposit } from '../types'

function rialsToInput(rials: number, unit: CurrencyUnit): string {
  if (!rials) return ''
  const display = unit === 'IRT' ? Math.round(rials / 10) : Math.round(rials)
  return formatSeparatedNumber(display)
}

function inputToRials(raw: string, unit: CurrencyUnit): number {
  const n = Number(digitsOnly(raw)) || 0
  if (n <= 0) return 0
  return unit === 'IRT' ? n * 10 : n
}

export function MemberPotFigures({
  deposits,
  deficitCovered,
  formatMoney,
}: {
  deposits: number
  deficitCovered: number
  formatMoney: (amount: number) => string
}) {
  if (deposits <= 0 && deficitCovered <= 0) return null
  return (
    <>
      {deposits > 0 ? (
        <div className="madre-fig">
          <span>واریز به مادرخرج:</span>
          <b>{formatMoney(deposits)}</b>
        </div>
      ) : null}
      {deficitCovered > 0 ? (
        <div className="madre-fig">
          <span>پوشش کسری مادرخرج:</span>
          <b>{formatMoney(deficitCovered)}</b>
        </div>
      ) : null}
    </>
  )
}

export function PotLedgerList({
  ledger,
  formatMoney,
}: {
  ledger: PotLedgerEntry[]
  formatMoney: (amount: number) => string
}) {
  if (ledger.length === 0) {
    return <p className="sheet-sub" style={{ margin: 0 }}>هنوز گردشی در مادرخرج ثبت نشده است.</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ledger.map((row) => {
        const inbound = row.signed >= 0
        return (
          <div key={row.id} className="madre-ledger-row">
            <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>
                {inbound ? 'واریز' : 'خرج'} · {row.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 3 }}>
                {row.date ? formatPersianDateFull(row.date) : 'بدون تاریخ'}
                <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
                {row.detail}
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, color: inbound ? 'var(--hy-income)' : 'var(--hy-expense)' }}>
                {inbound ? '+' : '−'}
                {formatMoney(row.amount)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                مانده {formatMoney(row.runningBalance)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function MadreKharjOverview({
  event,
  summary,
  formatMoney,
  onEdit,
}: {
  event: DongEvent
  summary: DongCalculationSummary
  formatMoney: (amount: number) => string
  onEdit: () => void
}) {
  if (!summary.potActive && !isMadreKharjEnabled(event)) return null
  const responsible = event.participants.find((p) => p.id === summary.responsibleId)
  const balanceColor = summary.potBalance < 0 ? 'var(--hy-expense)' : summary.potBalance > 0 ? 'var(--hy-income)' : 'var(--hy-text)'
  return (
    <section className="madre-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>صندوق مادرخرج</h3>
        <button className="cat-mini" type="button" onClick={onEdit}>
          ویرایش در تنظیمات گروه
        </button>
      </div>
      <p className="sheet-sub" style={{ margin: '6px 0 10px' }}>
        مسئول: <b>{responsible?.name ?? 'انتخاب نشده'}</b>
        <span style={{ margin: '0 6px', opacity: 0.5 }}>·</span>
        موجودی = واریزها − خرج‌های پرداخت‌شده از مادرخرج
      </p>
      <div className="madre-stats">
        <div>
          <span>موجودی مادرخرج</span>
          <strong style={{ color: balanceColor }}>{formatMoney(summary.potBalance)}</strong>
        </div>
        <div>
          <span>جمع واریز اعضا</span>
          <strong>{formatMoney(summary.totalDeposits)}</strong>
        </div>
        <div>
          <span>خرج از مادرخرج</span>
          <strong>{formatMoney(summary.potSpent)}</strong>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, margin: '12px 0 6px' }}>واریز هر عضو</div>
      <div className="madre-member-grid">
        {summary.balances.map((b) => (
          <div key={b.id} className="madre-member-chip">
            <span>{b.name}</span>
            <b>{formatMoney(b.deposits)}</b>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, margin: '12px 0 6px' }}>
        گردش مادرخرج ({toFaDigits(summary.ledger.length)})
      </div>
      <PotLedgerList ledger={summary.ledger} formatMoney={formatMoney} />
    </section>
  )
}

export function MadreKharjSetup({
  event,
  currencyUnit,
  unitLabel,
  formatMoney,
  summary,
  onSave,
  onNotify,
  onBack,
  onSkip,
}: {
  event: DongEvent
  currencyUnit: CurrencyUnit
  unitLabel: string
  formatMoney: (amount: number) => string
  summary: DongCalculationSummary
  onSave: (event: DongEvent) => void
  onNotify: (message: string) => void
  onBack: () => void
  onSkip: () => void
}) {
  const enabled = isMadreKharjEnabled(event)
  const [responsibleId, setResponsibleId] = useState(event.madreKharj?.responsibleId ?? '')
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {}
    for (const p of event.participants) {
      next[p.id] = rialsToInput(event.madreKharj?.contributions?.[p.id] ?? 0, currencyUnit)
    }
    return next
  })
  const [depositMember, setDepositMember] = useState(event.participants[0]?.id ?? '')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositDate, setDepositDate] = useState(todayIso())
  const [depositNote, setDepositNote] = useState('')
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null)

  useEffect(() => {
    setResponsibleId(event.madreKharj?.responsibleId ?? '')
    const next: Record<string, string> = {}
    for (const p of event.participants) {
      next[p.id] = rialsToInput(event.madreKharj?.contributions?.[p.id] ?? 0, currencyUnit)
    }
    setAmounts(next)
  }, [event.id, currencyUnit])

  useEffect(() => {
    setAmounts((prev) => {
      let changed = false
      const next = { ...prev }
      for (const p of event.participants) {
        if (next[p.id] === undefined) {
          next[p.id] = rialsToInput(event.madreKharj?.contributions?.[p.id] ?? 0, currencyUnit)
          changed = true
        }
      }
      return changed ? next : prev
    })
    if (!event.participants.some((p) => p.id === depositMember)) {
      setDepositMember(event.participants[0]?.id ?? '')
    }
  }, [event.participants, event.madreKharj, currencyUnit, depositMember])

  function contributionsFromForm(): Record<string, number> {
    const contributions: Record<string, number> = {}
    for (const p of event.participants) {
      const rials = inputToRials(amounts[p.id] ?? '', currencyUnit)
      if (rials > 0) contributions[p.id] = rials
    }
    return contributions
  }

  function saveSetup() {
    if (!event.participants.some((p) => p.id === responsibleId)) {
      onNotify('مسئول مادرخرج را از بین اعضای همین گروه انتخاب کنید')
      return
    }
    onSave({
      ...event,
      madreKharj: {
        enabled: true,
        responsibleId,
        contributions: contributionsFromForm(),
        deposits: event.madreKharj?.deposits ?? [],
      },
    })
    onNotify('مادرخرج ثبت شد. خرج تازه به‌صورت پیش‌فرض از مادرخرج پرداخت می‌شود و باز هم می‌توانید عضو دیگری را انتخاب کنید.')
  }

  function disableSetup() {
    if (hasPotPayments(event)) {
      onNotify('خرج‌هایی از مادرخرج پرداخت شده‌اند. اول پرداخت‌کننده‌شان را عوض کنید، بعد مادرخرج را بردارید.')
      return
    }
    onSave({
      ...event,
      madreKharj: {
        enabled: false,
        responsibleId: event.madreKharj?.responsibleId,
        contributions: event.madreKharj?.contributions,
        deposits: event.madreKharj?.deposits ?? [],
      },
    })
    onNotify('مادرخرج برداشته شد. حساب این گروه مثل قبل بین خود اعضا می‌ماند.')
  }

  function saveDeposit() {
    if (!enabled) {
      onNotify('اول مسئول و مبلغ اعضا را ثبت کنید. بعد می‌توانید واریز بعدی اضافه کنید.')
      return
    }
    const amount = inputToRials(depositAmount, currencyUnit)
    if (!depositMember || amount <= 0) {
      onNotify('عضو و مبلغ واریز لازم است')
      return
    }
    const deposits = [...(event.madreKharj?.deposits ?? [])]
    if (editingDepositId) {
      const idx = deposits.findIndex((d) => d.id === editingDepositId)
      if (idx >= 0) {
        const prev = deposits[idx]
        deposits[idx] = {
          ...prev,
          memberId: depositMember,
          amount,
          date: depositDate || todayIso(),
          note: depositNote.trim() || undefined,
          updatedAt: Date.now(),
        }
      }
    } else {
      const row: DongPotDeposit = {
        id: createId('ddep'),
        memberId: depositMember,
        amount,
        date: depositDate || todayIso(),
        note: depositNote.trim() || undefined,
        createdAt: Date.now(),
      }
      deposits.push(row)
    }
    onSave({
      ...event,
      madreKharj: {
        enabled: true,
        responsibleId: event.madreKharj?.responsibleId,
        contributions: event.madreKharj?.contributions,
        deposits,
      },
    })
    setEditingDepositId(null)
    setDepositAmount('')
    setDepositNote('')
    setDepositDate(todayIso())
    onNotify(editingDepositId ? 'واریز ویرایش شد' : 'واریز به مادرخرج ثبت شد')
  }

  function editDeposit(deposit: DongPotDeposit) {
    setEditingDepositId(deposit.id)
    setDepositMember(deposit.memberId)
    setDepositAmount(rialsToInput(deposit.amount, currencyUnit))
    setDepositDate(deposit.date || todayIso())
    setDepositNote(deposit.note ?? '')
  }

  function deleteDeposit(deposit: DongPotDeposit) {
    const name = event.participants.find((p) => p.id === deposit.memberId)?.name ?? 'عضو'
    if (!confirm(`واریز ${name} حذف شود؟`)) return
    onSave({
      ...event,
      madreKharj: {
        enabled: event.madreKharj?.enabled ?? false,
        responsibleId: event.madreKharj?.responsibleId,
        contributions: event.madreKharj?.contributions,
        deposits: (event.madreKharj?.deposits ?? []).filter((d) => d.id !== deposit.id),
      },
    })
    if (editingDepositId === deposit.id) {
      setEditingDepositId(null)
      setDepositAmount('')
      setDepositNote('')
    }
    onNotify('واریز حذف شد')
  }

  const deposits = knownDeposits(event)
  const balanceColor = summary.potBalance < 0 ? 'var(--hy-expense)' : summary.potBalance > 0 ? 'var(--hy-income)' : 'var(--hy-text)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="madre-note">
        این مرحله اختیاری است و بعد از اعضا و گروه‌ها می‌آید. اگر رد شود، دونگ مثل قبل فقط بین خود اعضا حساب می‌شود.
        اگر مادرخرج را ثبت کنید، خرج جدید به‌صورت پیش‌فرض از صندوق پرداخت می‌شود و همچنان می‌توانید عضو دیگری را به‌عنوان پرداخت‌کننده انتخاب کنید.
      </div>

      <div className="madre-card" style={{ margin: 0 }}>
        <label style={{ fontSize: 12, fontWeight: 800, display: 'block', marginBottom: 6 }}>
          مسئول مادرخرج
        </label>
        <select
          className="field-input"
          aria-label="مسئول مادرخرج"
          value={event.participants.some((p) => p.id === responsibleId) ? responsibleId : ''}
          onChange={(e) => setResponsibleId(e.target.value)}
        >
          <option value="">انتخاب از اعضای گروه…</option>
          {event.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="sheet-sub" style={{ margin: '6px 0 0' }}>
          مسئول را بعداً هم می‌توانید عوض کنید. پول صندوق دست اوست.
        </p>
      </div>

      <div className="madre-card" style={{ margin: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
          مبلغ هر عضو به حساب مادرخرج ({unitLabel})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {event.participants.map((p) => (
            <label key={p.id} className="madre-amount-row">
              <span>
                {p.name}
                {p.id === responsibleId ? (
                  <em>مسئول</em>
                ) : null}
              </span>
              <input
                className="field-input"
                inputMode="numeric"
                aria-label={`مبلغ ${p.name} به حساب مادرخرج`}
                placeholder="۰"
                value={amounts[p.id] ?? ''}
                onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: formatSeparatedNumber(e.target.value) }))}
              />
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="cta-confirm" type="button" style={{ width: 'auto', padding: '0 16px' }} onClick={saveSetup}>
            {enabled ? 'ذخیره مسئول و مبالغ' : 'ثبت مادرخرج'}
          </button>
          <button className="cat-mini" type="button" onClick={onBack}>
            بازگشت به گروه‌ها
          </button>
          {enabled ? (
            <button className="cat-mini danger" type="button" onClick={disableSetup}>
              برداشتن مادرخرج
            </button>
          ) : (
            <button className="cat-mini" type="button" onClick={onSkip}>
              رد شدن؛ بدون مادرخرج
            </button>
          )}
        </div>
      </div>

      <div className="madre-card" style={{ margin: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>واریزهای بعدی</div>
        <p className="sheet-sub" style={{ margin: '0 0 8px' }}>
          مبلغ بالا سهم اولیه هر عضو است. هر واریز تازه، با تاریخ شمسی و توضیح، جداگانه به همان حساب اضافه می‌شود.
        </p>
        {deposits.length === 0 ? (
          <p className="sheet-sub" style={{ margin: '0 0 8px' }}>واریز دیگری ثبت نشده است.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {deposits.map((deposit) => (
              <div key={deposit.id} className="madre-ledger-row">
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>
                    {dongPayerLabel(event, deposit.memberId)} · {formatMoney(deposit.amount)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 3 }}>
                    {deposit.date ? formatPersianDateFull(deposit.date) : 'بدون تاریخ'}
                    {deposit.note ? ` · ${deposit.note}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="cat-mini" type="button" onClick={() => editDeposit(deposit)}>ویرایش</button>
                  <button className="cat-mini danger" type="button" onClick={() => deleteDeposit(deposit)}>حذف</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="field-stack">
          <label style={{ fontSize: 11, fontWeight: 700 }}>عضو</label>
          <select
            className="field-input"
            aria-label="عضو واریزکننده"
            value={depositMember}
            onChange={(e) => setDepositMember(e.target.value)}
          >
            {event.participants.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <label style={{ fontSize: 11, fontWeight: 700 }}>مبلغ ({unitLabel})</label>
          <input
            className="field-input"
            inputMode="numeric"
            aria-label="مبلغ واریز"
            placeholder="مبلغ واریز"
            value={depositAmount}
            onChange={(e) => setDepositAmount(formatSeparatedNumber(e.target.value))}
          />
          <DateField label="تاریخ واریز" value={depositDate} onChange={setDepositDate} />
          <label style={{ fontSize: 11, fontWeight: 700 }}>توضیح (اختیاری)</label>
          <input
            className="field-input"
            aria-label="توضیح واریز"
            placeholder="مثلاً: کارت به کارت"
            value={depositNote}
            onChange={(e) => setDepositNote(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cat-mini" type="button" onClick={saveDeposit}>
              {editingDepositId ? 'ذخیره ویرایش واریز' : '+ ثبت واریز بعدی'}
            </button>
            {editingDepositId ? (
              <button
                className="cat-mini"
                type="button"
                onClick={() => {
                  setEditingDepositId(null)
                  setDepositAmount('')
                  setDepositNote('')
                  setDepositDate(todayIso())
                }}
              >
                انصراف
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {summary.potActive ? (
        <div className="madre-card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>موجودی فعلی {MADRE_KHARJ_NAME}</span>
            <strong style={{ color: balanceColor }}>{formatMoney(summary.potBalance)}</strong>
          </div>
          <p className="sheet-sub" style={{ margin: '6px 0 8px' }}>
            واریزها {formatMoney(summary.totalDeposits)} · خرج از صندوق {formatMoney(summary.potSpent)}
          </p>
          <PotLedgerList ledger={summary.ledger} formatMoney={formatMoney} />
        </div>
      ) : null}
    </div>
  )
}
