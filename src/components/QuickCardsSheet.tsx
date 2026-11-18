import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BankCardFace, formatPan, formatSheba } from './BankCardFace'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import { toFaDigits, toWesternDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { isIncomingSharedAsset } from '../lib/userShare'
import type { BankCard } from '../types'

interface QuickCardsSheetProps {
  initialTab?: 'cards' | 'accounts'
  onClose: () => void
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        flexShrink: 0,
      }}
    >
      <path d="m6 9 6 6 6-6" />
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

async function shareCardText(title: string, text: string, fallbackLabel: string) {
  if (!text) return
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text })
      return
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }
  copyToClipboard(text, `${fallbackLabel} برای ارسال`)
}

function buildPanShareText(card: BankCard): string {
  const lines: string[] = []
  lines.push(`بانک ${card.bankName}`)
  if (card.pan) lines.push(`شماره کارت: ${formatPan(card.pan, true)}`)
  if (card.holder) lines.push(`به نام: ${card.holder}`)
  return lines.join('\n')
}

function buildAccountShebaShareText(card: BankCard): string {
  const lines: string[] = []
  lines.push(`بانک ${card.bankName}`)
  if (card.sheba) lines.push(`شبا: ${formatSheba(card.sheba)}`)
  if (card.accountNumber) lines.push(`شماره حساب: ${card.accountNumber}`)
  if (card.holder) lines.push(`به نام: ${card.holder}`)
  return lines.join('\n')
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

interface CopyOption {
  id: string
  label: string
  preview: string
  value: string
  toastLabel: string
}

function getCardCopyOptions(card: BankCard): CopyOption[] {
  const options: CopyOption[] = []
  const panDigits = (card.pan || '').replace(/\D/g, '')
  if (panDigits) {
    options.push({
      id: 'pan',
      label: 'شماره کارت',
      preview: formatPan(panDigits, false),
      value: panDigits,
      toastLabel: 'شماره کارت',
    })
  }
  if (card.sheba) {
    const cleanSheba = card.sheba.replace(/\s/g, '')
    options.push({
      id: 'sheba',
      label: 'شماره شبا',
      preview: `${cleanSheba.slice(0, 6)}…${cleanSheba.slice(-4)}`,
      value: cleanSheba,
      toastLabel: 'شماره شبا',
    })
  }
  if (card.accountNumber) {
    options.push({
      id: 'accountNumber',
      label: 'شماره حساب',
      preview: toFaDigits(card.accountNumber),
      value: card.accountNumber,
      toastLabel: 'شماره حساب',
    })
  }
  if (card.expiry || card.cvv) {
    const parts: string[] = []
    if (card.expiry) parts.push(`انقضا: ${card.expiry}`)
    if (card.cvv) parts.push(`CVV2: ${card.cvv}`)
    options.push({
      id: 'security',
      label: 'تاریخ انقضا و CVV2',
      preview: card.expiry ? toFaDigits(card.expiry) : '•••',
      value: parts.join(' | '),
      toastLabel: 'تاریخ انقضا و CVV2',
    })
  }
  if (card.holder) {
    options.push({
      id: 'holder',
      label: 'نام صاحب کارت',
      preview: card.holder,
      value: card.holder,
      toastLabel: 'نام صاحب کارت',
    })
  }
  options.push({
    id: 'all',
    label: 'همه مشخصات کارت (متن کامل)',
    preview: 'بانک، شماره کارت، شبا و نام',
    value: buildFullCardCopyText(card),
    toastLabel: 'مشخصات کامل کارت',
  })
  return options
}

export function QuickCardsSheet({ initialTab = 'cards', onClose }: QuickCardsSheetProps) {
  const navigate = useNavigate()
  const { activeAccounts } = useStore()
  const { cards, unlocked, syncVaultWithAccountPassword, formatMoney, unitLabel } = useExtras()

  const [tab, setTab] = useState<'cards' | 'accounts'>(initialTab)
  const [search, setSearch] = useState('')
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<{ cardId: string; kind: 'copy' | 'share' } | null>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)

  const triedAutoSyncRef = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!unlocked && !triedAutoSyncRef.current) {
      triedAutoSyncRef.current = true
      void syncVaultWithAccountPassword()
    }
  }, [unlocked, syncVaultWithAccountPassword])

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
                روی هر کارت بزنید تا تصویر، کپی انتخابی و اشتراک‌گذاری باز شود
              </div>
            </div>
          </div>

          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">
            ✕
          </button>
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
            style={{ minHeight: 42, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            کارت‌های بانکی ({toFaDigits(cards.length)})
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
            style={{ minHeight: 42, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            حساب‌ها ({toFaDigits(activeAccounts.length)})
          </button>
        </div>

        {/* Body */}
        <div className="sheet-body-scroll" style={{ paddingBottom: 16 }}>
          {tab === 'cards' ? (
            cards.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <div style={{ fontSize: 30, marginBottom: 6 }} aria-hidden="true">💳</div>
                <h3 style={{ fontSize: 14, margin: '0 0 6px', fontWeight: 700 }}>
                  هنوز کارتی ثبت نشده است
                </h3>
                <p style={{ fontSize: 12, color: 'var(--hy-text-secondary)', margin: '0 0 12px', lineHeight: 1.6 }}>
                  کارت‌های بانکی خود را ثبت کنید تا همیشه با یک لمس در دسترس باشند.
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
                  افزودن اولین کارت بانکی
                </button>
              </div>
            ) : (
              /* Accordion List of Cards */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cards.length > 2 ? (
                  <input
                    className="field-input"
                    placeholder="جستجوی بانک، صاحب کارت یا ۴ رقم آخر…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ minHeight: 42, fontSize: 13 }}
                  />
                ) : null}

                {filteredCards.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 12px' }}>
                    <p style={{ fontSize: 13, margin: 0, color: 'var(--hy-text-secondary)' }}>
                      کارتی مطابق جستجو یافت نشد.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredCards.map((card) => {
                      const isOpen = expandedCardId === card.id
                      const isRevealed = revealedId === card.id
                      const last4 = (card.pan || '').replace(/\D/g, '').slice(-4)
                      const linkedAccount = card.accountId
                        ? activeAccounts.find((a) => a.id === card.accountId) ?? null
                        : null
                      const incomingShared = isIncomingSharedAsset(card)
                      const isCopyOpen = openMenu?.cardId === card.id && openMenu.kind === 'copy'
                      const isShareOpen = openMenu?.cardId === card.id && openMenu.kind === 'share'
                      const copyOptions = isOpen ? getCardCopyOptions(card) : []

                      return (
                        <div
                          key={card.id}
                          style={{
                            borderRadius: 16,
                            background: isOpen ? 'rgba(255, 255, 255, 0.055)' : 'rgba(255, 255, 255, 0.035)',
                            border: isOpen
                              ? '1px solid rgba(20, 184, 166, 0.45)'
                              : '1px solid rgba(255, 255, 255, 0.08)',
                            overflow: 'hidden',
                            transition: 'border-color 180ms ease, background 180ms ease',
                          }}
                        >
                          {/* Accordion Header Row */}
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => {
                              setExpandedCardId(isOpen ? null : card.id)
                              setOpenMenu(null)
                              if (isOpen) setRevealedId(null)
                            }}
                            style={{
                              width: '100%',
                              minHeight: 62,
                              padding: '12px 14px',
                              background: 'none',
                              border: 'none',
                              color: 'var(--hy-text)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              textAlign: 'right',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                              {/* Miniature Card Swatch */}
                              <div
                                aria-hidden="true"
                                style={{
                                  width: 42,
                                  height: 28,
                                  borderRadius: 7,
                                  background:
                                    card.color || 'linear-gradient(135deg, #0f766e 0%, #1e1b4b 100%)',
                                  border: '1px solid rgba(255, 255, 255, 0.22)',
                                  flexShrink: 0,
                                  position: 'relative',
                                  overflow: 'hidden',
                                }}
                              >
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: 6,
                                    right: 5,
                                    width: 8,
                                    height: 6,
                                    borderRadius: 2,
                                    background: 'rgba(255, 215, 130, 0.85)',
                                  }}
                                />
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: 14,
                                    fontWeight: 800,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {card.bankName}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--hy-text-secondary)',
                                    marginTop: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  {last4 ? (
                                    <span
                                      dir="ltr"
                                      style={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
                                    >
                                      •••• {toFaDigits(last4)}
                                    </span>
                                  ) : null}
                                  {card.holder ? (
                                    <>
                                      {last4 ? <span aria-hidden="true">·</span> : null}
                                      <span
                                        style={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: 130,
                                        }}
                                      >
                                        {card.holder}
                                      </span>
                                    </>
                                  ) : null}
                                  {incomingShared ? (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span style={{ color: 'var(--hy-teal)' }}>مشترک</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              {linkedAccount ? (
                                <div style={{ textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--hy-teal)' }}>
                                    {formatMoney(linkedAccount.balance, false)}
                                  </div>
                                  <div style={{ fontSize: 10, color: 'var(--hy-text-secondary)' }}>{unitLabel}</div>
                                </div>
                              ) : null}
                              <span style={{ color: 'var(--hy-text-secondary)', display: 'inline-flex' }}>
                                <ChevronIcon open={isOpen} />
                              </span>
                            </div>
                          </button>

                          {/* Accordion Expanded Content */}
                          {isOpen ? (
                            <div
                              style={{
                                padding: '0 12px 14px',
                                borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                              }}
                            >
                              <div style={{ paddingTop: 12 }}>
                                <BankCardFace card={card} revealed={isRevealed} />
                              </div>

                              {/* Info & Reveal Toggle */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                  padding: '0 2px',
                                  fontSize: 12,
                                  color: 'var(--hy-text-secondary)',
                                }}
                              >
                                <div>
                                  {linkedAccount ? (
                                    <>
                                      <span>حساب متصل: {linkedAccount.name}</span>
                                      <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
                                      <strong style={{ color: 'var(--hy-teal)', fontVariantNumeric: 'tabular-nums' }}>
                                        {formatMoney(linkedAccount.balance, false)} {unitLabel}
                                      </strong>
                                    </>
                                  ) : incomingShared ? (
                                    <span>کارت مشترک از طرف {card.ownerDisplayName || 'کاربر'}</span>
                                  ) : (
                                    <span>صاحب کارت: {card.holder}</span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  className="link"
                                  onClick={() => setRevealedId(isRevealed ? null : card.id)}
                                  style={{ fontSize: 12, fontWeight: 700, minHeight: 34 }}
                                >
                                  {isRevealed ? 'پوشاندن شماره و CVV' : 'نمایش شماره و CVV'}
                                </button>
                              </div>

                              {/* Single Copy Button + Share Card Info Button */}
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                  gap: 8,
                                }}
                              >
                                <button
                                  type="button"
                                  className={isCopyOpen ? 'cta-confirm' : 'home-pill ghost'}
                                  aria-expanded={isCopyOpen}
                                  onClick={() =>
                                    setOpenMenu(isCopyOpen ? null : { cardId: card.id, kind: 'copy' })
                                  }
                                  style={{
                                    minHeight: 44,
                                    fontSize: 12,
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    whiteSpace: 'nowrap',
                                    padding: '0 12px',
                                  }}
                                >
                                  <span>کپی اطلاعات</span>
                                  <ChevronIcon open={isCopyOpen} />
                                </button>

                                <button
                                  type="button"
                                  className={isShareOpen ? 'cta-confirm' : 'home-pill ghost'}
                                  aria-expanded={isShareOpen}
                                  onClick={() =>
                                    setOpenMenu(isShareOpen ? null : { cardId: card.id, kind: 'share' })
                                  }
                                  style={{
                                    minHeight: 44,
                                    fontSize: 12,
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    whiteSpace: 'nowrap',
                                    padding: '0 12px',
                                  }}
                                >
                                  <span>اشتراک‌گذاری</span>
                                  <ChevronIcon open={isShareOpen} />
                                </button>
                              </div>

                              {/* Unified Copy Selection List */}
                              {isCopyOpen ? (
                                <div
                                  role="menu"
                                  aria-label="انتخاب بخش مورد نظر برای کپی"
                                  style={{
                                    borderRadius: 14,
                                    background: 'rgba(0, 0, 0, 0.24)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: '8px 12px',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: 'var(--hy-text-secondary)',
                                      borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                                    }}
                                  >
                                    کدام بخش از اطلاعات کارت کپی شود؟
                                  </div>
                                  {copyOptions.map((opt, idx) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        copyToClipboard(opt.value, opt.toastLabel)
                                        setOpenMenu(null)
                                      }}
                                      style={{
                                        width: '100%',
                                        minHeight: 44,
                                        padding: '10px 12px',
                                        background: 'none',
                                        border: 'none',
                                        borderTop:
                                          idx > 0 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                                        color: 'var(--hy-text)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 10,
                                        textAlign: 'right',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <span style={{ fontSize: 12, fontWeight: 700 }}>{opt.label}</span>
                                      <span
                                        dir="ltr"
                                        style={{
                                          fontSize: 11,
                                          color: 'var(--hy-text-secondary)',
                                          fontVariantNumeric: 'tabular-nums',
                                          maxWidth: 165,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {opt.preview}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              ) : null}

                              {/* Share Card Information Options List */}
                              {isShareOpen ? (
                                <div
                                  role="menu"
                                  aria-label="گزینه‌های اشتراک‌گذاری اطلاعات کارت"
                                  style={{
                                    borderRadius: 14,
                                    background: 'rgba(0, 0, 0, 0.24)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      padding: '8px 12px',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: 'var(--hy-text-secondary)',
                                      borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                                    }}
                                  >
                                    انتخاب روش اشتراک‌گذاری اطلاعات کارت
                                  </div>

                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      void shareCardText(
                                        `شماره کارت ${card.bankName}`,
                                        buildPanShareText(card),
                                        'شماره کارت و نام',
                                      )
                                      setOpenMenu(null)
                                    }}
                                    style={{
                                      width: '100%',
                                      minHeight: 44,
                                      padding: '10px 12px',
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--hy-text)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 10,
                                      textAlign: 'right',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                                      ارسال شماره کارت و نام صاحب کارت
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>متن کوتاه</span>
                                  </button>

                                  {card.sheba || card.accountNumber ? (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        void shareCardText(
                                          `شماره شبا و حساب ${card.bankName}`,
                                          buildAccountShebaShareText(card),
                                          'شماره شبا و حساب',
                                        )
                                        setOpenMenu(null)
                                      }}
                                      style={{
                                        width: '100%',
                                        minHeight: 44,
                                        padding: '10px 12px',
                                        background: 'none',
                                        border: 'none',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                        color: 'var(--hy-text)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 10,
                                        textAlign: 'right',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <span style={{ fontSize: 12, fontWeight: 700 }}>
                                        ارسال شماره شبا و شماره حساب
                                      </span>
                                      <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>شبا / حساب</span>
                                    </button>
                                  ) : null}

                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      void shareCardText(
                                        `مشخصات کارت ${card.bankName}`,
                                        buildFullCardCopyText(card),
                                        'مشخصات کامل کارت',
                                      )
                                      setOpenMenu(null)
                                    }}
                                    style={{
                                      width: '100%',
                                      minHeight: 44,
                                      padding: '10px 12px',
                                      background: 'none',
                                      border: 'none',
                                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                      color: 'var(--hy-text)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 10,
                                      textAlign: 'right',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                                      ارسال مشخصات کامل کارت (بدون CVV)
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>کامل و امن</span>
                                  </button>

                                  {!incomingShared ? (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenMenu(null)
                                        onClose()
                                        window.dispatchEvent(
                                          new CustomEvent('hy-open-share', {
                                            detail: {
                                              kind: 'card',
                                              item: {
                                                id: card.id,
                                                name: card.bankName || 'کارت بانکی',
                                                bankName: card.bankName,
                                                pan: card.pan,
                                                accountNumber: card.accountNumber,
                                              },
                                            },
                                          }),
                                        )
                                      }}
                                      style={{
                                        width: '100%',
                                        minHeight: 44,
                                        padding: '10px 12px',
                                        background: 'rgba(15, 118, 110, 0.14)',
                                        border: 'none',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                        color: 'var(--hy-teal, #14b8a6)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 10,
                                        textAlign: 'right',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <span style={{ fontSize: 12, fontWeight: 800 }}>
                                        اشتراک کارت با کاربر حساب‌یار
                                      </span>
                                      <span style={{ fontSize: 11 }}>تا ۱۰ کاربر</span>
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
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
                            cursor: 'pointer',
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
