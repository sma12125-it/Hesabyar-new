import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/Store'
import { BalanceHero } from '../components/BalanceHero'
import { TxRow } from '../components/TxRow'
import { useUiActions } from '../components/UiActions'
import { useExtras } from '../store/Extras'
import { notifyUser } from '../lib/sync'
import { shareableAccount } from '../lib/profile'
import { ShareByHandle } from '../components/ShareByHandle'
import { toWesternDigits, toFaDigits } from '../lib/money'
import { getCategory } from '../lib/categories'
import { computePocketBalances } from '../lib/balance'
import { PocketFormSheet } from '../components/PocketFormSheet'
import { PocketTransferSheet } from '../components/PocketTransferSheet'
import { SwipeRow } from '../components/SwipeRow'
import type { Pocket } from '../types'

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
  const { accounts, transactions, pockets, pocketTransfers, archiveAccount, restoreAccount, deletePocket, customCategories } = useStore()
  const { cards, formatMoney, unitLabel } = useExtras()
  const actions = useUiActions()
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [pocketFormOpen, setPocketFormOpen] = useState(false)
  const [editingPocket, setEditingPocket] = useState<Pocket | undefined>(undefined)
  const [pocketTransferOpen, setPocketTransferOpen] = useState(false)
  const account = accounts.find((a) => a.id === id)

  const accountPockets = useMemo(() => {
    if (!account) return []
    return (pockets ?? []).filter((p) => p.accountId === account.id && !p.archived)
  }, [account, pockets])

  const pocketBalances = useMemo(() => {
    if (!account) return {}
    return computePocketBalances(account, transactions, pockets, pocketTransfers)
  }, [account, transactions, pockets, pocketTransfers])
  const txs = useMemo(() => {
    const list = transactions.filter((t) => t.accountId === id)
    const q = toWesternDigits(search.trim().toLowerCase())
    if (!q) return list
    const cleanQ = q.replace(/[,،\s]/g, '')
    return list.filter((tx) => {
      const noteMatch = (tx.note || '').toLowerCase().includes(q)
      const amountRialStr = String(tx.amount)
      const amountTomanStr = String(Math.floor(tx.amount / 10))
      const amountMatch =
        cleanQ.length > 0 &&
        !isNaN(Number(cleanQ)) &&
        (amountRialStr.includes(cleanQ) || amountTomanStr.includes(cleanQ))
      const cat = getCategory(tx.categoryId, customCategories)
      const categoryMatch = cat ? cat.name.toLowerCase().includes(q) : false
      const tagsMatch = tx.tags ? tx.tags.some((t) => t.toLowerCase().includes(q)) : false
      return noteMatch || amountMatch || categoryMatch || tagsMatch
    })
  }, [transactions, id, search, customCategories])
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
        <button
          className={`action-chip lg-light${disabled ? ' disabled' : ''}`}
          type="button"
          disabled={disabled}
          onClick={() => {
            setEditingPocket(undefined)
            setPocketFormOpen(true)
          }}
        >
          <span className="aico">👛</span>جیب‌ها
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

      <ShareByHandle kind="account" localId={account.id} title={account.name} payload={shareableAccount(account)} />

      {/* Pockets Section (Prominently displayed above card) */}
      <div style={{ margin: '14px 0 16px' }}>
        <div className="section-head" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h2>جیب‌ها</h2>
            {accountPockets.length > 0 ? (
              <span className="badge cash" style={{ fontSize: 11 }}>{toFaDigits(accountPockets.length)} جیب</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {accountPockets.length > 1 ? (
              <button
                type="button"
                className="cat-mini"
                onClick={() => setPocketTransferOpen(true)}
              >
                ⇄ انتقال بین جیب‌ها
              </button>
            ) : null}
          </div>
        </div>

        {accountPockets.length === 0 ? (
          <div
            className="home-card lg"
            style={{
              padding: '12px 14px',
              borderRadius: 16,
              background: 'var(--glass-chrome)',
              border: 'var(--glass-border)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>تفکیک حساب به چند جیب</div>
              <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', lineHeight: 1.4 }}>
                برای هر جیب، تراکنش‌ها جدا فهرست و جمع می‌شوند؛ پول همچنان از موجودی اصلی همین حساب کم یا به آن اضافه می‌شود.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {accountPockets.map((p) => {
              const bal = pocketBalances[p.id] ?? 0
              const isNegative = bal < 0
              const pocketCard = (
                <div
                  className="tx-row lg-row"
                  onClick={() => navigate(`/accounts/${account.id}/pockets/${p.id}`)}
                  style={{
                    cursor: 'pointer',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="tx-ico" style={{ fontSize: 20 }}>
                      {p.isMain ? '⭐' : p.isOwn ? '👛' : '🤝'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                        {p.isMain ? <span className="badge bank" style={{ fontSize: 10 }}>اصلی</span> : null}
                        {!p.isOwn ? (
                          <span
                            className="badge"
                            style={{ fontSize: 10, background: '#ea580c', color: '#fff' }}
                          >
                            امانی
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)', marginTop: 2 }}>
                        {p.isMain
                          ? 'موجودی اصلی حساب'
                          : p.isOwn
                            ? 'جیب شخصی شما'
                            : 'متعلق به دیگران (امکان ثبت قرض)'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    <div
                      className={`tx-amt ${bal > 0 ? 'income' : isNegative ? 'expense' : ''}`}
                      style={{ fontSize: 14, fontWeight: 700, color: isNegative ? '#ef4444' : undefined }}
                    >
                      {formatMoney(bal, false)}
                      <span className="unit">{unitLabel}</span>
                    </div>
                    {isNegative ? (
                      <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
                        ⚠️ موجودی منفی
                      </div>
                    ) : null}
                  </div>
                </div>
              )

              if (p.isMain) {
                return (
                  <div key={p.id}>
                    {pocketCard}
                  </div>
                )
              }

              return (
                <SwipeRow
                  key={p.id}
                  onEdit={() => {
                    setEditingPocket(p)
                    setPocketFormOpen(true)
                  }}
                  onDelete={() => {
                    if (window.confirm(`آیا از حذف جیب «${p.name}» اطمینان دارید؟ تراکنش‌های مرتبط به جیب اصلی نسبت داده می‌شوند.`)) {
                      void deletePocket(p.id)
                      notifyUser(`جیب «${p.name}» با موفقیت حذف شد`)
                    }
                  }}
                >
                  {pocketCard}
                </SwipeRow>
              )
            })}
          </div>
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
        {txs.length > 0 ? (
          <span className="link">{toFaDigits(txs.length)} مورد</span>
        ) : null}
      </div>

      {/* Search Bar for transactions on this account */}
      <div style={{ position: 'relative', margin: '4px 2px 10px' }}>
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 15,
            opacity: 0.6,
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          className="field-input"
          style={{ paddingRight: 36, paddingLeft: search ? 36 : 14, width: '100%' }}
          placeholder="جستجو در شرح، مبلغ یا دسته…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(15, 23, 42, 0.12)',
              border: 'none',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'grid',
              placeItems: 'center',
              fontSize: 11,
              color: 'var(--hy-text-secondary)',
              cursor: 'pointer',
            }}
            aria-label="پاک کردن جستجو"
          >
            ✕
          </button>
        ) : null}
      </div>

      <div className="tx-list">
        {txs.length === 0 ? (
          <div className="empty-state lg" style={{ marginTop: 8 }}>
            <div className="empty-ico">🧾</div>
            <h2>{search ? 'تراکنشی مطابق جستجو یافت نشد' : 'تراکنشی روی این حساب نیست'}</h2>
          </div>
        ) : (
          txs.map((tx) => <TxRow key={tx.id} tx={tx} accounts={accounts} forAccountId={account.id} />)
        )}
      </div>

      {pocketFormOpen ? (
        <PocketFormSheet
          accountId={account.id}
          pocket={editingPocket}
          onClose={() => {
            setPocketFormOpen(false)
            setEditingPocket(undefined)
          }}
        />
      ) : null}

      {pocketTransferOpen ? (
        <PocketTransferSheet
          accountId={account.id}
          onClose={() => setPocketTransferOpen(false)}
        />
      ) : null}
    </div>
  )
}
