import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { SettingsButton } from '../components/SettingsButton'
import { AmountField } from '../components/AmountField'
import { DateField } from '../components/DateField'
import { categoriesFor, getCategory } from '../lib/categories'
import { formatPersianDate } from '../lib/dates'
import { formatRial, toFaDigits } from '../lib/money'
import { toRial } from '../lib/sms/normalize'
import { confirmDraft, ingestBankSms, rejectDraft } from '../lib/sms/drafts'
import { smsCapability } from '../lib/sms/reader'
import { useSmsDrafts } from '../lib/sms/useSmsDrafts'
import type { DraftConfirmInput, SmsDirection, TransactionDraft } from '../lib/sms/types'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'

export function PendingTransactionsPage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const navigate = useNavigate()
  const { pending, state } = useSmsDrafts()
  const [pasteOpen, setPasteOpen] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const capability = smsCapability()
  const open = pending.find((draft) => draft.id === openId) ?? null
  const display = state?.settings.displayUnit ?? 'IRR'

  return (
    <div className="app-scroll" onScroll={(event) => onScroll(event.currentTarget.scrollTop > 28)}>
      <div className="detail-top">
        <button className="back-btn" type="button" onClick={() => navigate('/')} aria-label="بازگشت">
          ›
        </button>
        <h1>تراکنش‌های در انتظار تأیید</h1>
        <SettingsButton />
      </div>
      <p className="sheet-sub sms-lead">{capability.detail}</p>
      <div className="sms-actions">
        <button className="home-pill ghost" type="button" onClick={() => setPasteOpen(true)}>
          ورود متن پیامک
        </button>
      </div>
      {state == null ? (
        <p className="sheet-sub">در حال بارگذاری…</p>
      ) : pending.length === 0 ? (
        <div className="empty-state lg">
          <div className="empty-ico">✉️</div>
          <h2>تراکنش در انتظار تأییدی وجود ندارد.</h2>
          <p>وقتی پیامک بانکی جدیدی شناسایی شود، تراکنش اینجا نمایش داده خواهد شد.</p>
        </div>
      ) : (
        <div className="sms-list">
          {pending.map((draft) => (
            <button key={draft.id} className="sms-card lg" type="button" onClick={() => setOpenId(draft.id)}>
              <header>
                <strong>🏦 {draft.bankLabel}</strong>
                <span>{directionLabel(draft.direction)}</span>
              </header>
              <b className={draft.direction === 'INCOME' ? 'up' : draft.direction === 'EXPENSE' ? 'down' : ''}>
                {amountLabel(draft, display)}
              </b>
              <small>
                {draft.dateFromMessage ? formatPersianDate(draft.transactionDate) : 'زمان دریافت'}
                {draft.transactionTime ? ` - ${toFaDigits(draft.transactionTime)}` : ''}
                {draft.maskedCardNumber ? ` · کارت ${toFaDigits(draft.maskedCardNumber)}` : ''}
              </small>
              <em>وضعیت: در انتظار تأیید</em>
              {draft.needsReview ? <em className="warn">اطلاعات این پیام با اطمینان کافی شناسایی نشد.</em> : null}
            </button>
          ))}
        </div>
      )}
      {pasteOpen ? <SmsPasteSheet onClose={() => setPasteOpen(false)} /> : null}
      {open ? <DraftReviewSheet draft={open} onClose={() => setOpenId(null)} /> : null}
    </div>
  )
}

