import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toFaDigits } from '../lib/money'
import { useStore } from '../store/Store'
import { useExtras } from '../store/Extras'
import { CardFormSheet } from '../components/CardFormSheet'
import { AccountRow } from '../components/TxRow'
import { BankCardFace } from '../components/BankCardFace'
import { CardLegacySyncBanner } from '../components/CardLegacySyncBanner'
import {
  fetchIncomingShares,
  getStableUserId,
  isIncomingSharedAsset,
  respondIncomingShare,
  type IncomingSharedAsset,
} from '../lib/userShare'
import { SharedAssetDetailSheet } from '../components/SharedAssetDetailSheet'
import { notifyUser } from '../lib/sync'
import type { Account, AccountClassification, BankCard } from '../types'

export function AccountsPage({
  onScroll,
}: {
  onScroll: (compact: boolean) => void
}) {
  const { accounts, activeAccounts, transactions, addSharedAccount } = useStore()
  const {
    cards,
    formatMoney,
    unlocked,
    vaultConfigured,
    hasRecoverableBackup,
    syncVaultWithAccountPassword,
    deleteCard,
    saveSharedCard,
  } = useExtras()
  const [cardId, setCardId] = useState<string | null | undefined>(undefined)
  const [selectedSharedAsset, setSelectedSharedAsset] = useState<{ kind: 'card' | 'account'; account?: Account; card?: BankCard } | null>(null)
  const [incomingShares, setIncomingShares] = useState<IncomingSharedAsset[]>([])
  const [activeTab, setActiveTab] = useState<AccountClassification>('cash')
  const [subTab, setSubTab] = useState<'accounts' | 'cards'>('accounts')
  const navigate = useNavigate()
  const myUserId = getStableUserId()

  const [revealed, setRevealed] = useState<string | null>(null)

  useEffect(() => {
    if (subTab === 'cards' && !unlocked) {
      void syncVaultWithAccountPassword()
    }
  }, [subTab, unlocked, syncVaultWithAccountPassword])

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
    return () => {
      window.removeEventListener('hy-new-card', open)
    }
  }, [])

  const loadIncoming = async () => {
    try {
      const list = await fetchIncomingShares()
      setIncomingShares(list)
    } catch {}
  }

  useEffect(() => {
    void loadIncoming()
    window.addEventListener('hy-share-assets-updated', loadIncoming)
    return () => window.removeEventListener('hy-share-assets-updated', loadIncoming)
  }, [])

  const pendingShares = useMemo(() => {
    const myIdLower = myUserId.trim().toLowerCase()
    return incomingShares.filter((s) => {
      if (s.status === 'rejected') return false
      const ownerIdLower = (s.ownerUserId || '').trim().toLowerCase()
      if (ownerIdLower && ownerIdLower === myIdLower) return false
      if (s.assetKind === 'account') {
        const alreadyInAccounts = accounts.some(
          (a) => a.shareId === s.id || a.sourceAssetId === s.assetId || a.id === s.assetId,
        )
        if (alreadyInAccounts) return false
      } else {
        const alreadyInCards = cards.some(
          (c) => c.shareId === s.id || c.sourceAssetId === s.assetId || c.id === s.assetId,
        )
        if (alreadyInCards) return false
      }
      return true
    })
  }, [incomingShares, accounts, cards, myUserId])

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="icon-btn mobile-only-icon"
            onClick={() => window.dispatchEvent(new CustomEvent('hy:open-drawer'))}
            title="منوی ناوبری سایدبار"
            aria-label="منوی ناوبری سایدبار"
          >
            ☰
          </button>
          <div>
            <h1>حساب‌ها و کارت‌ها</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--hy-text-secondary)' }}>
              تفکیک حساب‌های نقدی، اعتباری و سرمایه‌گذاری با دسترسی مجزا به حساب‌ها و کارت‌ها
            </p>
          </div>
        </div>
      </div>

      {pendingShares.length > 0 ? (
        <div
          style={{
            margin: '14px 0',
            padding: '12px 14px',
            borderRadius: 14,
            background: 'color-mix(in srgb, var(--hy-teal) 8%, var(--glass-chrome))',
            border: '1px solid color-mix(in srgb, var(--hy-teal) 45%, transparent)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, color: 'var(--hy-teal)' }}>
              <span>🔔</span>
              <span>دعوت‌نامه اشتراک حساب یا کارت جدید</span>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'color-mix(in srgb, var(--hy-income) 14%, transparent)',
                color: 'var(--hy-income, #10b981)',
                fontWeight: 700,
              }}
            >
              {toFaDigits(pendingShares.length)} مورد
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingShares.map((share) => (
              <div
                key={share.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{share.assetKind === 'card' ? '💳' : '🏦'}</span>
                    <span>{share.assetKind === 'card' ? 'کارت مشترک: ' : 'حساب مشترک: '}{share.assetName}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                    از طرف: <strong>{share.ownerDisplayName || `کاربر ${share.ownerUserId}`}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="cat-mini"
                    style={{
                      background: 'var(--hy-teal)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 700,
                      padding: '6px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                    onClick={async () => {
                      await respondIncomingShare(share.id, 'accept')
                      const resolvedOwner = share.ownerDisplayName || `کاربر ${share.ownerUserId}`
                      if (share.assetKind === 'account') {
                        await addSharedAccount({
                          id: `shared_${share.id}`,
                          name: `${share.assetName} (مشترک)`,
                          balance: share.assetDetails?.balance ?? 0,
                          accountNumber: share.assetDetails?.accountNumber,
                          shareId: share.id,
                          sourceAssetId: share.assetId,
                          ownerDisplayName: resolvedOwner,
                          ownerUserId: share.ownerUserId,
                          recipientUserId: myUserId,
                        })
                      } else {
                        await saveSharedCard({
                          id: `shared_card_${share.id}`,
                          bankName: `${share.assetName || share.assetDetails?.bankName || 'کارت'} (مشترک)`,
                          holder: share.assetDetails?.holder || resolvedOwner,
                          pan: share.assetDetails?.pan || '',
                          sheba: share.assetDetails?.sheba || '',
                          expiry: share.assetDetails?.expiry || '1406/12',
                          cvv: '***',
                          note: `کارت مشترک از طرف ${resolvedOwner}`,
                          createdAt: Date.now(),
                          classification: 'cash',
                          color: 'linear-gradient(135deg, #059669 0%, #0f172a 100%)',
                          shareId: share.id,
                          sourceAssetId: share.assetId,
                          isShared: true,
                          ownerDisplayName: resolvedOwner,
                          ownerUserId: share.ownerUserId,
                          recipientUserId: myUserId,
                        })
                      }
                      notifyUser(`«${share.assetName}» به لیست شما افزوده شد`)
                      void loadIncoming()
                    }}
                  >
                    <span>✓</span>
                    <span>تأیید و افزودن</span>
                  </button>

                  <button
                    type="button"
                    className="cat-mini danger"
                    style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={async () => {
                      await respondIncomingShare(share.id, 'reject')
                      notifyUser('دعوت‌نامه رد شد')
                      void loadIncoming()
                    }}
                  >
                    <span>✕</span>
                    <span>رد</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
            borderRadius: 14,
            background: activeTab === 'cash' ? 'color-mix(in srgb, var(--hy-teal) 10%, var(--glass-chrome))' : 'var(--glass-chrome)',
            border: activeTab === 'cash' ? '1.5px solid var(--hy-teal)' : '1px solid var(--hy-border-color)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, background 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hy-text-secondary)' }}>
              مجموع موجودی نقدی
            </span>
            <span>💵</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--hy-teal)', margin: '6px 0 4px' }}>
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
            borderRadius: 14,
            background: activeTab === 'credit' ? 'color-mix(in srgb, var(--hy-transfer) 10%, var(--glass-chrome))' : 'var(--glass-chrome)',
            border: activeTab === 'credit' ? '1.5px solid var(--hy-transfer)' : '1px solid var(--hy-border-color)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, background 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hy-text-secondary)' }}>
              مجموع موجودی اعتباری
            </span>
            <span>💳</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--hy-transfer)', margin: '6px 0 4px' }}>
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
            borderRadius: 14,
            background: activeTab === 'investment' ? 'color-mix(in srgb, var(--hy-violet) 10%, var(--glass-chrome))' : 'var(--glass-chrome)',
            border: activeTab === 'investment' ? '1.5px solid var(--hy-violet)' : '1px solid var(--hy-border-color)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, background 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hy-text-secondary)' }}>
              پس‌انداز و سرمایه‌گذاری
            </span>
            <span>📈</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--hy-violet)', margin: '6px 0 4px' }}>
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
          style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span>💵</span>
          <span>نقدی و جاری ({toFaDigits(cashAccounts.length)})</span>
        </button>
        <button
          type="button"
          className={`seg-btn${activeTab === 'credit' ? ' active' : ''}`}
          onClick={() => setActiveTab('credit')}
          style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span>💳</span>
          <span>اعتباری و خرید ({toFaDigits(creditAccounts.length)})</span>
        </button>
        <button
          type="button"
          className={`seg-btn${activeTab === 'investment' ? ' active' : ''}`}
          onClick={() => setActiveTab('investment')}
          style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <span>📈</span>
          <span>پس‌انداز و سرمایه ({toFaDigits(investmentAccounts.length)})</span>
        </button>
      </div>

      {/* Two Separate Tabs (حساب‌ها و کارت‌ها) for the Active Classification */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          margin: '12px 0 14px',
          padding: '8px 12px',
          background: 'var(--hy-input-bg)',
          borderRadius: 14,
          border: '1px solid var(--hy-border-color)',
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`cat-mini${subTab === 'accounts' ? ' active' : ''}`}
            onClick={() => setSubTab('accounts')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🏦</span>
            <span>حساب‌ها ({toFaDigits(currentTabAccounts.length)})</span>
          </button>
          <button
            type="button"
            className={`cat-mini${subTab === 'cards' ? ' active' : ''}`}
            onClick={() => setSubTab('cards')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>💳</span>
            <span>کارت‌ها ({toFaDigits(currentTabCards.length)})</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cat-mini"
            onClick={() => window.dispatchEvent(new CustomEvent('hy-new-account'))}
            style={{
              fontSize: 11.5,
              padding: '6px 12px',
              background: 'color-mix(in srgb, var(--hy-teal) 14%, transparent)',
              color: 'var(--hy-teal)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>＋</span>
            <span>حساب جدید</span>
          </button>
          <button
            type="button"
            className="cat-mini"
            onClick={() => {
              setSubTab('cards')
              setCardId(null)
            }}
            style={{
              fontSize: 11.5,
              padding: '6px 12px',
              background: 'color-mix(in srgb, var(--hy-transfer) 14%, transparent)',
              color: 'var(--hy-transfer)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span>＋</span>
            <span>کارت جدید</span>
          </button>
        </div>
      </div>

      {/* Sorting Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 14,
          padding: '4px 6px',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--hy-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>⇅</span>
          <span>مرتب‌سازی:</span>
        </div>

        {subTab === 'accounts' ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className={`cat-mini${accountSort === 'balance-desc' ? ' active' : ''}`}
              onClick={() => setAccountSort('balance-desc')}
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>🔽</span>
              <span>بیشترین موجودی</span>
            </button>
            <button
              type="button"
              className={`cat-mini${accountSort === 'balance-asc' ? ' active' : ''}`}
              onClick={() => setAccountSort('balance-asc')}
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>🔼</span>
              <span>کمترین موجودی</span>
            </button>
            <button
              type="button"
              className={`cat-mini${accountSort === 'usage' ? ' active' : ''}`}
              onClick={() => setAccountSort('usage')}
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>🔥</span>
              <span>پرتراکنش‌ترین</span>
            </button>
            <button
              type="button"
              className={`cat-mini${accountSort === 'name' ? ' active' : ''}`}
              onClick={() => setAccountSort('name')}
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>🔤</span>
              <span>نام</span>
            </button>
            <button
              type="button"
              className={`cat-mini${accountSort === 'manual' ? ' active' : ''}`}
              onClick={() => setAccountSort('manual')}
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>↕️</span>
              <span>دستی</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className={`cat-mini${cardSort === 'default' ? ' active' : ''}`}
              onClick={() => setCardSort('default')}
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>📑</span>
              <span>پیش‌فرض</span>
            </button>
            <button
              type="button"
              className={`cat-mini${cardSort === 'expiry' ? ' active' : ''}`}
              onClick={() => setCardSort('expiry')}
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>📅</span>
              <span>انقضا</span>
            </button>
            <button
              type="button"
              className={`cat-mini${cardSort === 'name' ? ' active' : ''}`}
              onClick={() => setCardSort('name')}
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>👤</span>
              <span>دارنده / بانک</span>
            </button>
            <button
              type="button"
              className={`cat-mini${cardSort === 'manual' ? ' active' : ''}`}
              onClick={() => setCardSort('manual')}
              style={{ fontSize: 11.5, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <span>↕️</span>
              <span>دستی</span>
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
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {tabLabels[activeTab].icon}
              </div>
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
                          border: '1px solid var(--hy-border-color)',
                          background: 'var(--hy-hover)',
                          color: idx === currentTabAccounts.length - 1 ? 'var(--hy-text-tertiary)' : 'var(--hy-text)',
                          opacity: idx === currentTabAccounts.length - 1 ? 0.35 : 1,
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
                  {isIncomingSharedAsset(account, myUserId) ? (
                    <button
                      type="button"
                      className="cat-mini"
                      style={{
                        flexShrink: 0,
                        padding: '6px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: 'var(--hy-income, #10b981)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedSharedAsset({ kind: 'account', account })
                      }}
                    >
                      <span>ℹ️</span>
                      <span>مشخصات اشتراک</span>
                    </button>
                  ) : null}
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
          </div>

          <div>
              {(vaultConfigured && !unlocked) || hasRecoverableBackup ? (
                <CardLegacySyncBanner />
              ) : null}
              {currentTabCards.length === 0 && !((vaultConfigured && !unlocked) || hasRecoverableBackup) ? (
                <div className="empty-state" style={{ padding: '24px 16px', margin: '8px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>
                    💳
                  </div>
                  <h3 style={{ fontSize: 14, margin: '0 0 4px', fontWeight: 700 }}>
                    کارتی در بخش {tabLabels[activeTab].title} ذخیره نشده است
                  </h3>
                  {cards.length > 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--hy-teal)', margin: '0 0 12px', fontWeight: 600 }}>
                      شما {toFaDigits(cards.length)} کارت ثبت‌شده در دسته‌های دیگر دارید.
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--hy-text-tertiary)', margin: '0 0 12px' }}>
                      می‌توانید کارت بانکی شتابی یا کارت اعتباری جدید اضافه کنید.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {cards.length > 0 ? (
                      <button
                        type="button"
                        className="cat-mini active"
                        onClick={() => {
                          const firstOther = cards[0]?.classification ?? 'cash'
                          setActiveTab(firstOther)
                        }}
                        style={{ fontSize: 12, padding: '8px 14px' }}
                      >
                        مشاهده کارت‌های ثبت‌شده ({toFaDigits(cards.length)})
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="cta-confirm"
                      onClick={() => setCardId(null)}
                      style={{ fontSize: 12, padding: '8px 16px', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <span>＋</span>
                      <span>ایجاد کارت جدید</span>
                    </button>
                  </div>
                </div>
              ) : currentTabCards.length > 0 ? (
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
                                padding: '3px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--hy-border-color)',
                                background: 'var(--hy-hover)',
                                color: idx === 0 ? 'var(--hy-text-tertiary)' : 'var(--hy-text)',
                                opacity: idx === 0 ? 0.35 : 1,
                                cursor: idx === 0 ? 'default' : 'pointer',
                                fontSize: 11,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                              title="انتقال کارت به بالا"
                            >
                              <span>▲</span>
                              <span>بالا</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCardDown(card.id)}
                              disabled={idx === currentTabCards.length - 1}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--hy-border-color)',
                                background: 'var(--hy-hover)',
                                color: idx === currentTabCards.length - 1 ? 'var(--hy-text-tertiary)' : 'var(--hy-text)',
                                opacity: idx === currentTabCards.length - 1 ? 0.35 : 1,
                                cursor: idx === currentTabCards.length - 1 ? 'default' : 'pointer',
                                fontSize: 11,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                              title="انتقال کارت به پایین"
                            >
                              <span>▼</span>
                              <span>پایین</span>
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
                        {isIncomingSharedAsset(card, myUserId) ? (
                          <button
                            className="cat-mini"
                            type="button"
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: 'var(--hy-income, #10b981)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onClick={() => setSelectedSharedAsset({ kind: 'card', card })}
                          >
                            <span>ℹ️</span>
                            <span>مشخصات اشتراک</span>
                          </button>
                        ) : (
                          <>
                            <button
                              className="cat-mini"
                              type="button"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() =>
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
                              }
                            >
                              <span>👥</span>
                              <span>اشتراک</span>
                            </button>
                            <button className="cat-mini" type="button" onClick={() => setCardId(card.id)}>
                              ویرایش
                            </button>
                            <button
                              className="cat-mini danger"
                              type="button"
                              onClick={() => {
                                if (confirm('آیا از حذف این کارت اطمینان دارید؟')) {
                                  void deleteCard(card.id)
                                }
                              }}
                            >
                              حذف
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
          </div>
        </div>
      )}

      {cardId !== undefined ? (
        <CardFormSheet
          card={cards.find((card) => card.id === cardId)}
          onClose={() => setCardId(undefined)}
        />
      ) : null}

      {selectedSharedAsset ? (
        <SharedAssetDetailSheet
          kind={selectedSharedAsset.kind}
          account={selectedSharedAsset.account}
          card={selectedSharedAsset.card}
          onClose={() => setSelectedSharedAsset(null)}
        />
      ) : null}
    </div>
  )
}
