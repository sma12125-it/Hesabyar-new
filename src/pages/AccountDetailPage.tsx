import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/Store'
import { BalanceHero } from '../components/BalanceHero'
import { TxRow } from '../components/TxRow'
import { SettingsButton } from '../components/SettingsButton'
import { useUiActions } from '../components/UiActions'
import { useExtras } from '../store/Extras'
import { notifyUser } from '../lib/sync'

export function AccountDetailPage({
  onScroll,
  onQuickEntry,
  onTransfer,
  onEdit,
  onShare,
}: {
  onScroll: (compact: boolean) => void
  onQuickEntry: () => void
  onTransfer: () => void
  onEdit: () => void
  onShare: () => void
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { accounts, transactions, archiveAccount, restoreAccount } = useStore()
  const { cards } = useExtras()
  const actions = useUiActions()
  const [menu, setMenu] = useState(false)
  const account = accounts.find((a) => a.id === id)
  const txs = transactions.filter((t) => t.accountId === id)
  const linkedCard = account?.cardId ? cards.find((c) => c.id === account.cardId) : undefined

  const copyText = (txt: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(txt)
      notifyUser(`${label} کپی شد`)
    }
  }

  if (!account) {
    return (
      <div className="app-scroll">
        <div className="empty-state lg">
          <h2>حساب پیدا نشد</h2>
          <button className="cta-confirm" type="button" onClick={() => navigate('/accounts')}>
            بازگشت
          </button>
        </div>
      </div>
    )
  }

  const disabled = account.archived

  return (
    <div className="app-scroll" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="detail-top">
        <button className="back-btn" type="button" onClick={() => navigate('/accounts')} aria-label="بازگشت">
          ›
        </button>
        <h1>{account.name}</h1>
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
            ویرایش نام و نوع
          </button>
          {account.archived ? (
            <button
              type="button"
              onClick={() => {
                setMenu(false)
                void restoreAccount(account.id)
              }}
            >
              بازگردانی از آرشیو
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMenu(false)
                void archiveAccount(account.id)
              }}
            >
              آرشیو حساب
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMenu(false)
              actions?.deleteAccount(account.id)
            }}
          >
            حذف حساب
          </button>
        </div>
      ) : null}

      {account.archived ? (
        <div className="banner archive">
          <span className="bico">📦</span>
          <span>این حساب آرشیو شده است — فقط مشاهده</span>
        </div>
      ) : null}

      <BalanceHero
        label="موجودی حساب"
        amount={account.balance}
        sub={
          <>
            <span className={`badge ${account.type}`}>{account.type === 'cash' ? 'نقد' : 'بانک'}</span>
            {' · '}
            {account.shareId ? 'مشترک · ' : ''}
            {account.archived ? 'آرشیو' : 'فعال'}
          </>
        }
      />

      <div className="action-row">
        <button className="action-chip lg-light" type="button" onClick={onShare}>
          <span className="aico">👥</span>اشتراک
        </button>
        <button
          className={`action-chip lg-light${disabled ? ' disabled' : ''}`}
          type="button"
          disabled={disabled}
          onClick={onQuickEntry}
        >
          <span className="aico">＋</span>ثبت
        </button>
        <button
          className={`action-chip lg-light${disabled ? ' disabled' : ''}`}
          type="button"
          disabled={disabled}
          onClick={onTransfer}
        >
          <span className="aico">⇄</span>انتقال
        </button>
        {account.archived ? (
          <button className="action-chip lg-light" type="button" onClick={() => void restoreAccount(account.id)}>
            <span className="aico">↩</span>بازگردانی
          </button>
        ) : (
          <button className="action-chip lg-light" type="button" onClick={onEdit}>
            <span className="aico">✎</span>ویرایش
          </button>
        )}
      </div>

      {linkedCard ? (
        <div
          className="home-card lg"
          style={{
            margin: '12px 0',
            background: linkedCard.color || 'linear-gradient(135deg, #0f766e 0%, #1e1b4b 100%)',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{linkedCard.bankName}</span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>{linkedCard.holder}</span>
          </div>
          <div style={{ fontSize: 17, letterSpacing: 2, direction: 'ltr', textAlign: 'center', marginBottom: 14, fontFamily: 'monospace' }}>
            {linkedCard.pan ? linkedCard.pan.replace(/(\d{4})/g, '$1 ').trim() : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              type="button"
              className="cat-mini"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}
              onClick={() => copyText(linkedCard.pan, 'شماره کارت')}
            >
              📋 کپی شماره کارت
            </button>
            {linkedCard.sheba ? (
              <button
                type="button"
                className="cat-mini"
                style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}
                onClick={() => copyText(linkedCard.sheba, 'شماره شبا')}
              >
                📋 کپی شبا
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="section-head">
        <h2>{account.archived ? 'آخرین تراکنش‌ها' : 'تراکنش‌ها'}</h2>
      </div>
      <div className="tx-list">
        {txs.length === 0 ? (
          <div className="empty-state lg" style={{ marginTop: 8 }}>
            <div className="empty-ico">🧾</div>
            <h2>تراکنشی روی این حساب نیست</h2>
          </div>
        ) : (
          txs.map((tx) => <TxRow key={tx.id} tx={tx} accounts={accounts} forAccountId={account.id} />)
        )}
      </div>
    </div>
  )
}
