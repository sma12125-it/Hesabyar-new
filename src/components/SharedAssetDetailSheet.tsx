import { useState } from 'react'
import { toFaDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { getStableUserId, removeSharedUser } from '../lib/userShare'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import type { Account, BankCard } from '../types'

export interface SharedAssetDetailSheetProps {
  kind: 'card' | 'account'
  account?: Account
  card?: BankCard
  onClose: () => void
}

export function SharedAssetDetailSheet({
  kind,
  account,
  card,
  onClose,
}: SharedAssetDetailSheetProps) {
  const { formatMoney, unitLabel, deleteSharedCard } = useExtras()
  const { removeSharedAccount } = useStore()
  const [leaving, setLeaving] = useState(false)

  const title = kind === 'card' ? (card?.bankName || 'کارت بانکی مشترک') : (account?.name || 'حساب مشترک')
  const ownerName = kind === 'card' ? (card?.ownerDisplayName || 'کاربر حسابیار') : (account?.ownerDisplayName || 'کاربر حسابیار')
  const ownerId = kind === 'card' ? card?.ownerUserId : account?.ownerUserId
  const shareId = kind === 'card' ? card?.shareId : account?.shareId
  const assetId = kind === 'card' ? card?.id : account?.id

  const copyText = (txt?: string, label?: string) => {
    if (!txt) return
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(txt)
      notifyUser(`${label || 'متن'} کپی شد`)
    }
  }

  const handleLeaveShare = async () => {
    if (!window.confirm(`آیا مطمئن هستید که می‌خواهید از اشتراک «${title}» خارج شوید؟`)) {
      return
    }

    setLeaving(true)
    try {
      const myId = getStableUserId()
      if (assetId) {
        await removeSharedUser(kind, assetId, myId)
      }

      if (kind === 'account' && (shareId || assetId)) {
        await removeSharedAccount(shareId || assetId!)
      } else if (kind === 'card' && (shareId || assetId)) {
        await deleteSharedCard(shareId || assetId!)
      }

      notifyUser(`شما از اشتراک «${title}» خارج شدید`)
      onClose()
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'خطا در خروج از اشتراک')
    } finally {
      setLeaving(false)
    }
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        className="glass-sheet sheet-sticky-cta"
        role="dialog"
        aria-label={`مشخصات اشتراک ${title}`}
        style={{ maxWidth: 500, margin: '0 auto' }}
      >
        <div className="sheet-handle" />

        {/* Header */}
        <div className="sheet-header" style={{ paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>{kind === 'card' ? '💳' : '🏦'}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h1 style={{ fontSize: 16, margin: 0, fontWeight: 800 }}>{title}</h1>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(16, 185, 129, 0.16)',
                    color: 'var(--hy-income, #10b981)',
                    fontWeight: 800,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  🤝 حساب مشترک
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                به اشتراک گذاشته شده توسط {ownerName}
              </div>
            </div>
          </div>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="sheet-body-scroll" style={{ paddingBottom: 20 }}>
          {/* Owner Info Box */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--hy-text)', marginBottom: 6 }}>
              👤 مشخصات اشتراک‌گذارنده (مالک):
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{ownerName}</span>
              {ownerId ? (
                <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)', fontFamily: 'monospace' }}>
                  ID: {ownerId}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 11, color: 'var(--hy-income, #10b981)', marginTop: 4 }}>
              ✓ وضعیت دسترسی: فعال و تأیید شده
            </div>
          </div>

          {/* Account or Card Details */}
          {kind === 'account' && account ? (
            <div
              style={{
                padding: '14px',
                borderRadius: 16,
                background: 'var(--glass-chrome)',
                border: 'var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>نام حساب</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{account.name}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>موجودی حساب</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--hy-teal)' }}>
                  {formatMoney(account.balance, false)} <span style={{ fontSize: 11 }}>{unitLabel}</span>
                </span>
              </div>

              {account.accountNumber ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>شماره حساب</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }} dir="ltr">
                      {account.accountNumber}
                    </span>
                    <button
                      type="button"
                      className="cat-mini"
                      onClick={() => copyText(account.accountNumber, 'شماره حساب')}
                      style={{ padding: '2px 6px', fontSize: 10 }}
                    >
                      کپی
                    </button>
                  </div>
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>نوع حساب</span>
                <span style={{ fontSize: 12 }}>{account.type === 'cash' ? 'حساب نقدی' : 'حساب بانکی'}</span>
              </div>
            </div>
          ) : null}

          {kind === 'card' && card ? (
            <div
              style={{
                padding: '14px',
                borderRadius: 16,
                background: 'var(--glass-chrome)',
                border: 'var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>بانک صادرکننده</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{card.bankName}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>صاحب کارت</span>
                <span style={{ fontSize: 13 }}>{card.holder}</span>
              </div>

              {card.pan ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>شماره کارت</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 800, letterSpacing: 1 }} dir="ltr">
                      {card.pan.replace(/(\d{4})/g, '$1 ').trim()}
                    </span>
                    <button
                      type="button"
                      className="cat-mini"
                      onClick={() => copyText(card.pan, 'شماره کارت')}
                      style={{ padding: '2px 6px', fontSize: 10 }}
                    >
                      کپی
                    </button>
                  </div>
                </div>
              ) : null}

              {card.sheba ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>شماره شبا</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontFamily: 'monospace' }} dir="ltr">
                      {card.sheba}
                    </span>
                    <button
                      type="button"
                      className="cat-mini"
                      onClick={() => copyText(card.sheba, 'شماره شبا')}
                      style={{ padding: '2px 6px', fontSize: 10 }}
                    >
                      کپی
                    </button>
                  </div>
                </div>
              ) : null}

              {card.expiry ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>انقضا</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace' }} dir="ltr">
                    {toFaDigits(card.expiry)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Notice about permissions */}
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 12,
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              fontSize: 11,
              color: 'var(--hy-text-secondary)',
              lineHeight: 1.6,
            }}
          >
            💡 این مورد از طریق اشتراک هوشمند حسابیار در دسترس شما قرار گرفته است. در صورت نیاز به لغو اتصال، می‌توانید از دکمه زیر استفاده کنید.
          </div>
        </div>

        {/* Footer */}
        <div
          className="sheet-footer"
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            type="button"
            className="cat-mini danger"
            disabled={leaving}
            onClick={() => void handleLeaveShare()}
            style={{ flex: 1, height: 42, fontSize: 12, fontWeight: 700 }}
          >
            {leaving ? 'در حال خروج…' : '✕ خروج از اشتراک'}
          </button>
          <button
            type="button"
            className="home-pill ghost"
            onClick={onClose}
            style={{ flex: 1, height: 42, justifyContent: 'center', fontWeight: 700 }}
          >
            بستن
          </button>
        </div>
      </div>
    </>
  )
}
