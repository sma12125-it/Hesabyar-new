import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toFaDigits } from '../lib/money'
import { useStore } from '../store/Store'
import { useExtras } from '../store/Extras'
import { CardFormSheet } from '../components/CardFormSheet'
import { AccountRow } from '../components/TxRow'
import { SettingsButton } from '../components/SettingsButton'
import { BankCardFace } from '../components/BankCardFace'
import { VaultRecover } from '../components/VaultRecover'
import type { AccountClassification } from '../types'

export function AccountsPage({
  onScroll,
}: {
  onScroll: (compact: boolean) => void
}) {
  const { accounts, activeAccounts, transactions } = useStore()
  const { cards, formatMoney, unlocked, vaultConfigured, unlockVault, lockVault, deleteCard } = useExtras()
  const [cardId, setCardId] = useState<string | null | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<AccountClassification>('cash')
  const [subTab, setSubTab] = useState<'accounts' | 'cards'>('accounts')
  const navigate = useNavigate()

  // Vault state for card view
  const [phrase, setPhrase] = useState('')
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  // Sorting state for Accounts (Request 13)
  const [accountSort, setAccountSort] = useState<'balance-desc' | 'balance-asc' | 'usage' | 'name' | 'manual'>('balance-desc')
  const [accountManualOrder, setAccountManualOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hy_accounts_manual_order')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Sorting state for Cards (Request 13)
  const [cardSort, setCardSort] = useState<'default' | 'expiry' | 'name' | 'manual'>('default')
  const [cardManualOrder, setCardManualOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hy_cards_manual_order')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    const open = () => setCardId(null)
    window.addEventListener('hy-new-card', open)
    return () => window.removeEventListener('hy-new-card', open)
  }, [])

  // Segregation of accounts by classification
  const cashAccounts = useMemo(
    () => activeAccounts.filter((a) => (a.classification ?? 'cash') === 'cash'),
    [activeAccounts]
  )
  const creditAccounts = useMemo(
    () => activeAccounts.filter((a) => a.classification === 'credit'),
    [activeAccounts]
  )
  const investmentAccounts = useMemo(
    () => activeAccounts.filter((a) => a.classification === 'investment'),
    [activeAccounts]
  )

  const cashTotal = useMemo(() => cashAccounts.reduce((sum, a) => sum + a.balance, 0), [cashAccounts])
  const creditTotal = useMemo(() => creditAccounts.reduce((sum, a) => sum + a.balance, 0), [creditAccounts])
  const investmentTotal = useMemo(
    () => investmentAccounts.reduce((sum, a) => sum + a.balance, 0),
    [investmentAccounts]
  )

  // Cards segregated by classification
  const currentTabCards = useMemo(() => {
    const list = cards.filter((c) => (c.classification ?? 'cash') === activeTab)
    if (cardSort === 'expiry') {
      return list.slice().sort((a, b) => a.expiry.localeCompare(b.expiry))
    }
    if (cardSort === 'name') {
      return list.slice().sort((a, b) => (a.holder || '').localeCompare(b.holder || ''))
    }
    if (cardSort === 'manual') {
      return list.slice().sort((a, b) => {
        const idxA = cardManualOrder.indexOf(a.id)
        const idxB = cardManualOrder.indexOf(b.id)
        if (idxA === -1 && idxB === -1) return 0
        if (idxA === -1) return 1
        if (idxB === -1) return -1
        return idxA - idxB
      })
    }
    return list
  }, [cards, activeTab, cardSort, cardManualOrder])

  // Count usage per account (number of recorded transactions)
  const accountUsageCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tx of transactions) {
      if (tx.accountId) counts[tx.accountId] = (counts[tx.accountId] || 0) + 1
      if (tx.counterpartyAccountId) counts[tx.counterpartyAccountId] = (counts[tx.counterpartyAccountId] || 0) + 1
    }
    return counts
  }, [transactions])

  // Accounts filtered and sorted for current tab
  const currentTabAccounts = useMemo(() => {
    const raw = accounts.filter((a) => {
      const cls = a.classification ?? 'cash'
      return cls === activeTab && !a.archived
    })

    if (accountSort === 'balance-desc') {
      return raw.slice().sort((a, b) => b.balance - a.balance)
    }
    if (accountSort === 'balance-asc') {
      return raw.slice().sort((a, b) => a.balance - b.balance)
    }
    if (accountSort === 'usage') {
      return raw.slice().sort((a, b) => (accountUsageCount[b.id] || 0) - (accountUsageCount[a.id] || 0))
    }
    if (accountSort === 'name') {
      return raw.slice().sort((a, b) => a.name.localeCompare(b.name))
    }
    if (accountSort === 'manual') {
      return raw.slice().sort((a, b) => {
        const idxA = accountManualOrder.indexOf(a.id)
        const idxB = accountManualOrder.indexOf(b.id)
        if (idxA === -1 && idxB === -1) return 0
        if (idxA === -1) return 1
        if (idxB === -1) return -1
        return idxA - idxB
      })
    }
    return raw
  }, [accounts, activeTab, accountSort, accountUsageCount, accountManualOrder])

  const currentTabArchived = useMemo(() => {
    return accounts.filter((a) => {
      const cls = a.classification ?? 'cash'
      return cls === activeTab && a.archived
    })
  }, [accounts, activeTab])

  // Manual reordering helpers
  function moveAccountUp(id: string) {
    const currentList = currentTabAccounts.map((a) => a.id)
    const index = currentList.indexOf(id)
    if (index <= 0) return
    const next = [...currentList]
    const temp = next[index - 1]
    next[index - 1] = next[index]
    next[index] = temp
    setAccountManualOrder(next)
    try {
      localStorage.setItem('hy_accounts_manual_order', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  function moveAccountDown(id: string) {
    const currentList = currentTabAccounts.map((a) => a.id)
    const index = currentList.indexOf(id)
    if (index === -1 || index >= currentList.length - 1) return
    const next = [...currentList]
    const temp = next[index + 1]
    next[index + 1] = next[index]
    next[index] = temp
    setAccountManualOrder(next)
    try {
      localStorage.setItem('hy_accounts_manual_order', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  function moveCardUp(id: string) {
    const currentList = currentTabCards.map((c) => c.id)
    const index = currentList.indexOf(id)
    if (index <= 0) return
    const next = [...currentList]
    const temp = next[index - 1]
    next[index - 1] = next[index]
    next[index] = temp
    setCardManualOrder(next)
    try {
      localStorage.setItem('hy_cards_manual_order', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  function moveCardDown(id: string) {
    const currentList = currentTabCards.map((c) => c.id)
    const index = currentList.indexOf(id)
    if (index === -1 || index >= currentList.length - 1) return
    const next = [...currentList]
    const temp = next[index + 1]
    next[index + 1] = next[index]
    next[index] = temp
    setCardManualOrder(next)
    try {
      localStorage.setItem('hy_cards_manual_order', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  async function unlock() {
    setVaultError(null)
    try {
      await unlockVault(phrase)
    } catch {
      setVaultError('رمز گاوصندوق نادرست است')
    }
  }

  const tabLabels: Record<AccountClassification, { title: string; desc: string; icon: string }> = {
    cash: {
      title: 'نقدی و جاری',
      desc: 'موجودی نقد، کارت‌های شتابی و حساب‌های جاری روزمره',
      icon: '💵',
    },
    credit: {
      title: 'اعتباری و خرید',
      desc: 'کارت‌های اعتباری و خریدهای اقساطی (مانند هوده، تپسی، اسنپ‌پی)',
      icon: '💳',
    },
    investment: {
      title: 'پس‌انداز و سرمایه‌گذاری',
      desc: 'سپرده‌های سرمایه‌گذاری، صندوق‌های درآمد ثابت، طلا و اندوخته‌ها',
      icon: '📈',
    },
  }

  return (
    <div className="app-scroll page-accounts" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      {/* Top Header */}
      <div className="top-row">
        <div>
          <h1>حساب‌ها و کارت‌ها</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--hy-text-secondary)' }}>
            تفکیک حساب‌های نقدی، اعتباری و سرمایه‌گذاری با دسترسی مجزا به حساب‌ها و کارت‌ها
          </p>
        </div>
        <SettingsButton showLabel={true} />
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 10,
          marginTop: 14,
        }}
      >
        {/* Card 1: Cash balance */}
        <div
          onClick={() => setActiveTab('cash')}
          style={{
            padding: '14px 16px',
            borderRadius: 18,
            background: activeTab === 'cash' ? 'rgba(15, 118, 110, 0.22)' : 'var(--glass-chrome)',
            border: activeTab === 'cash' ? '1.5px solid var(--hy-teal)' : 'var(--glass-border)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'cash' ? '0 8px 24px rgba(15, 118, 110, 0.2)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hy-text-secondary)' }}>
              مجموع موجودی نقدی
            </span>
            <span style={{ fontSize: 16 }}>💵</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--hy-teal)', margin: '6px 0 4px' }}>
            {formatMoney(cashTotal)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--hy-subtext)' }}>
            {toFaDigits(cashAccounts.length)} حساب · {toFaDigits(cards.filter((c) => (c.classification ?? 'cash') === 'cash').length)} کارت
          </div>
        </div>

        {/* Card 2: Credit total */}
        <div
          onClick={() => setActiveTab('credit')}
          style={{
            padding: '14px 16px',
            borderRadius: 18,
            background: activeTab === 'credit' ? 'rgba(56, 189, 248, 0.18)' : 'var(--glass-chrome)',
            border: activeTab === 'credit' ? '1.5px solid #38bdf8' : 'var(--glass-border)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'credit' ? '0 8px 24px rgba(56, 189, 248, 0.2)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hy-text-secondary)' }}>
              مجموع موجودی اعتباری
            </span>
            <span style={{ fontSize: 16 }}>💳</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8', margin: '6px 0 4px' }}>
            {formatMoney(creditTotal)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--hy-subtext)' }}>
            {toFaDigits(creditAccounts.length)} حساب · {toFaDigits(cards.filter((c) => c.classification === 'credit').length)} کارت اعتباری
          </div>
        </div>

        {/* Card 3: Investment total */}
        <div
          onClick={() => setActiveTab('investment')}
          style={{
            padding: '14px 16px',
            borderRadius: 18,
            background: activeTab === 'investment' ? 'rgba(192, 132, 252, 0.18)' : 'var(--glass-chrome)',
            border: activeTab === 'investment' ? '1.5px solid #c084fc' : 'var(--glass-border)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'investment' ? '0 8px 24px rgba(192, 132, 252, 0.2)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hy-text-secondary)' }}>
              پس‌انداز و سرمایه‌گذاری
            </span>
            <span style={{ fontSize: 16 }}>📈</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#c084fc', margin: '6px 0 4px' }}>
            {formatMoney(investmentTotal)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--hy-subtext)' }}>
            {toFaDigits(investmentAccounts.length)} حساب پس‌انداز و اندوخته
          </div>
        </div>
      </div>

      {/* Main Classification Segment */}
      <div className="seg" role="tablist" style={{ margin: '18px 0 10px' }}>
        <button
          type="button"
          className={`seg-btn${activeTab === 'cash' ? ' active' : ''}`}
          onClick={() => setActiveTab('cash')}
          style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700 }}
        >
          💵 نقدی و جاری ({toFaDigits(cashAccounts.length)})
        </button>
        <button
          type="button"
          className={`seg-btn${activeTab === 'credit' ? ' active' : ''}`}
          onClick={() => setActiveTab('credit')}
          style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700 }}
        >
          💳 اعتباری و خرید ({toFaDigits(creditAccounts.length)})
        </button>
        <button
          type="button"
          className={`seg-btn${activeTab === 'investment' ? ' active' : ''}`}
          onClick={() => setActiveTab('investment')}
          style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700 }}
        >
          📈 پس‌انداز و سرمایه ({toFaDigits(investmentAccounts.length)})
        </button>
      </div>

      {/* Request 3: Two Separate Tabs (حساب‌ها و کارت‌ها) for the Active Classification */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          margin: '12px 0 16px',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Two Tabs: Accounts vs Cards */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`cat-mini${subTab === 'accounts' ? ' active' : ''}`}
            onClick={() => setSubTab('accounts')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 12,
            }}
          >
            🏦 حساب‌ها ({toFaDigits(currentTabAccounts.length)})
          </button>
          <button
            type="button"
            className={`cat-mini${subTab === 'cards' ? ' active' : ''}`}
            onClick={() => setSubTab('cards')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 12,
            }}
          >
            💳 کارت‌ها ({toFaDigits(currentTabCards.length)})
          </button>
        </div>

        {/* Action Button */}
        <div>
          {subTab === 'accounts' ? (
            <button
              type="button"
              className="cat-mini"
              onClick={() => window.dispatchEvent(new CustomEvent('hy-new-account'))}
              style={{ fontSize: 11, padding: '6px 12px', background: 'rgba(15, 118, 110, 0.2)', color: 'var(--hy-teal)' }}
            >
              ＋ ایجاد حساب جدید
            </button>
          ) : (
            <button
              type="button"
              className="cat-mini"
              onClick={() => setCardId(null)}
              style={{ fontSize: 11, padding: '6px 12px', background: 'rgba(15, 118, 110, 0.2)', color: 'var(--hy-teal)' }}
            >
              ＋ افزودن کارت جدید
            </button>
          )}
        </div>
      </div>

      {/* Request 13: Sorting Bar for Accounts or Cards */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 14,
          padding: '6px 10px',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--hy-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>🔄 ترتیب و مرتب‌سازی:</span>
        </div>

        {subTab === 'accounts' ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`cat-mini${accountSort === 'balance-desc' ? ' active' : ''}`}
              onClick={() => setAccountSort('balance-desc')}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              بیشترین موجودی
            </button>
            <button
              type="button"
              className={`cat-mini${accountSort === 'balance-asc' ? ' active' : ''}`}
              onClick={() => setAccountSort('balance-asc')}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              کمترین موجودی
            </button>
            <button
              type="button"
              className={`cat-mini${accountSort === 'usage' ? ' active' : ''}`}
              onClick={() => setAccountSort('usage')}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              بیشترین استفاده
            </button>
            <button
              type="button"
              className={`cat-mini${accountSort === 'name' ? ' active' : ''}`}
              onClick={() => setAccountSort('name')}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              الفبا
            </button>
            <button
              type="button"
              className={`cat-mini${accountSort === 'manual' ? ' active' : ''}`}
              onClick={() => setAccountSort('manual')}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              دست‌چین (جابجایی دستی)
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`cat-mini${cardSort === 'default' ? ' active' : ''}`}
              onClick={() => setCardSort('default')}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              پیش‌فرض
            </button>
            <button
              type="button"
              className={`cat-mini${cardSort === 'expiry' ? ' active' : ''}`}
              onClick={() => setCardSort('expiry')}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              تاریخ انقضا
            </button>
            <button
              type="button"
              className={`cat-mini${cardSort === 'name' ? ' active' : ''}`}
              onClick={() => setCardSort('name')}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              نام بانک / دارنده
            </button>
            <button
              type="button"
              className={`cat-mini${cardSort === 'manual' ? ' active' : ''}`}
              onClick={() => setCardSort('manual')}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              دست‌چین (جابجایی دستی)
            </button>
          </div>
        )}
      </div>

      {/* Sub-tab 1: ACCOUNTS VIEW */}
      {subTab === 'accounts' ? (
        <div>
          <div className="section-head" style={{ marginBottom: 10 }}>
            <h2>حساب‌های {tabLabels[activeTab].title} ({toFaDigits(currentTabAccounts.length)})</h2>
          </div>

          {currentTabAccounts.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px', margin: '8px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{tabLabels[activeTab].icon}</div>
              <h3 style={{ fontSize: 14, margin: '0 0 4px', fontWeight: 700 }}>
                حسابی در بخش {tabLabels[activeTab].title} ثبت نشده است
              </h3>
              <p style={{ fontSize: 12, color: 'var(--hy-text-tertiary)', margin: '0 0 12px' }}>
                می‌توانید برای تفکیک مالی خود، یک حساب نقدی، اعتباری یا پس‌انداز جدید ایجاد کنید.
              </p>
              <button
                type="button"
                className="cta-confirm"
                onClick={() => window.dispatchEvent(new CustomEvent('hy-new-account'))}
                style={{ fontSize: 12, padding: '8px 16px', width: 'auto' }}
              >
                ایجاد حساب جدید
              </button>
            </div>
          ) : (
            <div className="acct-list">
              {currentTabAccounts.map((account, idx) => (
                <div
                  key={account.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                  }}
                >
                  {/* Manual Reordering Controls (Request 13) */}
                  {accountSort === 'manual' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          moveAccountUp(account.id)
                        }}
                        disabled={idx === 0}
                        style={{
                          width: 26,
                          height: 22,
                          borderRadius: 6,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: idx === 0 ? 'rgba(255, 255, 255, 0.2)' : 'var(--hy-text)',
                          cursor: idx === 0 ? 'default' : 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 10,
                        }}
                        title="انتقال به بالا"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          moveAccountDown(account.id)
                        }}
                        disabled={idx === currentTabAccounts.length - 1}
                        style={{
                          width: 26,
                          height: 22,
                          borderRadius: 6,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: idx === currentTabAccounts.length - 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--hy-text)',
                          cursor: idx === currentTabAccounts.length - 1 ? 'default' : 'pointer',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 10,
                        }}
                        title="انتقال به پایین"
                      >
                        ▼
                      </button>
                    </div>
                  ) : null}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <AccountRow
                      account={account}
                      onClick={() => navigate(`/accounts/${account.id}`)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentTabArchived.length > 0 ? (
            <>
              <div className="section-head" style={{ marginTop: 24 }}>
                <h2>آرشیو ({toFaDigits(currentTabArchived.length)})</h2>
              </div>
              <div className="acct-list">
                {currentTabArchived.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    onClick={() => navigate(`/accounts/${account.id}`)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        /* Sub-tab 2: CARDS VIEW */
        <div>
          <div className="section-head" style={{ marginBottom: 10 }}>
            <h2>کارت‌های بانکی {tabLabels[activeTab].title} ({toFaDigits(currentTabCards.length)})</h2>
            {unlocked ? (
              <button className="link" type="button" onClick={lockVault}>
                قفل گاوصندوق
              </button>
            ) : null}
          </div>

          <p className="sheet-sub">اطلاعات حساس کارت‌ها شامل CVV و تاریخ انقضا در گاوصندوق امن نگهداری می‌شوند.</p>
          {vaultError ? <div className="banner error"><span>{vaultError}</span></div> : null}

          {!vaultConfigured ? (
            <div className="empty-state" style={{ padding: '20px 16px' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
              <h3 style={{ fontSize: 14, margin: '0 0 6px', fontWeight: 700 }}>گاوصندوق کارت هنوز فعال نشده است</h3>
              <p style={{ fontSize: 12, color: 'var(--hy-text-tertiary)', margin: '0 0 12px' }}>
                می‌توانید برای حفاظت از اطلاعات کارت‌های بانکی رمز گاوصندوق تعیین کنید.
              </p>
              <button
                type="button"
                className="cta-confirm"
                onClick={() => setCardId(null)}
                style={{ fontSize: 12, padding: '8px 16px', width: 'auto' }}
              >
                افزودن کارت با تنظیم رمز
              </button>
            </div>
          ) : !unlocked ? (
            <div style={{ margin: '14px 0' }}>
              <div className="field-chip">
                <input
                  className="field-input"
                  type="password"
                  placeholder="رمز گاوصندوق برای نمایش کارت‌ها"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void unlock()
                  }}
                />
                <button className="cat-mini" type="button" onClick={() => void unlock()}>
                  باز کردن
                </button>
                <button className="link" type="button" onClick={() => setForgot((value) => !value)}>
                  فراموشی رمز
                </button>
              </div>
              {forgot ? <VaultRecover onDone={(code) => { setRecoveryCode(code); setForgot(false) }} /> : null}
              {recoveryCode ? (
                <div style={{ marginTop: 10 }}>
                  <p className="sheet-sub">کد بازیابی:</p>
                  <p className="recovery-code">{recoveryCode}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              {currentTabCards.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 16px', margin: '8px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                  <h3 style={{ fontSize: 14, margin: '0 0 4px', fontWeight: 700 }}>
                    کارتی در بخش {tabLabels[activeTab].title} ذخیره نشده است
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--hy-text-tertiary)', margin: '0 0 12px' }}>
                    می‌توانید کارت بانکی شتابی یا کارت اعتباری جدید اضافه کنید.
                  </p>
                  <button
                    type="button"
                    className="cta-confirm"
                    onClick={() => setCardId(null)}
                    style={{ fontSize: 12, padding: '8px 16px', width: 'auto' }}
                  >
                    ＋ افزودن کارت جدید
                  </button>
                </div>
              ) : (
                <div className="card-gallery">
                  {currentTabCards.map((card, idx) => (
                    <div
                      key={card.id}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {/* Manual Reordering Controls on Card (Request 13) */}
                      {cardSort === 'manual' ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: 10,
                          }}
                        >
                          <span style={{ fontSize: 11, color: 'var(--hy-subtext)' }}>
                            جایگاه {toFaDigits(idx + 1)}
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => moveCardUp(card.id)}
                              disabled={idx === 0}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: idx === 0 ? 'rgba(255, 255, 255, 0.2)' : 'var(--hy-text)',
                                cursor: idx === 0 ? 'default' : 'pointer',
                                fontSize: 11,
                              }}
                              title="انتقال کارت به بالا"
                            >
                              ▲ بالا
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCardDown(card.id)}
                              disabled={idx === currentTabCards.length - 1}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: idx === currentTabCards.length - 1 ? 'rgba(255, 255, 255, 0.2)' : 'var(--hy-text)',
                                cursor: idx === currentTabCards.length - 1 ? 'default' : 'pointer',
                                fontSize: 11,
                              }}
                              title="انتقال کارت به پایین"
                            >
                              ▼ پایین
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <BankCardFace card={card} revealed={revealed === card.id} />

                      {card.accountId ? (
                        <div className="plan-meta" style={{ textAlign: 'center' }}>
                          متصل به حساب: {accounts.find((a) => a.id === card.accountId)?.name || 'نامشخص'}
                        </div>
                      ) : null}

                      <div className="cat-actions" style={{ justifyContent: 'center' }}>
                        <button
                          className="cat-mini"
                          type="button"
                          onClick={() => setRevealed(revealed === card.id ? null : card.id)}
                        >
                          {revealed === card.id ? 'پوشاندن' : 'نمایش اطلاعات'}
                        </button>
                        {card.accountId ? (
                          <button
                            className="cat-mini"
                            type="button"
                            onClick={() => window.dispatchEvent(new CustomEvent('hy-share-account', { detail: card.accountId }))}
                          >
                            اشتراک
                          </button>
                        ) : null}
                        <button className="cat-mini" type="button" onClick={() => setCardId(card.id)}>
                          ویرایش
                        </button>
                        <button
                          className="cat-mini danger"
                          type="button"
                          onClick={() => {
                            if (confirm('آیا از حذف این کارت اطمینان دارید؟')) {
                              void deleteCard(card.id, phrase)
                            }
                          }}
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {cardId !== undefined ? (
        <CardFormSheet
          card={cards.find((card) => card.id === cardId)}
          onClose={() => setCardId(undefined)}
        />
      ) : null}
    </div>
  )
}
