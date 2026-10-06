import { useState } from 'react'
import { formatRial, validateAccountName } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import { AmountField } from './AmountField'
import { BankCardFace } from './BankCardFace'
import { WindowPopup } from './WindowPopup'
import type { Account, AccountClassification, AccountType, BankCard } from '../types'

export function AccountFormSheet({
  account,
  totalBalance,
  onClose,
  onMinimize,
}: {
  account?: Account
  totalBalance: number
  onClose: () => void
  onMinimize?: () => void
}) {
  const { createAccount, updateAccount } = useStore()
  const { unlocked, cards, unlockVault, linkCard } = useExtras()
  const [source, setSource] = useState<'pick' | 'fresh'>(account ? 'fresh' : 'pick')
  const [phrase, setPhrase] = useState('')
  const [picked, setPicked] = useState<BankCard | null>(null)
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'cash')
  const [classification, setClassification] = useState<AccountClassification>(
    account?.classification ?? 'cash'
  )
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? '')
  const [initialBalance, setInitialBalance] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(account)
  const nameError = validateAccountName(name)
  const canSave = !nameError && !saving

  async function save() {
    setError(null)
    if (nameError) {
      setError(nameError)
      return
    }
    setSaving(true)
    try {
      if (isEdit && account) {
        await updateAccount(account.id, { name, type, classification, accountNumber })
      } else {
        const created = await createAccount({
          name: picked ? `${picked.bankName} ${picked.pan.slice(-4)}` : name,
          type: picked ? 'bank' : type,
          classification: picked?.classification ?? classification,
          accountNumber: picked?.accountNumber ?? accountNumber,
          initialBalance,
          cardId: picked?.id,
        })
        if (picked) await linkCard(picked.id, created.id)
      }
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ذخیره نشد'
      setError(message)
      notifyUser(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <WindowPopup
      title={isEdit ? 'ویرایش حساب' : 'حساب جدید'}
      subtitle={`موجودی کل فعلی: ${formatRial(totalBalance)} ریال`}
      icon="💳"
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      defaultWidth={500}
      defaultHeight={640}
      footer={
        isEdit || source === 'fresh' ? (
          <button
            className={`cta-confirm${canSave ? '' : ' disabled'}`}
            type="button"
            disabled={!canSave}
            onClick={() => void save()}
          >
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
        ) : null
      }
    >
      <div className="sheet-body-scroll" style={{ padding: '6px 0 16px' }}>
        {error ? (
          <div className="banner error">
            <span className="bico">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}
        {!isEdit && source === 'pick' ? (
          <div className="field-stack">
            <p className="sheet-sub">از کارت یا حساب تعریف‌شده استفاده کن، یا یک حساب تازه با عنوان جدید بساز.</p>
            {!unlocked ? (
              <div className="field-chip">
                <input className="field-input" type="password" placeholder="رمز گاوصندوق برای دیدن کارت‌ها" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
                <button className="cat-mini" type="button" onClick={() => void unlockVault(phrase).catch(() => setError('رمز گاوصندوق نادرست است'))}>باز کردن</button>
              </div>
            ) : cards.filter((card) => !card.accountId).length === 0 ? (
              <p className="sheet-sub">کارت آزادی برای اتصال نیست.</p>
            ) : (
              cards.filter((card) => !card.accountId).map((card) => (
                <button key={card.id} className="card-pick" type="button" onClick={() => { setPicked(card); setSource('fresh'); setType('bank'); setName(`${card.bankName} ${card.pan.slice(-4)}`) }}>
                  <BankCardFace card={card} />
                </button>
              ))
            )}
            <button className="cta-confirm" type="button" onClick={() => { setPicked(null); setSource('fresh') }}>حساب تازه با عنوان جدید</button>
          </div>
        ) : null}
        {isEdit || source === 'fresh' ? (
        <div className="field-stack">
          <div className={`field-chip${error && nameError ? ' invalid' : ''}`}>
            <span className="ficon">✏️</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">نام حساب</div>
              <input
                className="field-input"
                placeholder="نام را وارد کنید…"
                value={name}
                autoFocus
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
              />
            </div>
          </div>
          {error && nameError ? <div className="field-error">{nameError}</div> : null}

          <div style={{ margin: '4px 0 2px', fontSize: 12, fontWeight: 600, color: 'var(--hy-text-tertiary)', paddingRight: 4 }}>
            نوع
          </div>
          <div className="seg type-seg" role="tablist">
            <div className={`seg-thumb${type === 'bank' ? ' type-bank' : ''}`} aria-hidden="true" />
            <button
              className={`seg-btn cash${type === 'cash' ? ' active' : ''}`}
              type="button"
              onClick={() => setType('cash')}
            >
              نقد
            </button>
            <button
              className={`seg-btn bank${type === 'bank' ? ' active' : ''}`}
              type="button"
              onClick={() => setType('bank')}
            >
              بانک
            </button>
          </div>

          <div style={{ margin: '4px 0 2px', fontSize: 12, fontWeight: 600, color: 'var(--hy-text-tertiary)', paddingRight: 4 }}>
            دسته‌بندی موجودی
          </div>
          <div className="seg" role="tablist">
            <button
              className={`seg-btn${classification === 'cash' ? ' active' : ''}`}
              type="button"
              onClick={() => setClassification('cash')}
              style={{ fontSize: 11, padding: '6px 4px' }}
            >
              نقدی و جاری
            </button>
            <button
              className={`seg-btn${classification === 'credit' ? ' active' : ''}`}
              type="button"
              onClick={() => setClassification('credit')}
              style={{ fontSize: 11, padding: '6px 4px' }}
            >
              اعتبار خرید
            </button>
            <button
              className={`seg-btn${classification === 'investment' ? ' active' : ''}`}
              type="button"
              onClick={() => setClassification('investment')}
              style={{ fontSize: 11, padding: '6px 4px' }}
            >
              پس‌انداز و سرمایه
            </button>
          </div>

          <div className="field-chip">
            <span className="ficon">🔢</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">شماره حساب بانکی (اختیاری)</div>
              <input
                className="field-input"
                placeholder="مثال: ۱۰۲۹۳۸۴۷۵۶"
                dir="ltr"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
          </div>

          {!isEdit ? (
            <div className="field-chip">
              <span className="ficon">💰</span>
              <div style={{ flex: 1 }}>
                <div className="flabel">موجودی اولیه</div>
                <AmountField
                  value={initialBalance}
                  onChange={setInitialBalance}
                  ariaLabel="موجودی اولیه به ریال"
                />
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--hy-text-tertiary)' }}>ریال</span>
            </div>
          ) : null}
        </div>
        ) : null}
      </div>
    </WindowPopup>
  )
}
