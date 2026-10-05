import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toFaDigits } from '../lib/money'
import { useStore } from '../store/Store'
import { useExtras } from '../store/Extras'
import { CardFormSheet } from '../components/CardFormSheet'
import { CardVaultSection } from '../components/CardVaultSection'
import { AccountRow } from '../components/TxRow'
import { SettingsButton } from '../components/SettingsButton'
import type { AccountClassification } from '../types'

export function AccountsPage({
  onScroll,
}: {
  onScroll: (compact: boolean) => void
}) {
  const { accounts, activeAccounts } = useStore()
  const { cards, formatMoney } = useExtras()
  const [cardId, setCardId] = useState<string | null | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<AccountClassification>('cash')
  const navigate = useNavigate()

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

  // Accounts filtered for current tab
  const currentTabAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const cls = a.classification ?? 'cash'
      return cls === activeTab && !a.archived
    })
  }, [accounts, activeTab])

  const currentTabArchived = useMemo(() => {
    return accounts.filter((a) => {
      const cls = a.classification ?? 'cash'
      return cls === activeTab && a.archived
    })
  }, [accounts, activeTab])

  const tabLabels: Record<AccountClassification, { title: string; desc: string; icon: string }> = {
    cash: {
      title: 'حساب‌ها و کارت‌های نقدی',
      desc: 'موجودی نقد، کارت‌های شتابی و حساب‌های جاری روزمره',
      icon: '💵',
    },
    credit: {
      title: 'کارت‌ها و حساب‌های اعتباری',
      desc: 'کارت‌های اعتباری، اعتبار خرید اقساطی (مانند هوده، تپسی، اسنپ‌پی)',
      icon: '💳',
    },
    investment: {
      title: 'حساب‌های پس‌انداز و سرمایه‌گذاری',
      desc: 'سپرده‌های سرمایه‌گذاری، صندوق‌های درآمد ثابت، طلا و اندوخته‌ها',
      icon: '📈',
    },
  }

  return (
    <div className="app-scroll" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="top-row">
        <div>
          <h1>حساب‌ها و کارت‌ها</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--hy-text-secondary)' }}>
            تفکیک حساب‌های نقدی، اعتباری و سرمایه‌گذاری
          </p>
        </div>
        <SettingsButton />
      </div>

      {/* Request 6: Three KPI Cards replacing single card */}
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
            {toFaDigits(cashAccounts.length)} حساب نقدی فعال
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
            {toFaDigits(creditAccounts.length)} حساب / کارت اعتباری (خرید)
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

      {/* Request 6: Three Segregated Tabs */}
      <div className="seg" role="tablist" style={{ margin: '18px 0 14px' }}>
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

      {/* Tab description bar and action buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 14,
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--hy-text-secondary)' }}>
          <strong style={{ color: 'var(--hy-text)', marginLeft: 6 }}>{tabLabels[activeTab].title}:</strong>
          {tabLabels[activeTab].desc}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="cat-mini"
            onClick={() => window.dispatchEvent(new CustomEvent('hy-new-account'))}
            style={{ fontSize: 11, padding: '5px 10px' }}
          >
            ＋ حساب جدید
          </button>
          <button
            type="button"
            className="cat-mini"
            onClick={() => setCardId(null)}
            style={{ fontSize: 11, padding: '5px 10px' }}
          >
            ＋ کارت بانکی جدید
          </button>
        </div>
      </div>

      {/* Split wide layout: Accounts on one side, Vault cards on the other */}
      <div className="split-wide">
        <div>
          <div className="section-head">
            <h2>{tabLabels[activeTab].title} ({toFaDigits(currentTabAccounts.length)})</h2>
          </div>

          {currentTabAccounts.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px', margin: '8px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{tabLabels[activeTab].icon}</div>
              <h3 style={{ fontSize: 14, margin: '0 0 4px', fontWeight: 700 }}>
                حسابی در دستهٔ {tabLabels[activeTab].title} ثبت نشده است
              </h3>
              <p style={{ fontSize: 12, color: 'var(--hy-text-tertiary)', margin: '0 0 12px' }}>
                می‌توانید با دکمه زیر یک حساب اختصاصی برای این بخش تعریف کنید.
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
              {currentTabAccounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onClick={() => navigate(`/accounts/${account.id}`)}
                />
              ))}
            </div>
          )}

          {currentTabArchived.length > 0 ? (
            <>
              <div className="section-head" style={{ marginTop: 20 }}>
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

        {/* Vault Cards filtered for active classification tab */}
        <CardVaultSection
          classificationFilter={activeTab}
          title={`کارت‌های ${tabLabels[activeTab].title}`}
          onEdit={(id) => setCardId(id)}
        />
      </div>

      {cardId !== undefined ? (
        <CardFormSheet
          card={cards.find((card) => card.id === cardId)}
          onClose={() => setCardId(undefined)}
        />
      ) : null}
    </div>
  )
}
