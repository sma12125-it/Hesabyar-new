import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BankCardFace, formatPan, formatSheba } from './BankCardFace'
import { VaultRecover } from './VaultRecover'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import { isPlatformAuthenticatorAvailable, isWebAuthnSupported } from '../lib/applock'
import { toFaDigits, toWesternDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { isIncomingSharedAsset } from '../lib/userShare'
import type { BankCard } from '../types'

interface QuickCardsSheetProps {
  initialTab?: 'cards' | 'accounts'
  onClose: () => void
}

function FingerprintIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 16h.01" />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
  )
}

function copyToClipboard(text: string, label: string) {
  if (!text) return
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(text).then(
      () => notifyUser(`${label} کپی شد`),
      () => notifyUser('امکان کپی در حافظه موقت وجود ندارد'),
    )
  }
}

function buildFullCardCopyText(card: BankCard): string {
  const lines: string[] = []
  lines.push(`بانک ${card.bankName}`)
  if (card.pan) lines.push(`شماره کارت: ${formatPan(card.pan, true)}`)
  if (card.sheba) lines.push(`شبا: ${formatSheba(card.sheba)}`)
  if (card.accountNumber) lines.push(`شماره حساب: ${card.accountNumber}`)
  if (card.holder) lines.push(`به نام: ${card.holder}`)
  return lines.join('\n')
}

