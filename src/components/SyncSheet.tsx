import { useState } from 'react'
import { generateRecoveryCode, logoutCompletely } from '../lib/account'
import { ensureSession, loadSession, notifyUser, pullSnapshot, pushSnapshot, saveRecoveryCode, type CloudSession } from '../lib/sync'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'
import { WindowPopup } from './WindowPopup'

interface Payload {
  updatedAt: number
  accounts: unknown
  transactions: unknown
  plans: unknown
  items: unknown
  customCategories: unknown
  budgets: unknown
  goals: unknown
  cheques: unknown
  debts: unknown
  reminders: unknown
  cardVault: unknown
  currencyUnit?: unknown
}

export function SyncSheet({
  onClose,
  onMinimize,
}: {
  onClose: () => void
  onMinimize?: () => void
}) {
  const store = useStore()
  const extras = useExtras()
  const [session] = useState<CloudSession | null>(() => loadSession())
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [recoveryCode, setRecoveryCode] = useState('')

  async function payload(): Promise<Payload> {
    const local = await extras.exportLocal()
    return {
      updatedAt: Date.now(),
      accounts: store.accounts,
      transactions: store.transactions,
      plans: store.plans,
      items: store.items,
      customCategories: store.customCategories,
      budgets: local.budgets,
      goals: local.goals,
      cheques: local.cheques,
      debts: local.debts,
      reminders: local.reminders,
      cardVault: local.cardVault,
      currencyUnit: local.currencyUnit,
    }
  }

  async function makeRecoveryCode() {
    if (!session) return
    setError(null)
    try {
      const active = await ensureSession()
      if (!active) throw new Error('اول وارد حساب شوید')
      const code = generateRecoveryCode()
      await saveRecoveryCode(active, code)
      setRecoveryCode(code)
      setInfo('کد تازه ساخته شد. کد قبلی دیگر کار نمی‌کند.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'کد ساخته نشد'
      setError(message)
      notifyUser(message)
    }
  }

  async function push() {
    if (!session) return
    setError(null)
    try {
      const data = await payload()
      const active = await ensureSession()
      if (!active) throw new Error('برای ذخیرهٔ زنده، از تنظیمات وارد حساب ابری شوید')
      await pushSnapshot(active, { updatedAt: data.updatedAt, data })
      setInfo('داده روی Supabase ذخیره شد')
      notifyUser('روی ابر ذخیره شد')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ارسال نشد'
      setError(message)
      notifyUser(message)
    }
  }

  async function pull() {
    if (!session) return
    setError(null)
    try {
      const active = await ensureSession()
      if (!active) throw new Error('برای ذخیرهٔ زنده، از تنظیمات وارد حساب ابری شوید')
      const remote = await pullSnapshot<Payload>(active)
      if (!remote) {
        setInfo('روی ابر هنوز داده‌ای نیست')
        return
      }
      const { replaceAllData, setKv } = await import('../db/db')
      const data = remote.data
      await replaceAllData(
        (data.accounts as never) ?? [],
        (data.transactions as never) ?? [],
        (data.plans as never) ?? [],
        (data.items as never) ?? [],
      )
      await setKv('customCategories', data.customCategories ?? [])
      await extras.importLocal(data as unknown as Record<string, unknown>)
      window.location.reload()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'دریافت نشد'
      setError(message)
      notifyUser(message)
    }
  }

  return (
    <WindowPopup
      title="اتصال و همگام‌سازی ابری"
      subtitle={session ? `متصل به: ${session.email}` : 'پشتیبان‌گیری و همگام‌سازی بین دستگاه‌ها'}
      icon="☁️"
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      defaultWidth={480}
      defaultHeight={540}
    >
      <div className="sheet-body-scroll" style={{ padding: '4px 0 16px' }}>
        <p className="sheet-sub">بعد از ورود، هر تراکنش خودش روی ابر ذخیره می‌شود و دستگاه‌های دیگر همین حساب همان لحظه به‌روز می‌شوند.</p>
        {error ? <div className="banner error"><span>{error}</span></div> : null}
        {info ? <p className="sheet-sub">{info}</p> : null}
        <p className="sheet-sub">{session ? `متصل: ${session.email}` : 'با ایمیل وارد شوید. بعد از ورود، ارسال و دریافت خودکار است.'}</p>
        {session ? (
          <div className="confirm-actions" style={{ marginTop: 12 }}>
            <button className="cta-confirm" type="button" onClick={() => void push()}>ارسال دوباره</button>
            <button className="cta-confirm" type="button" onClick={() => void pull()}>دریافت دوباره</button>
            <button className="cat-mini" type="button" onClick={() => void makeRecoveryCode()}>کد بازیابی رمز حساب</button>
            {recoveryCode ? <p className="recovery-code">{recoveryCode}</p> : null}
            <button className="cat-mini danger" type="button" onClick={() => void logoutCompletely()}>خروج کامل</button>
          </div>
        ) : (
          <p className="sheet-sub">از صفحهٔ ورود با ایمیل و رمز وارد شوید.</p>
        )}
      </div>
    </WindowPopup>
  )
}
