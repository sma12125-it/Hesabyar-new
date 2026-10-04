import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatPersianDateFull } from '../lib/dates'
import {
  itemEffectiveStatus,
  nextPayableItem,
  paidCount,
  remainingAmount,
} from '../lib/installments'
import { daysUntil, todayIso } from '../lib/iso'
import { formatRial, toFaDigits } from '../lib/money'
import { useStore } from '../store/Store'
import { SettingsButton } from '../components/SettingsButton'
import { SwipeRow } from '../components/SwipeRow'
import { useUiActions } from '../components/UiActions'
import { useExtras } from '../store/Extras'
import type { InstallmentItem } from '../types'

export function InstallmentDetailPage({
  onScroll,
  onEdit,
  onPay,
}: {
  onScroll: (compact: boolean) => void
  onEdit: () => void
  onPay: (itemId: string) => void
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { accounts, plans, items, transactions, archiveInstallmentPlan, restoreInstallmentPlan } = useStore()
  const { formatMoney } = useExtras()
  const actions = useUiActions()
  const [menu, setMenu] = useState(false)
  const [showPaidArchive, setShowPaidArchive] = useState(false)
  const plan = plans.find((p) => p.id === id)
  const planItems = items.filter((i) => i.planId === id).sort((a, b) => a.index - b.index)
  const today = todayIso()

  if (!plan) {
    return (
      <div className="app-scroll">
        <div className="empty-state lg">
          <h2>برنامه پیدا نشد</h2>
          <button className="cta-confirm" type="button" onClick={() => navigate('/installments')}>
            بازگشت
          </button>
        </div>
      </div>
    )
  }

  const paid = paidCount(planItems, today)
  const remaining = remainingAmount(planItems, today)
  const next = nextPayableItem(planItems, today)
  const overdueItem = planItems.find((i) => itemEffectiveStatus(i, today) === 'overdue')
  const canPay = plan.status === 'active' && Boolean(next)
  const nextDueLabel = next ? formatPersianDateFull(next.dueDate) : '—'

  // Separate paid (archived) and pending/overdue (active payable) items
  const paidItems = planItems.filter((i) => itemEffectiveStatus(i, today) === 'paid')
  const unpaidItems = planItems.filter((i) => itemEffectiveStatus(i, today) !== 'paid')
  const totalPaidAmount = paidItems.reduce((sum, item) => sum + item.amount, 0)
  const lastPaidItem = paidItems.length > 0 ? paidItems[paidItems.length - 1] : undefined
  const lastPaidTx = lastPaidItem
    ? transactions.find((t) => t.id === lastPaidItem.transactionId || t.installmentItemId === lastPaidItem.id)
    : undefined

  return (
    <div className="app-scroll" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="detail-top">
        <button
          className="back-btn"
          type="button"
          onClick={() => navigate(plan.status === 'active' ? '/installments' : '/installments/archive')}
          aria-label="بازگشت"
        >
          ›
        </button>
        <h1>{plan.name}</h1>
        <SettingsButton />
        <button className="icon-btn" type="button" onClick={() => setMenu((v) => !v)} aria-label="گزینه‌ها">
          ⋯
        </button>
      </div>

      {menu ? (
        <div className="menu-card lg">
          <button
            type="button"
            onClick={() => {
              setMenu(false)
              onEdit()
            }}
          >
            ویرایش برنامه
          </button>
          {plan.status === 'archived' ? (
            <button
              type="button"
              onClick={() => {
                setMenu(false)
                void restoreInstallmentPlan(plan.id)
              }}
            >
              بازگردانی از آرشیو
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMenu(false)
                void archiveInstallmentPlan(plan.id)
              }}
            >
              آرشیو برنامه
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMenu(false)
              actions?.deletePlan(plan.id)
            }}
          >
            حذف برنامه
          </button>
        </div>
      ) : null}

      {overdueItem && plan.status === 'active' ? (
        <div className="banner error">
          <span className="bico">⚠</span>
          <span>سررسید گذشته — قسط {toFaDigits(overdueItem.index)} معوق است</span>
        </div>
      ) : null}

      {plan.status === 'archived' ? (
        <div className="banner archive">
          <span className="bico">📦</span>
          <span>این برنامه آرشیو شده است — پرداخت جدید ممکن نیست</span>
        </div>
      ) : null}

      {plan.status === 'completed' ? (
        <div className="banner archive">
          <span className="bico">📦</span>
          <span>این برنامه پایان یافته و در بایگانی است. برگشت یک قسط آن را به لیست فعال برمی‌گرداند.</span>
        </div>
      ) : null}

      <div className="balance-lens lg lg-strong" style={{ marginTop: 8 }}>
        <div className="balance-hero" style={{ margin: 0, padding: '4px 0 0' }}>
          <div className="label">مانده کل</div>
          <div className="amount">
            {formatRial(remaining)}
            <span className="currency">ریال</span>
          </div>
        </div>
        <div className="plan-stats">
          <div>
            <strong>
              {toFaDigits(paid)} / {toFaDigits(plan.totalCount)}
            </strong>
            پرداخت‌شده
          </div>
          <div>
            <strong>{formatRial(plan.installmentAmount)}</strong>
            {plan.kind === 'loan' ? 'قسط نوعی' : 'هر قسط'}
          </div>
          <div>
            {overdueItem && plan.status === 'active' ? (
              <strong className="danger">معوق</strong>
            ) : (
              <strong>{nextDueLabel}</strong>
            )}
            {overdueItem && plan.status === 'active' ? 'وضعیت' : 'سررسید بعد'}
          </div>
        </div>
        {plan.kind === 'loan' && plan.principal != null ? (
          <div className="plan-stats" style={{ marginTop: 6 }}>
            <div>
              <strong>{formatRial(plan.principal)}</strong>
              اصل وام
            </div>
            <div>
              <strong>{toFaDigits(plan.annualRatePercent ?? 0)}٪</strong>
              سود سالانه
            </div>
            <div>
              <strong>{formatRial(planItems.reduce((sum, i) => sum + i.amount, 0) - plan.principal)}</strong>
              مجموع سود
            </div>
          </div>
        ) : null}

        {lastPaidItem ? (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 12,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '0.5px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
            }}
          >
            <span style={{ color: 'var(--hy-text-secondary)' }}>آخرین قسط پرداخت‌شده:</span>
            <strong style={{ color: 'var(--hy-income)' }}>
              قسط {toFaDigits(lastPaidItem.index)} · تاریخ پرداخت:{' '}
              {formatPersianDateFull(lastPaidTx?.date || lastPaidItem.paidAt || lastPaidItem.dueDate)}
            </strong>
          </div>
        ) : null}
      </div>

      <div className="action-row">
        <button
          className={`action-chip lg-light${canPay ? '' : ' disabled'}`}
          type="button"
          style={{ flex: 2 }}
          disabled={!canPay}
          onClick={() => next && onPay(next.id)}
        >
          <span className="aico">✓</span>
          {overdueItem ? 'پرداخت قسط معوق' : 'پرداخت قسط'}
        </button>
        <button className="action-chip lg-light" type="button" onClick={onEdit}>
          <span className="aico">✎</span>ویرایش
        </button>
      </div>

      <div className="section-head">
        <h2>جدول اقساط</h2>
        <span className="link">
          {toFaDigits(unpaidItems.length)} قسط در انتظار · {toFaDigits(paidItems.length)} پرداخت‌شده
        </span>
      </div>

      <div className="inst-list">
        {/* Archive box for paid installments - sits in place of the paid installments at the top */}
        {paidItems.length > 0 ? (
          <div
            style={{
              borderRadius: 20,
              background: 'linear-gradient(155deg, rgba(13, 148, 136, 0.12) 0%, rgba(15, 23, 42, 0.04) 100%)',
              border: '0.5px solid rgba(13, 148, 136, 0.35)',
              overflow: 'hidden',
              marginBottom: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setShowPaidArchive((prev) => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                textAlign: 'right',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 12,
                    background: 'rgba(13, 148, 136, 0.2)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 16,
                  }}
                >
                  📦
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--hy-text)' }}>
                    بایگانی اقساط پرداخت‌شده
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--hy-text-tertiary)', marginTop: 2 }}>
                    {toFaDigits(paidItems.length)} قسط تسویه شده · مجموع: {formatMoney(totalPaidAmount)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--hy-teal-deep)',
                    background: 'rgba(13, 148, 136, 0.15)',
                    padding: '2px 8px',
                    borderRadius: 8,
                  }}
                >
                  {showPaidArchive ? 'بستن' : 'مشاهده'}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: 'var(--hy-text-tertiary)',
                    transform: showPaidArchive ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    display: 'inline-block',
                  }}
                >
                  ‹
                </span>
              </div>
            </button>

            {/* Expanded List of Archived Paid Installments */}
            {showPaidArchive ? (
              <div
                style={{
                  padding: '4px 10px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  borderTop: '0.5px solid rgba(13, 148, 136, 0.18)',
                  background: 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--hy-text-tertiary)', padding: '6px 4px 2px' }}>
                  اقساط پرداخت‌شده به‌صورت بایگانی در اینجا نگهداری می‌شوند و برای اصلاح یا بازگشت به مانده قابل دسترسی هستند:
                </div>
                {paidItems.map((item) => {
                  const tx = transactions.find((t) => t.id === item.transactionId || t.installmentItemId === item.id)
                  const acc = tx ? accounts.find((a) => a.id === tx.accountId) : undefined
                  return (
                    <ItemRow
                      key={item.id}
                      item={item}
                      today={today}
                      paidDate={tx?.date || item.paidAt}
                      accountName={acc?.name}
                      onPay={undefined}
                    />
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Unpaid / Active installments - always ordered at the top */}
        {unpaidItems.length > 0 ? (
          unpaidItems.map((item) => (
            <ItemRow key={item.id} item={item} today={today} onPay={canPay ? onPay : undefined} />
          ))
        ) : paidItems.length > 0 ? (
          <div
            className="empty-state lg"
            style={{
              margin: '14px 0',
              padding: '20px 14px',
              background: 'rgba(13, 148, 136, 0.08)',
              border: '0.5px solid rgba(13, 148, 136, 0.25)',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>تمام اقساط پرداخت شده‌اند!</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--hy-text-secondary)' }}>
              تمامی {toFaDigits(plan.totalCount)} قسط این طرح با موفقیت پرداخت و به بایگانی بالا منتقل شده‌اند.
            </p>
          </div>
        ) : (
          <p className="sheet-sub">هیچ قسطی در این برنامه تعریف نشده است.</p>
        )}
      </div>
    </div>
  )
}

function ItemRow({
  item,
  today,
  paidDate,
  accountName,
  onPay,
}: {
  item: InstallmentItem
  today: string
  paidDate?: string
  accountName?: string
  onPay?: (itemId: string) => void
}) {
  const status = itemEffectiveStatus(item, today)
  const lateDays = status === 'overdue' ? Math.abs(daysUntil(item.dueDate, today)) : 0
  const clickable = status !== 'paid' && onPay
  const actions = useUiActions()
  const rowClass = `inst-row lg-row${status === 'overdue' ? ' highlight-overdue' : ''}`
  const effectivePaidDate = paidDate || item.paidAt || item.dueDate

  const body = (
    <>
      <div className={`inst-num${status === 'paid' ? ' paid' : status === 'overdue' ? ' overdue' : ''}`}>
        {toFaDigits(item.index)}
      </div>
      <div className="inst-info">
        <div className="title" style={{ fontSize: 13, fontWeight: 700 }}>
          سررسید: {formatPersianDateFull(item.dueDate)}
        </div>
        <div className={`sub${status === 'overdue' ? ' danger' : ''}`} style={{ marginTop: 2 }}>
          {status === 'paid' ? (
            <span style={{ color: 'var(--hy-income)', fontWeight: 600, display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
              <span>✓ تاریخ پرداخت:</span>
              <strong>{formatPersianDateFull(effectivePaidDate)}</strong>
              {accountName ? <span style={{ color: 'var(--hy-text-tertiary)', fontWeight: 400 }}>· حساب: {accountName}</span> : null}
            </span>
          ) : status === 'overdue' ? (
            <span style={{ color: 'var(--hy-expense)', fontWeight: 600 }}>
              ⚠️ {toFaDigits(lateDays)} روز گذشته از موعد · معوق
            </span>
          ) : daysUntil(item.dueDate, today) <= 7 ? (
            <span style={{ color: '#d97706', fontWeight: 600 }}>
              ⏳ موعد سررسید نزدیک است ({daysUntil(item.dueDate, today) === 0 ? 'امروز' : `${toFaDigits(daysUntil(item.dueDate, today))} روز دیگر`})
            </span>
          ) : (
            <span style={{ color: 'var(--hy-text-tertiary)' }}>در انتظار موعد سررسید</span>
          )}
        </div>
      </div>
      <div className="inst-side">
        <div className="inst-amt">
          {formatRial(item.amount)}
          <span className="unit">ریال</span>
        </div>
        <span
          className={`badge ${status === 'paid' ? 'paid' : status === 'overdue' ? 'overdue' : daysUntil(item.dueDate, today) <= 7 ? 'due-soon' : 'pending'}`}
        >
          {status === 'paid' ? 'پرداخت‌شده' : status === 'overdue' ? 'معوق' : 'مانده'}
        </span>
        {status === 'paid' ? (
          <button className="cat-mini inst-unpay" type="button" onClick={() => actions?.unpayItem(item.id)}>
            برگشت به مانده
          </button>
        ) : null}
      </div>
    </>
  )

  return (
    <SwipeRow
      onEdit={
        actions
          ? () => {
              if (status === 'paid' && item.transactionId) actions.editTransaction(item.transactionId)
              else actions.editItem(item.id)
            }
          : undefined
      }
      onDelete={actions ? () => actions.deleteItem(item.id) : undefined}
    >
    {status === 'paid' ? (
      <div className={rowClass}>{body}</div>
    ) : (
    <button
      className={rowClass}
      type="button"
      onClick={() => {
        if (clickable) onPay(item.id)
      }}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      {body}
    </button>
    )}
    </SwipeRow>
  )
}