function SmsPasteSheet({ onClose }: { onClose: () => void }) {
  const [body, setBody] = useState('')
  const [sender, setSender] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const result = await ingestBankSms({
        sender: sender.trim() || 'بانک',
        body,
        mode: 'manual-import',
      })
      if (result.status === 'created') {
        notifyUser(result.needsReview ? 'پیام برای بررسی در صف قرار گرفت' : 'تراکنش برای تأیید آماده است')
        onClose()
        return
      }
      if (result.status === 'duplicate') {
        setError('این پیامک قبلاً ثبت شده و دوباره ساخته نمی‌شود.')
        return
      }
      if (result.status === 'error') {
        setError(result.message)
        return
      }
      if (result.reason === 'otp') {
        setError('این پیام شبیه رمز یکبارمصرف است و ذخیره نشد.')
        return
      }
      if (result.reason === 'disabled') {
        setError('شناسایی پیامک در تنظیمات خاموش است.')
        return
      }
      setError('این متن شبیه پیامک بانکی نبود.')
    } finally {
      setBusy(false)
    }
  }

  return portal(
    <>
      <div className="sheet-scrim sheet-front" onClick={onClose} />
      <div className="glass-sheet sheet-front sheet-sticky-cta" role="dialog" aria-label="ورود متن پیامک">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>ورود متن پیامک</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="sheet-body-scroll">
          <p className="sheet-sub">متن روی همین دستگاه بررسی می‌شود و تا وقتی تأیید نکنید وارد دفتر نمی‌شود.</p>
          {error ? <div className="banner error"><span>{error}</span></div> : null}
          <label className="field-stack">
            <span>فرستنده</span>
            <input className="field-input" value={sender} onChange={(event) => setSender(event.target.value)} aria-label="فرستنده" placeholder="مثلاً بانک" />
          </label>
          <label className="field-stack">
            <span>متن پیامک</span>
            <textarea className="field-input sms-text" value={body} onChange={(event) => setBody(event.target.value)} aria-label="متن پیامک" rows={6} />
          </label>
        </div>
        <div className="sheet-footer">
          <button className="cta-confirm" type="button" disabled={busy || body.trim().length < 4} onClick={() => void submit()}>
            {busy ? 'در حال بررسی…' : 'بررسی پیامک'}
          </button>
        </div>
      </div>
    </>,
  )
}

