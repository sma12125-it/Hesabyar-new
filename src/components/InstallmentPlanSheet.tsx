import { useMemo, useState } from 'react'
import { INSTALLMENT_CATEGORY_ID, getCategory } from '../lib/categories'
import { formatPersianDateFull } from '../lib/dates'
import { DateField } from './DateField'
import { todayIso } from '../lib/iso'
import { tryLoanSchedule } from '../lib/loan'
import { formatRial, parseDecimalInput, parseRialInput, toFaDigits } from '../lib/money'
import { planHasPayment, validatePlanInput, validatePlanUpdate } from '../lib/installments'
import { useScrollFocusedIntoView } from '../lib/keyboardInset'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import { AmountField } from './AmountField'
import { PickerSheet } from './PickerSheet'
import type { InstallmentPlan, InstallmentPlanKind } from '../types'

export function InstallmentPlanSheet({
  plan,
  onClose,
}: {
  plan?: InstallmentPlan
  onClose: () => void
}) {
  const { activeAccounts, items, plans, createInstallmentPlan, updateInstallmentPlan } = useStore()
  const planItems = items.filter((i) => i.planId === plan?.id)
  const locked = Boolean(plan && planHasPayment(planItems))
  const [kind, setKind] = useState<InstallmentPlanKind>(plan?.kind ?? 'fixed')
  const [name, setName] = useState(plan?.name ?? '')
  const [amount, setAmount] = useState(plan && plan.kind !== 'loan' ? plan.installmentAmount : 0)
  const [principal, setPrincipal] = useState(plan?.principal ?? 0)
  const [rateRaw, setRateRaw] = useState(plan?.annualRatePercent != null ? String(plan.annualRatePercent) : '')
  const [countRaw, setCountRaw] = useState(plan ? String(plan.totalCount) : '')
  const [startDate, setStartDate] = useState(plan?.startDate ?? todayIso())
  const [accountId, setAccountId] = useState(plan?.defaultAccountId ?? activeAccounts[0]?.id ?? '')
  const [picker, setPicker] = useState<'account' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useScrollFocusedIntoView()

  const account = activeAccounts.find((a) => a.id === accountId)
  const rate = parseDecimalInput(rateRaw)
  const count = parseRialInput(countRaw)
  const category = getCategory(INSTALLMENT_CATEGORY_ID)
  const activeCount = plans.filter((p) => p.status === 'active').length

  const schedule = useMemo(
    () => (kind === 'loan' && principal > 0 && count > 0 ? tryLoanSchedule(principal, rate, count) : null),
    [kind, principal, rate, count],
  )

  async function save() {
    setError(null)
    setSaving(true)
    try {
      if (plan) {
        await updateInstallmentPlan(plan.id, {
          name,
          defaultAccountId: accountId,
          ...(locked
            ? {}
            : kind === 'loan'
              ? {
                  kind: 'loan',
                  principal,
                  annualRatePercent: rate,
                  totalCount: count,
                  startDate,
                  installmentAmount: schedule?.monthlyPayment ?? 1,
                }
              : { kind: 'fixed', installmentAmount: amount, totalCount: count, startDate, principal: undefined, annualRatePercent: undefined }),
        })
      } else if (kind === 'loan') {
        await createInstallmentPlan({
          name,
          kind: 'loan',
          principal,
          annualRatePercent: rate,
          installmentAmount: schedule?.monthlyPayment ?? 1,
          totalCount: count,
          startDate,
          defaultAccountId: accountId,
        })
      } else {
        await createInstallmentPlan({
          name,
          kind: 'fixed',
          installmentAmount: amount,
          totalCount: count,
          startDate,
          defaultAccountId: accountId,
        })
      }
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ذخیره نشد'
      setError(message)
      notifyUser(message)
    } finally {
      setSaving(false)
    }
  }

  if (picker === 'account') {
    return (
      <PickerSheet title="حساب پرداخت" onClose={() => setPicker(null)}>
        {activeAccounts.map((a) => (
          <button
            key={a.id}
            type="button"
            className="option-item lg-row"
            onClick={() => {
              setAccountId(a.id)
              setPicker(null)
            }}
          >
            <span className="oico">💳</span>
            <div>
              <div className="otitle">{a.name}</div>
              <div className="osub">{formatRial(a.balance)} ریال</div>
            </div>
          </button>
        ))}
      </PickerSheet>
    )
  }

  const lastDiffers = Boolean(schedule && schedule.amounts[0] !== schedule.amounts[schedule.amounts.length - 1])
  const invalid = locked
    ? validatePlanUpdate({ name, defaultAccountId: accountId }, planItems, activeAccounts)
    : validatePlanInput(
        {
          name,
          installmentAmount: kind === 'loan' ? (schedule?.monthlyPayment ?? 0) : amount,
          totalCount: count,
          startDate,
          defaultAccountId: accountId,
          kind,
          principal: kind === 'loan' ? principal : undefined,
          annualRatePercent: kind === 'loan' ? rate : undefined,
        },
        activeAccounts,
      )
  const ctaDisabled = saving || Boolean(invalid)

  return (
    <>
      <div className="peek-home">
        <div className="ph-title">اقساط</div>
        <div className="ph-amt">{activeCount} برنامه فعال</div>
      </div>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        className="glass-sheet sheet-sticky-cta"
        role="dialog"
        aria-label={plan ? 'ویرایش برنامه' : 'برنامه جدید'}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>{plan ? 'ویرایش برنامه' : 'برنامه جدید'}</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>
        <div className="sheet-body-scroll">
          {error ? (
            <div className="banner error">
              <span className="bico">⚠</span>
              <span>{error}</span>
            </div>
          ) : null}
          {locked ? (
            <p className="sheet-sub">پس از اولین پرداخت فقط نام و حساب پرداخت قابل تغییر است.</p>
          ) : null}
          <div className="field-stack">
            <div className="field-chip">
              <span className="ficon">✏️</span>
              <div style={{ flex: 1 }}>
                <div className="flabel">نام برنامه</div>
                <input
                  className="field-input"
                  placeholder="مثلاً قسط لپ‌تاپ"
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            {!locked ? (
              <div className="seg type-seg" role="tablist" aria-label="نوع برنامه">
                <div className={`seg-thumb${kind === 'loan' ? ' type-bank' : ''}`} aria-hidden="true" />
                <button
                  className={`seg-btn cash${kind === 'fixed' ? ' active' : ''}`}
                  type="button"
                  onClick={() => setKind('fixed')}
                >
                  قسط ثابت
                </button>
                <button
                  className={`seg-btn bank${kind === 'loan' ? ' active' : ''}`}
                  type="button"
                  onClick={() => setKind('loan')}
                >
                  وام بانکی
                </button>
              </div>
            ) : null}

            {kind === 'loan' && !locked ? (
              <>
                <div className="field-chip">
                  <span className="ficon">🏦</span>
                  <div style={{ flex: 1 }}>
                    <div className="flabel">مبلغ اصل وام</div>
                    <AmountField
                      value={principal}
                      onChange={setPrincipal}
                      ariaLabel="مبلغ اصل وام به ریال"
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--hy-text-tertiary)' }}>ریال</span>
                </div>
                <div className="field-chip">
                  <span className="ficon">٪</span>
                  <div style={{ flex: 1 }}>
                    <div className="flabel">نرخ سود سالانه</div>
                    <input
                      className="field-input"
                      inputMode="decimal"
                      placeholder="۱۸"
                      value={rateRaw}
                      onChange={(e) => setRateRaw(e.target.value)}
                      aria-label="نرخ سود سالانه"
                    />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--hy-text-tertiary)' }}>٪</span>
                </div>
              </>
            ) : (
              <div className={`field-chip${locked ? ' chip-readonly' : ''}`}>
                <span className="ficon">💰</span>
                <div style={{ flex: 1 }}>
                  <div className="flabel">{kind === 'loan' ? 'قسط ماهانه' : 'مبلغ هر قسط'}</div>
                  {locked ? (
                    <div className="fvalue">
                      {formatRial(plan?.installmentAmount ?? amount)}
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--hy-text-tertiary)', marginRight: 4 }}>
                        ریال
                      </span>
                    </div>
                  ) : (
                    <AmountField
                      value={amount}
                      onChange={setAmount}
                      ariaLabel="مبلغ هر قسط به ریال"
                    />
                  )}
                </div>
                {!locked ? (
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--hy-text-tertiary)' }}>ریال</span>
                ) : (
                  <span className="readonly-tag">قفل</span>
                )}
              </div>
            )}

            <div className={`field-chip${locked ? ' chip-readonly' : ''}`}>
              <span className="ficon">＃</span>
              <div style={{ flex: 1 }}>
                <div className="flabel">{kind === 'loan' ? 'مدت (ماه)' : 'تعداد اقساط'}</div>
                {locked ? (
                  <div className="fvalue">{count} قسط</div>
                ) : (
                  <input
                    className="field-input"
                    inputMode="numeric"
                    placeholder="۱۲"
                    value={countRaw}
                    onChange={(e) => setCountRaw(e.target.value)}
                    aria-label="تعداد اقساط"
                  />
                )}
              </div>
              {locked ? <span className="readonly-tag">قفل</span> : null}
            </div>
            {locked ? (
              <div className="field-chip chip-readonly">
                <span className="ficon">📆</span>
                <div>
                  <div className="flabel">تاریخ شروع</div>
                  <div className="fvalue">{formatPersianDateFull(startDate)}</div>
                </div>
                <span className="readonly-tag">قفل</span>
              </div>
            ) : (
              <DateField label="تاریخ شروع" value={startDate} onChange={setStartDate} />
            )}
            <button className="field-chip" type="button" onClick={() => setPicker('account')}>
              <span className="ficon">💳</span>
              <div>
                <div className="flabel">حساب پرداخت</div>
                <div className={account ? 'fvalue' : 'fvalue placeholder-val'}>
                  {account?.name ?? 'انتخاب حساب…'}
                </div>
              </div>
              <span className="fchev">‹</span>
            </button>
            <div className="field-chip chip-readonly">
              <span className="ficon">{category?.icon ?? '📂'}</span>
              <div>
                <div className="flabel">دسته‌بندی</div>
                <div className="fvalue">{category?.name ?? 'اقساط'}</div>
              </div>
              <span className="readonly-tag">ثابت</span>
            </div>
          </div>

          {schedule ? (
            <div className="plan-stats loan-preview">
              <div>
                <strong>{formatRial(schedule.monthlyPayment)}</strong>
                قسط ماهانه
              </div>
              <div>
                <strong>{formatRial(schedule.totalInterest)}</strong>
                مجموع سود
              </div>
              <div>
                <strong>{formatRial(schedule.totalRepayment)}</strong>
                بازپرداخت
              </div>
            </div>
          ) : null}
          {lastDiffers ? (
            <p className="sheet-sub">قسط آخر برای گرد کردن ریال ممکن است کمی متفاوت باشد · {toFaDigits(schedule!.months)} قسط</p>
          ) : null}

        </div>
        <div className="sheet-footer">
          <button
            className="cta-confirm"
            type="button"
            disabled={ctaDisabled}
            onClick={() => void save()}
          >
            {saving ? 'در حال ذخیره…' : plan ? 'ذخیره تغییرات' : 'ذخیره برنامه'}
          </button>
        </div>
      </div>
    </>
  )
}
