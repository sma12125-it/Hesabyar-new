import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatPersianDate } from '../lib/dates'
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
  const { plans, items, archiveInstallmentPlan, restoreInstallmentPlan } = useStore()
  const actions = useUiActions()
  const [menu, setMenu] = useState(false)
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
  const nextDueLabel = next ? formatPersianDate(next.dueDate) : '—'

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
      </div>
      <div className="inst-list">
        {planItems.map((item) => (
          <ItemRow key={item.id} item={item} today={today} onPay={canPay ? onPay : undefined} />
        ))}
      </div>
    </div>
  )
}

function ItemRow({
  item,
  today,
  onPay,
}: {
  item: InstallmentItem
  today: string
  onPay?: (itemId: string) => void
}) {
  const status = itemEffectiveStatus(item, today)
  const lateDays = status === 'overdue' ? Math.abs(daysUntil(item.dueDate, today)) : 0
  const clickable = status !== 'paid' && onPay
  const actions = useUiActions()
  const rowClass = `inst-row lg-row${status === 'overdue' ? ' highlight-overdue' : ''}`

  const body = (
    <>
      <div className={`inst-num${status === 'paid' ? ' paid' : status === 'overdue' ? ' overdue' : ''}`}>
        {toFaDigits(item.index)}
      </div>
      <div className="inst-info">
        <div className="title">سررسید {formatPersianDate(item.dueDate)}</div>
        <div className={`sub${status === 'overdue' ? ' danger' : ''}`}>
          {status === 'paid'
            ? 'پرداخت‌شده'
            : status === 'overdue'
              ? `${toFaDigits(lateDays)} روز گذشته · معوق`
              : daysUntil(item.dueDate, today) <= 7
                ? 'مانده · به‌زودی'
                : 'مانده'}
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
