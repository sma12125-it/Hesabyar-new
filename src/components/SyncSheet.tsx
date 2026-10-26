import { useState } from 'react'
import { generateRecoveryCode, logoutCompletely } from '../lib/account'
import { replaceWithCloud, syncNow, type SyncResult } from '../lib/cloudSync'
import { ensureSession, loadSession, notifyUser, saveRecoveryCode, type CloudSession } from '../lib/sync'
import { WindowPopup } from './WindowPopup'

export function SyncSheet({
  onClose,
  onMinimize,
}: {
  onClose: () => void
  onMinimize?: () => void
}) {
  const [session] = useState<CloudSession | null>(() => loadSession())
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [recoveryCode, setRecoveryCode] = useState('')

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

  function describe(result: SyncResult): string {
    if (result.status === 'signed-out') return 'برای ذخیرهٔ زنده، از تنظیمات وارد حساب ابری شوید'
    if (result.status === 'blocked') {
      return `نسخهٔ ابر ${result.report?.removedCount ?? 0} ردیف این دستگاه را حذف می‌کرد و اعمال نشد. از «تنظیمات › پشتیبان‌گیری» بررسی کنید.`
    }
    return result.status === 'synced' ? 'این دستگاه و ابر ادغام و یکسان شدند' : 'این دستگاه و ابر از قبل یکسان بودند'
  }

  async function run(label: string, task: () => Promise<string>) {
    if (!session) return
    setError(null)
    try {
      const message = await task()
      setInfo(message)
      notifyUser(message)
    } catch (err) {
      const message = err instanceof Error ? err.message : label
      setError(message)
      notifyUser(message)
    }
  }

  // «ارسال دوباره»: pull, merge, push the merged result. Never overwrites rows it has not seen.
  const push = () => run('ارسال نشد', async () => describe(await syncNow({ force: true })))

  // «دریافت دوباره»: same merge, with a backup first. Nothing on this device is dropped unless the cloud deleted it.
  const pull = () =>
    run('دریافت نشد', async () => describe(await syncNow({ force: true, backupReason: 'پیش از دریافت دستی' })))

  const replace = () =>
    run('جایگزینی انجام نشد', async () => {
      const ok = window.confirm(
        'همهٔ داده‌های این دستگاه با نسخهٔ ابر جایگزین شود؟\nهر چیزی که فقط روی این دستگاه است حذف می‌شود. پیش از آن یک نسخهٔ پشتیبان خودکار گرفته می‌شود که از «تنظیمات › پشتیبان‌گیری» قابل بازگردانی است.',
      )
      if (!ok) return 'جایگزینی لغو شد'
      const done = await replaceWithCloud()
      if (!done) return 'روی ابر هنوز داده‌ای نیست'
      window.location.reload()
      return 'داده‌های این دستگاه با نسخهٔ ابر جایگزین شد'
    })

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
            <button className="cat-mini danger" type="button" onClick={() => void replace()}>جایگزینی با نسخه ابر</button>
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
