import { useState } from 'react'
import { WindowPopup } from './WindowPopup'
import { AmountField } from './AmountField'
import { useStore } from '../store/Store'
import { computePocketBalances } from '../lib/balance'
import { formatRial } from '../lib/money'
import { notifyUser } from '../lib/sync'
import type { Pocket } from '../types'

export function PocketFormSheet({
  accountId,
  pocket,
  onClose,
  onMinimize,
}: {
  accountId: string
  pocket?: Pocket
  onClose: () => void
  onMinimize?: () => void
}) {
  const { accounts, transactions, pockets, pocketTransfers, createPocket, updatePocket } = useStore()
  const account = accounts.find((a) => a.id === accountId)
  const isEdit = Boolean(pocket)

  const [name, setName] = useState(pocket?.name ?? '')
  const [isOwn, setIsOwn] = useState(pocket?.isOwn ?? true)
  const [openingBalance, setOpeningBalance] = useState(pocket?.openingBalance ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Compute current main pocket balance to inform user about max available initial transfer
  const balances = account ? computePocketBalances(account, transactions, pockets, pocketTransfers) : {}
  const mainPocket = pockets.find((p) => p.accountId === accountId && p.isMain && !p.archived)
  const mainBalance = mainPocket ? (balances[mainPocket.id] ?? 0) : (account?.balance ?? 0)

  const isMain = Boolean(pocket?.isMain)
  const trimmedName = name.trim()
  const disabled = saving || !trimmedName

  async function handleSave() {
    if (!trimmedName) {
      setError('نام جیب را وارد کنید')
      return
    }
    if (!account) {
      setError('حساب یافت نشد')
      return
    }

    setError(null)
    setSaving(true)
    try {
      if (isEdit && pocket) {
        await updatePocket(pocket.id, {
          name: trimmedName,
          isOwn: isMain ? true : isOwn,
          openingBalance: isMain ? pocket.openingBalance : openingBalance,
        })
        notifyUser('تغییرات جیب ذخیره شد')
      } else {
        await createPocket({
          accountId,
          name: trimmedName,
          isOwn,
          openingBalance,
        })
        notifyUser('جیب جدید با موفقیت ایجاد شد')
      }
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت جیب'
      setError(msg)
      notifyUser(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <WindowPopup
      title={isEdit ? 'ویرایش جیب' : 'افزودن جیب جدید'}
      subtitle={account ? `حساب: ${account.name}` : undefined}
      icon="👛"
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      defaultWidth={480}
      defaultHeight={540}
      footer={
        <button
          className={`cta-confirm${disabled ? ' disabled' : ''}`}
          type="button"
          onClick={() => void handleSave()}
          disabled={disabled}
          style={{ width: '100%' }}
        >
          {saving ? 'در حال ثبت…' : isEdit ? 'ذخیره تغییرات' : 'ایجاد جیب'}
        </button>
      }
    >
      <div className="sheet-body-scroll">
        {error ? (
          <div className="banner error">
            <span className="bico">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}

        {isMain ? (
          <div className="banner info" style={{ marginBottom: 12 }}>
            <span className="bico">ℹ️</span>
            <span>این جیب، جیب اصلی این حساب است و همواره موجودی پایه کارت را نگه می‌دارد.</span>
          </div>
        ) : null}

        <div className="field-stack">
          {/* Pocket Name */}
          <div className="field-chip" style={{ cursor: 'text' }}>
            <span className="ficon">🏷️</span>
            <div style={{ flex: 1 }}>
              <div className="flabel">نام جیب</div>
              <input
                className="field-input"
                placeholder="مثلاً: سهم مادر، خرج سفر، پس‌انداز..."
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Ownership toggle */}
          {!isMain ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'var(--glass-chrome)',
                border: 'var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>مالکیت وجوه این جیب:</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`cat-mini${isOwn ? ' active' : ''}`}
                    onClick={() => setIsOwn(true)}
                  >
                    شخصی خودم
                  </button>
                  <button
                    type="button"
                    className={`cat-mini${!isOwn ? ' active' : ''}`}
                    onClick={() => setIsOwn(false)}
                    style={{
                      background: !isOwn ? '#ea580c' : undefined,
                      borderColor: !isOwn ? '#ea580c' : undefined,
                      color: !isOwn ? '#fff' : undefined,
                    }}
                  >
                    امانی / دیگران
                  </button>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--hy-text-secondary)', lineHeight: 1.5 }}>
                {isOwn
                  ? 'این جیب متعلق به خودتان است (مثلاً برای بودجه‌بندی هزینه‌ها یا پس‌انداز هدفمند).'
                  : 'این جیب متعلق به شخص دیگری است (مثل سهم مادر یا دوست). هنگام خرج از این جیب برای خودتان، سیستم پیشنهاد ثبت قرض را می‌دهد تا بعداً بتوانید بازپرداخت کنید.'}
              </p>
            </div>
          ) : null}

          {/* Opening balance allocation */}
          {!isMain ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: 'var(--glass-chrome)',
                border: 'var(--glass-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>موجودی اولیه جیب (به ریال)</span>
                <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                  موجودی جیب اصلی: {formatRial(mainBalance)} ریال
                </span>
              </div>
              <AmountField
                value={openingBalance}
                onChange={setOpeningBalance}
                placeholder="مبلغ شروع جیب (اختیاری)"
                ariaLabel="موجودی اولیه جیب به ریال"
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                {isEdit
                  ? 'موجودی اولیه ثبت‌شده برای این جیب در محاسبات.'
                  : 'مبلغ شروع این جیب. موجودی حساب تغییر نمی‌کند؛ تراکنش‌های این جیب همچنان از موجودی اصلی حساب کم یا به آن اضافه می‌شوند.'}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </WindowPopup>
  )
}