function DraftReviewSheet({ draft, onClose }: { draft: TransactionDraft; onClose: () => void }) {
  const { activeAccounts, customCategories, addQuickEntry, addTransfer } = useStore()
  const [direction, setDirection] = useState<DraftConfirmInput['direction'] | 'UNKNOWN'>(
    draft.direction === 'UNKNOWN' ? 'UNKNOWN' : draft.direction,
  )
  const [amountRial, setAmountRial] = useState(draft.amountRial ?? 0)
  const [unitChosen, setUnitChosen] = useState(draft.amountRial != null || draft.amountMinor == null)
  const [accountId, setAccountId] = useState(draft.accountId ?? activeAccounts[0]?.id ?? '')
  const [counterpartyId, setCounterpartyId] = useState(draft.counterpartyAccountId ?? '')
  const [categoryId, setCategoryId] = useState(draft.categoryId ?? '')
  const [description, setDescription] = useState(draft.description)
  const [date, setDate] = useState(draft.transactionDate)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const kind = direction === 'INCOME' ? 'income' : 'expense'
  const categories = direction === 'TRANSFER' ? [] : categoriesFor(kind, customCategories)

  function applyUnit(unit: 'IRR' | 'IRT') {
    if (draft.amountMinor == null) return
    const rial = toRial(draft.amountMinor, unit)
    if (rial == null) {
      setError('این مبلغ قابل تبدیل نیست.')
      return
    }
    setAmountRial(rial)
    setUnitChosen(true)
    setError(null)
  }

  async function confirm() {
    if (direction === 'UNKNOWN') {
      setError('نوع تراکنش را مشخص کنید.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await confirmDraft(
        draft.id,
        {
          direction,
          amountRial,
          accountId,
          counterpartyAccountId: direction === 'TRANSFER' ? counterpartyId : undefined,
          categoryId: direction === 'TRANSFER' ? 'transfer' : categoryId || categories[0]?.id || 'other-exp',
          description,
          date,
        },
        { addQuickEntry, addTransfer },
      )
      notifyUser('تراکنش با موفقیت ثبت شد.')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    setBusy(true)
    try {
      await rejectDraft(draft.id)
      notifyUser('تراکنش رد شد')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'رد انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  return portal(
    <>
      <div className="sheet-scrim sheet-front" onClick={onClose} />
      <div className="glass-sheet sheet-front sheet-sticky-cta" role="dialog" aria-label="بررسی تراکنش">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>{draft.bankLabel}</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="sheet-body-scroll">
          {draft.needsReview ? (
            <div className="banner error">
              <span>اطلاعات این پیام با اطمینان کافی شناسایی نشد. لطفاً قبل از ثبت آن را بررسی کنید.</span>
            </div>
          ) : null}
          {error ? <div className="banner error"><span>{error}</span></div> : null}
          <p className="sheet-sub">اطمینان تشخیص {toFaDigits(draft.confidence)}٪ · الگو {draft.parserId}</p>
          <div className="sms-choice" role="tablist" aria-label="نوع تراکنش">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((item) => (
              <button
                key={item}
                className={`home-pill${direction === item ? '' : ' ghost'}`}
                type="button"
                onClick={() => setDirection(item)}
              >
                {directionLabel(item)}
              </button>
            ))}
          </div>
          {draft.amountRial == null && !unitChosen && draft.amountMinor != null ? (
            <div className="sms-unit">
              <p>مبلغ {toFaDigits(draft.amountMinor)} در پیام آمده، ولی واحدش مشخص نیست.</p>
              <button type="button" className="home-pill ghost" onClick={() => applyUnit('IRR')}>این مبلغ ریال است</button>
              <button type="button" className="home-pill ghost" onClick={() => applyUnit('IRT')}>این مبلغ تومان است</button>
            </div>
          ) : (
            <AmountField value={amountRial} onChange={setAmountRial} ariaLabel="مبلغ به ریال" />
          )}
          <label className="field-stack">
            <span>حساب</span>
            <select className="field-input" value={accountId} aria-label="حساب" onChange={(event) => setAccountId(event.target.value)}>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
          {direction === 'TRANSFER' ? (
            <label className="field-stack">
              <span>حساب مقصد</span>
              <select className="field-input" value={counterpartyId} aria-label="حساب مقصد" onChange={(event) => setCounterpartyId(event.target.value)}>
                <option value="">انتخاب کنید</option>
                {activeAccounts.filter((account) => account.id !== accountId).map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field-stack">
              <span>دسته‌بندی</span>
              <select className="field-input" value={categoryId} aria-label="دسته‌بندی" onChange={(event) => setCategoryId(event.target.value)}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
                ))}
              </select>
            </label>
          )}
          <DateField label="تاریخ" value={date} onChange={setDate} />
          <label className="field-stack">
            <span>توضیحات</span>
            <input className="field-input" value={description} aria-label="توضیحات" placeholder="مثلاً حقوق شهریور" onChange={(event) => setDescription(event.target.value)} />
          </label>
          <ul className="sms-facts">
            <li>زمان: {draft.transactionTime ? toFaDigits(draft.transactionTime) : 'در پیام نبود'}</li>
            <li>کارت: {draft.maskedCardNumber ? toFaDigits(draft.maskedCardNumber) : 'در پیام نبود'}</li>
            <li>پیگیری: {draft.bankReference ? toFaDigits(draft.bankReference) : 'در پیام نبود'}</li>
            <li>مانده بعد: {draft.balanceAfterRial == null ? 'در پیام نبود' : `${formatRial(draft.balanceAfterRial)} ریال`}</li>
            <li>دسته پیشنهادی: {getCategory(draft.categoryId ?? '', customCategories)?.name ?? 'ندارد'}</li>
          </ul>
          {draft.originalMessage ? (
            <details>
              <summary>متن پیامک</summary>
              <p className="sms-original">{draft.originalMessage}</p>
            </details>
          ) : null}
          {!draft.dateFromMessage ? <p className="sheet-sub">تاریخ از زمان دریافت پیام است، نه از متن بانک.</p> : null}
        </div>
        <div className="sheet-footer sms-footer">
          <button className="home-pill ghost" type="button" disabled={busy} onClick={() => void reject()}>رد</button>
          <button className="cta-confirm" type="button" disabled={busy || direction === 'UNKNOWN' || !unitChosen} onClick={() => void confirm()}>
            تأیید و ثبت
          </button>
        </div>
      </div>
    </>,
  )
}

function portal(node: ReactNode) {
  return createPortal(node, document.body)
}

function directionLabel(direction: SmsDirection): string {
  if (direction === 'INCOME') return 'واریز'
  if (direction === 'EXPENSE') return 'برداشت'
  if (direction === 'TRANSFER') return 'انتقال'
  return 'نامشخص'
}

function amountLabel(draft: TransactionDraft, display: 'IRR' | 'IRT'): string {
  if (draft.amountRial == null) return 'مبلغ نامشخص'
  const sign = draft.direction === 'INCOME' ? '+' : draft.direction === 'EXPENSE' ? '−' : ''
  if (display === 'IRT' && draft.amountRial % 10 === 0) {
    return `${sign}${formatRial(draft.amountRial / 10)} تومان`
  }
  return `${sign}${formatRial(draft.amountRial)} ریال`
}