export function QuickCardsSheet({ initialTab = 'cards', onClose }: QuickCardsSheetProps) {
  const navigate = useNavigate()
  const { activeAccounts } = useStore()
  const {
    cards,
    unlocked,
    vaultConfigured,
    vaultBiometricEnabled,
    unlockVault,
    unlockVaultWithBiometric,
    enableVaultBiometric,
    lockVault,
    formatMoney,
    unitLabel,
  } = useExtras()

  const [tab, setTab] = useState<'cards' | 'accounts'>(initialTab)
  const [search, setSearch] = useState('')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)

  // Unlock states
  const [phrase, setPhrase] = useState('')
  const [showPasswordFallback, setShowPasswordFallback] = useState(!vaultBiometricEnabled)
  const [enrollBioAfterUnlock, setEnrollBioAfterUnlock] = useState(true)
  const [bioSupported, setBioSupported] = useState(false)
  const [busyBio, setBusyBio] = useState(false)
  const [busyPass, setBusyPass] = useState(false)
  const [enablingBio, setEnablingBio] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  const autoPromptedRef = useRef(false)

  useEffect(() => {
    let active = true
    async function detectBio() {
      if (!isWebAuthnSupported()) {
        if (active) setBioSupported(false)
        return
      }
      const platform = await isPlatformAuthenticatorAvailable()
      if (active) setBioSupported(platform || isWebAuthnSupported())
    }
    void detectBio()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Auto-trigger biometric prompt once when opening QuickCards on locked vault with biometric enabled
  useEffect(() => {
    if (
      tab === 'cards' &&
      vaultConfigured &&
      !unlocked &&
      vaultBiometricEnabled &&
      !autoPromptedRef.current
    ) {
      autoPromptedRef.current = true
      void handleBiometricUnlock(true)
    }
  }, [tab, vaultConfigured, unlocked, vaultBiometricEnabled])

  async function handleBiometricUnlock(isAuto = false) {
    setUnlockError(null)
    setBusyBio(true)
    try {
      await unlockVaultWithBiometric()
      notifyUser('گاوصندوق کارت با بیومتریک باز شد')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'احراز هویت بیومتریک ناموفق بود'
      if (!isAuto) {
        setUnlockError(msg)
      }
      setShowPasswordFallback(true)
    } finally {
      setBusyBio(false)
    }
  }

  async function handlePasswordUnlock() {
    if (!phrase.trim()) {
      setUnlockError('لطفاً رمز گاوصندوق را وارد کنید')
      return
    }
    setUnlockError(null)
    setBusyPass(true)
    try {
      await unlockVault(phrase)
      if (!vaultBiometricEnabled && enrollBioAfterUnlock && bioSupported) {
        try {
          await enableVaultBiometric(phrase)
          notifyUser('گاوصندوق باز شد و بازگشایی بیومتریک فعال گردید')
        } catch {
          notifyUser('گاوصندوق باز شد')
        }
      } else {
        notifyUser('گاوصندوق کارت باز شد')
      }
      setPhrase('')
    } catch {
      setUnlockError('رمز گاوصندوق نادرست است')
    } finally {
      setBusyPass(false)
    }
  }

  async function handleEnableBioWhileUnlocked() {
    setUnlockError(null)
    setEnablingBio(true)
    try {
      await enableVaultBiometric()
      notifyUser('بازگشایی گاوصندوق با اثر انگشت / چهره فعال شد')
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'فعال‌سازی بیومتریک ناموفق بود')
    } finally {
      setEnablingBio(false)
    }
  }

  const filteredCards = useMemo(() => {
    const q = toWesternDigits(search.trim().toLowerCase())
    if (!q) return cards
    return cards.filter((c) => {
      const panDigits = (c.pan || '').replace(/\D/g, '')
      return (
        (c.bankName || '').toLowerCase().includes(q) ||
        (c.holder || '').toLowerCase().includes(q) ||
        panDigits.includes(q.replace(/\D/g, '') || '__no_match__') ||
        (c.accountNumber || '').toLowerCase().includes(q)
      )
    })
  }, [cards, search])

  const filteredAccounts = useMemo(() => {
    const q = toWesternDigits(search.trim().toLowerCase())
    if (!q) return activeAccounts
    return activeAccounts.filter(
      (a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.accountNumber || '').toLowerCase().includes(q),
    )
  }, [activeAccounts, search])

  const activeCard: BankCard | null = useMemo(() => {
    if (filteredCards.length === 0) return null
    if (selectedCardId) {
      const found = filteredCards.find((c) => c.id === selectedCardId)
      if (found) return found
    }
    return filteredCards[0]
  }, [filteredCards, selectedCardId])

  const linkedAccount = useMemo(() => {
    if (!activeCard?.accountId) return null
    return activeAccounts.find((a) => a.id === activeCard.accountId) ?? null
  }, [activeCard, activeAccounts])

  const isRevealed = Boolean(activeCard && revealedId === activeCard.id)

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        className="glass-sheet sheet-sticky-cta"
        role="dialog"
        aria-modal="true"
        aria-label="دسترسی سریع کارت‌ها و حساب‌ها"
        style={{ maxWidth: 540, margin: '0 auto' }}
      >
        <div className="sheet-handle" />

        {/* Header */}
        <div className="sheet-header" style={{ paddingBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }} aria-hidden="true">💳</span>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 16, margin: 0, fontWeight: 800 }}>کیف کارت و حساب سریع</h1>
              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                دسترسی آنی به شماره کارت، شبا و حساب‌ها
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {unlocked && vaultConfigured ? (
              <button
                type="button"
                className="cat-mini"
                onClick={() => {
                  lockVault()
                  setRevealedId(null)
                  notifyUser('گاوصندوق قفل شد')
                }}
                style={{ minHeight: 36, padding: '0 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                title="قفل کردن مجدد گاوصندوق"
              >
                قفل
              </button>
            ) : null}
            <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
              ✕
            </button>
          </div>
        </div>

        {/* Segmented Switcher: Cards vs Accounts */}
        <div className="seg" role="tablist" style={{ margin: '0 0 12px' }}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'cards'}
            className={`seg-btn${tab === 'cards' ? ' active' : ''}`}
            onClick={() => {
              setTab('cards')
              setSearch('')
            }}
            style={{ minHeight: 40, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            کارت‌های بانکی {unlocked || !vaultConfigured ? `(${toFaDigits(cards.length)})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'accounts'}
            className={`seg-btn${tab === 'accounts' ? ' active' : ''}`}
            onClick={() => {
              setTab('accounts')
              setSearch('')
            }}
            style={{ minHeight: 40, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            حساب‌ها ({toFaDigits(activeAccounts.length)})
          </button>
        </div>

        {/* Body */}
        <div className="sheet-body-scroll" style={{ paddingBottom: 16 }}>
          {tab === 'cards' ? (
            <>
              {!vaultConfigured ? (
                <div className="empty-state" style={{ padding: '24px 16px' }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }} aria-hidden="true">🔐</div>
                  <h3 style={{ fontSize: 14, margin: '0 0 6px', fontWeight: 800 }}>
                    گاوصندوق کارت هنوز تنظیم نشده است
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--hy-text-secondary)', margin: '0 0 14px', lineHeight: 1.6 }}>
                    برای نگهداری امن کارت‌های بانکی و دسترسی سریع با اثر انگشت یا چهره، اولین کارت خود را ثبت کنید.
                  </p>
                  <button
                    type="button"
                    className="cta-confirm"
                    style={{ minHeight: 44, padding: '0 18px', width: 'auto', fontSize: 13 }}
                    onClick={() => {
                      onClose()
                      navigate('/accounts')
                      window.setTimeout(() => window.dispatchEvent(new CustomEvent('hy-new-card')), 120)
                    }}
                  >
                    ثبت اولین کارت بانکی
                  </button>
                </div>
              ) : !unlocked ? (
                /* Locked Vault Panel with 1-Tap Biometric + Password Fallback */
                <div
                  style={{
                    padding: '18px 16px',
                    borderRadius: 18,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.09)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 18,
                        margin: '0 auto 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: vaultBiometricEnabled
                          ? 'rgba(15, 118, 110, 0.22)'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: vaultBiometricEnabled ? 'var(--hy-teal, #14b8a6)' : 'var(--hy-text)',
                      }}
                    >
                      <FingerprintIcon size={28} />
                    </div>
                    <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
                      گاوصندوق کارت قفل است
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--hy-text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
                      {vaultBiometricEnabled
                        ? 'برای نمایش سریع کارت‌ها، اثر انگشت یا چهره خود را تأیید کنید.'
                        : 'رمز گاوصندوق را وارد کنید تا کارت‌ها نمایش داده شوند.'}
                    </p>
                  </div>

                  {unlockError ? (
                    <div className="banner error" style={{ fontSize: 12 }}>
                      <span>{unlockError}</span>
                    </div>
                  ) : null}

                  {vaultBiometricEnabled ? (
                    <button
                      type="button"
                      className="cta-confirm"
                      disabled={busyBio}
                      onClick={() => void handleBiometricUnlock(false)}
                      style={{
                        minHeight: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      <FingerprintIcon size={20} />
                      <span>{busyBio ? 'در حال بررسی بیومتریک…' : 'باز کردن با اثر انگشت / چهره'}</span>
                    </button>
                  ) : null}

                  {vaultBiometricEnabled && !showPasswordFallback ? (
                    <button
                      type="button"
                      className="link"
                      onClick={() => setShowPasswordFallback(true)}
                      style={{ alignSelf: 'center', minHeight: 36, fontSize: 12 }}
                    >
                      ورود با رمز گاوصندوق
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
                      <div className="field-chip" style={{ minHeight: 46 }}>
                        <input
                          className="field-input"
                          type="password"
                          autoFocus={!vaultBiometricEnabled}
                          placeholder="رمز گاوصندوق کارت‌ها"
                          value={phrase}
                          onChange={(e) => {
                            setPhrase(e.target.value)
                            setUnlockError(null)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handlePasswordUnlock()
                          }}
                        />
                        <button
                          type="button"
                          className="cat-mini"
                          disabled={busyPass}
                          onClick={() => void handlePasswordUnlock()}
                          style={{ minHeight: 38, padding: '0 14px', fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          {busyPass ? '…' : 'باز کردن'}
                        </button>
                      </div>

                      {!vaultBiometricEnabled && bioSupported ? (
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                            color: 'var(--hy-text-secondary)',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            minHeight: 36,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={enrollBioAfterUnlock}
                            onChange={(e) => setEnrollBioAfterUnlock(e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: 'var(--hy-teal, #0f766e)' }}
                          />
                          <span>فعال‌سازی بازگشایی با اثر انگشت / چهره برای دفعات بعد</span>
                        </label>
                      ) : null}

                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          className="link"
                          onClick={() => setForgot((v) => !v)}
                          style={{ fontSize: 12, minHeight: 32 }}
                        >
                          رمز گاوصندوق را فراموش کرده‌ام
                        </button>
                      </div>

                      {forgot ? (
                        <VaultRecover
                          onDone={(code) => {
                            setRecoveryCode(code)
                            setForgot(false)
                            notifyUser('رمز گاوصندوق بازیابی و باز شد')
                          }}
                        />
                      ) : null}

                      {recoveryCode ? (
                        <div style={{ marginTop: 4 }}>
                          <p className="sheet-sub">کد بازیابی جدید:</p>
                          <p className="recovery-code">{recoveryCode}</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                /* Unlocked Quick Cards View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Quick Biometric Enrollment Offer if unlocked & not yet enabled */}
                  {!vaultBiometricEnabled && bioSupported ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 14,
                        background: 'rgba(15, 118, 110, 0.12)',
                        border: '1px solid rgba(15, 118, 110, 0.28)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ color: 'var(--hy-teal, #14b8a6)', flexShrink: 0 }}>
                          <FingerprintIcon size={18} />
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--hy-text)', lineHeight: 1.4 }}>
                          دفعه بعد بدون رمز و با بیومتریک باز شود؟
                        </span>
                      </div>
                      <button
                        type="button"
                        className="cat-mini"
                        disabled={enablingBio}
                        onClick={() => void handleEnableBioWhileUnlocked()}
                        style={{
                          minHeight: 36,
                          padding: '0 12px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {enablingBio ? '…' : 'فعال‌سازی'}
                      </button>
                    </div>
                  ) : null}

                  {unlockError ? (
                    <div className="banner error" style={{ fontSize: 12 }}>
                      <span>{unlockError}</span>
                    </div>
                  ) : null}

                  {cards.length === 0 ? (
                    <div className="empty-state" style={{ padding: '24px 16px' }}>
                      <div style={{ fontSize: 30, marginBottom: 6 }} aria-hidden="true">💳</div>
                      <h3 style={{ fontSize: 14, margin: '0 0 6px', fontWeight: 700 }}>
                        هنوز کارتی در گاوصندوق ذخیره نشده است
                      </h3>
                      <button
                        type="button"
                        className="cta-confirm"
                        style={{ minHeight: 44, padding: '0 18px', width: 'auto', marginTop: 8, fontSize: 13 }}
                        onClick={() => {
                          onClose()
                          navigate('/accounts')
                          window.setTimeout(() => window.dispatchEvent(new CustomEvent('hy-new-card')), 120)
                        }}
                      >
                        افزودن کارت جدید
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Instant search when > 2 cards */}
                      {cards.length > 2 ? (
                        <input
                          className="field-input"
                          placeholder="جستجوی بانک، صاحب کارت یا ۴ رقم آخر…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          style={{ minHeight: 42, fontSize: 13 }}
                        />
                      ) : null}

                      {/* Horizontal Card Quick Switcher Strip */}
                      {filteredCards.length > 1 ? (
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            overflowX: 'auto',
                            paddingBottom: 4,
                            scrollbarWidth: 'none',
                          }}
                          role="tablist"
                          aria-label="انتخاب سریع کارت"
                        >
                          {filteredCards.map((c) => {
                            const selected = activeCard?.id === c.id
                            const last4 = (c.pan || '').replace(/\D/g, '').slice(-4)
                            return (
                              <button
                                key={c.id}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                onClick={() => {
                                  setSelectedCardId(c.id)
                                  setRevealedId(null)
                                }}
                                style={{
                                  minHeight: 42,
                                  padding: '6px 12px',
                                  borderRadius: 12,
                                  border: selected
                                    ? '1.5px solid var(--hy-teal, #0f766e)'
                                    : '1px solid rgba(255, 255, 255, 0.12)',
                                  background: selected
                                    ? 'rgba(15, 118, 110, 0.2)'
                                    : 'rgba(255, 255, 255, 0.04)',
                                  color: 'var(--hy-text)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  fontSize: 12,
                                  fontWeight: selected ? 800 : 600,
                                }}
                              >
                                <span>{c.bankName}</span>
                                {last4 ? (
                                  <span
                                    dir="ltr"
                                    style={{
                                      fontFamily: 'monospace',
                                      fontVariantNumeric: 'tabular-nums',
                                      opacity: 0.78,
                                      fontSize: 11,
                                    }}
                                  >
                                    · {toFaDigits(last4)}
                                  </span>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}

                      {/* Focused Active Card Display & 1-Tap Copy Bar */}
                      {activeCard ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <BankCardFace card={activeCard} revealed={isRevealed} />

                          {/* Clean Unboxed Metadata Line */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 8,
                              padding: '0 4px',
                              fontSize: 12,
                              color: 'var(--hy-text-secondary)',
                            }}
                          >
                            <div>
                              {linkedAccount ? (
                                <>
                                  <span>حساب متصل: {linkedAccount.name}</span>
                                  <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
                                  <strong
                                    style={{
                                      color: 'var(--hy-teal)',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {formatMoney(linkedAccount.balance, false)} {unitLabel}
                                  </strong>
                                </>
                              ) : isIncomingSharedAsset(activeCard) ? (
                                <span>کارت مشترک از طرف {activeCard.ownerDisplayName || 'کاربر'}</span>
                              ) : (
                                <span>صاحب کارت: {activeCard.holder}</span>
                              )}
                            </div>

                            <button
                              type="button"
                              className="link"
                              onClick={() => setRevealedId(isRevealed ? null : activeCard.id)}
                              style={{ fontSize: 12, fontWeight: 700, minHeight: 32 }}
                            >
                              {isRevealed ? 'پوشاندن شماره و CVV' : 'نمایش شماره و CVV'}
                            </button>
                          </div>

                          {/* 1-Tap Copy Actions Grid (44px+ touch targets) */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                              gap: 8,
                            }}
                          >
                            <button
                              type="button"
                              className="cta-confirm"
                              disabled={!activeCard.pan}
                              onClick={() => copyToClipboard(activeCard.pan.replace(/\D/g, ''), 'شماره کارت')}
                              style={{
                                minHeight: 44,
                                fontSize: 12,
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                                padding: '0 12px',
                              }}
                            >
                              کپی شماره کارت
                            </button>

                            <button
                              type="button"
                              className="home-pill ghost"
                              onClick={() => copyToClipboard(buildFullCardCopyText(activeCard), 'مشخصات کامل کارت')}
                              style={{
                                minHeight: 44,
                                fontSize: 12,
                                fontWeight: 700,
                                justifyContent: 'center',
                                whiteSpace: 'nowrap',
                                padding: '0 12px',
                              }}
                            >
                              کپی همه مشخصات
                            </button>

                            {activeCard.sheba ? (
                              <button
                                type="button"
                                className="home-pill ghost"
                                onClick={() => copyToClipboard(activeCard.sheba.replace(/\s/g, ''), 'شماره شبا')}
                                style={{
                                  minHeight: 44,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  justifyContent: 'center',
                                  whiteSpace: 'nowrap',
                                  padding: '0 12px',
                                }}
                              >
                                کپی شبا
                              </button>
                            ) : null}

                            {activeCard.accountNumber ? (
                              <button
                                type="button"
                                className="home-pill ghost"
                                onClick={() => copyToClipboard(activeCard.accountNumber!, 'شماره حساب')}
                                style={{
                                  minHeight: 44,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  justifyContent: 'center',
                                  whiteSpace: 'nowrap',
                                  padding: '0 12px',
                                }}
                              >
                                کپی شماره حساب
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="empty-state" style={{ padding: '20px 12px' }}>
                          <p style={{ fontSize: 13, margin: 0, color: 'var(--hy-text-secondary)' }}>
                            کارتی مطابق جستجو یافت نشد.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Quick Accounts Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeAccounts.length > 3 ? (
                <input
                  className="field-input"
                  placeholder="جستجوی نام یا شماره حساب…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ minHeight: 42, fontSize: 13 }}
                />
              ) : null}

              {filteredAccounts.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 16px' }}>
                  <p style={{ fontSize: 13, margin: 0, color: 'var(--hy-text-secondary)' }}>
                    حسابی برای نمایش وجود ندارد.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredAccounts.map((acc) => {
                    const cardForAcc = acc.cardId ? cards.find((c) => c.id === acc.cardId) : undefined
                    const last4 = cardForAcc?.pan ? cardForAcc.pan.replace(/\D/g, '').slice(-4) : ''
                    return (
                      <div
                        key={acc.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onClose()
                            navigate(`/accounts/${acc.id}`)
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            textAlign: 'right',
                            color: 'inherit',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {acc.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--hy-text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>{acc.type === 'cash' ? 'نقدی' : 'بانکی'}</span>
                            {acc.accountNumber ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span dir="ltr" style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                                  {acc.accountNumber}
                                </span>
                              </>
                            ) : null}
                            {last4 ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span dir="ltr" style={{ fontFamily: 'monospace' }}>
                                  کارت {toFaDigits(last4)}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <div style={{ textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--hy-teal)' }}>
                              {formatMoney(acc.balance, false)}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>{unitLabel}</div>
                          </div>

                          {acc.accountNumber ? (
                            <button
                              type="button"
                              className="cat-mini"
                              onClick={() => copyToClipboard(acc.accountNumber!, 'شماره حساب')}
                              style={{ minHeight: 38, padding: '0 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                            >
                              کپی
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="sheet-footer"
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            type="button"
            className="home-pill ghost"
            onClick={() => {
              onClose()
              navigate('/accounts')
            }}
            style={{ flex: 1.4, minHeight: 44, justifyContent: 'center', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}
          >
            مدیریت کامل حساب‌ها و کارت‌ها
          </button>
          <button
            type="button"
            className="home-pill ghost"
            onClick={onClose}
            style={{ flex: 0.7, minHeight: 44, justifyContent: 'center', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}
          >
            بستن
          </button>
        </div>
      </div>
    </>
  )
}
