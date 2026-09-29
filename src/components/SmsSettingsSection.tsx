import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { saveSmsSettings } from '../lib/sms/drafts'
import { listBankParsers } from '../lib/sms/parsers'
import { smsCapability } from '../lib/sms/reader'
import { useSmsDrafts } from '../lib/sms/useSmsDrafts'
import type { SmsSettings } from '../lib/sms/types'

export function SmsSettingsSection() {
  const { state, reload } = useSmsDrafts()
  const [explain, setExplain] = useState(false)
  const capability = smsCapability()
  if (!state) return null
  const settings = state.settings

  async function patch(next: Partial<SmsSettings>) {
    await saveSmsSettings(next)
    await reload()
  }

  return (
    <section className="lg settings-block">
      <h2>شناسایی تراکنش از پیامک</h2>
      <p className="sheet-sub">{capability.detail}</p>
      <SmsToggle label="شناسایی پیامک" checked={settings.enableDetection} onChange={(enableDetection) => void patch({ enableDetection })} />
      <SmsToggle label="تشخیص خودکار پیامک بانکی" checked={settings.autoDetect} onChange={(autoDetect) => void patch({ autoDetect })} />
      <SmsToggle label="نمایش اعلان" checked={settings.showNotifications} onChange={(showNotifications) => void patch({ showNotifications })} />
      <SmsToggle label="نگهداری متن پیامک" checked={settings.saveOriginalSms} onChange={(saveOriginalSms) => void patch({ saveOriginalSms })} />
      <SmsToggle label="توضیح اجباری هنگام تأیید" checked={settings.descriptionRequired} onChange={(descriptionRequired) => void patch({ descriptionRequired })} />
      <div className="sms-choice" role="group" aria-label="واحد نمایش">
        <button className={`home-pill${settings.displayUnit === 'IRR' ? '' : ' ghost'}`} type="button" onClick={() => void patch({ displayUnit: 'IRR' })}>ریال</button>
        <button className={`home-pill${settings.displayUnit === 'IRT' ? '' : ' ghost'}`} type="button" onClick={() => void patch({ displayUnit: 'IRT' })}>تومان</button>
      </div>
      <p className="sheet-sub">واحد نمایش فقط برچسب کارت را عوض می‌کند. اگر خود پیام واحد نداشته باشد، مبلغ حدس زده نمی‌شود. دفتر همیشه به ریال ذخیره می‌شود.</p>
      <p className="sheet-sub">الگوهای بانک: {listBankParsers().map((parser) => parser.label).join('، ')}</p>
      <div className="sms-actions">
        <button className="home-pill ghost" type="button" onClick={() => setExplain(true)}>دسترسی به پیامک</button>
        <Link className="home-pill ghost" to="/transactions/pending">تراکنش‌های در انتظار</Link>
      </div>
      {explain ? <SmsPermissionSheet settings={settings} onClose={() => setExplain(false)} onPatch={patch} /> : null}
    </section>
  )
}

function SmsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="sms-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function SmsPermissionSheet({
  settings,
  onClose,
  onPatch,
}: {
  settings: SmsSettings
  onClose: () => void
  onPatch: (patch: Partial<SmsSettings>) => Promise<void>
}) {
  const capability = smsCapability()
  const [note, setNote] = useState<string | null>(null)

  async function enableNotifications() {
    if (typeof Notification === 'undefined') {
      setNote('این مرورگر اعلان را پشتیبانی نمی‌کند. ثبت دستی همچنان کار می‌کند.')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      await onPatch({ showNotifications: true })
      setNote('اعلان روشن شد. مبلغ و متن پیامک روی صفحه قفل نشان داده نمی‌شود.')
      return
    }
    await onPatch({ showNotifications: false })
    setNote('اجازه اعلان داده نشد. برنامه برای ثبت دستی همچنان کامل است.')
  }

  return createPortal(
    <>
      <div className="sheet-scrim sheet-front" onClick={onClose} />
      <div className="glass-sheet sheet-front sheet-sticky-cta" role="dialog" aria-label="دسترسی به پیامک">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>دسترسی به پیامک</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="sheet-body-scroll">
          <p>برای شناسایی خودکار تراکنش‌های بانکی، برنامه نیاز دارد پیامک‌های بانکی را دریافت و پردازش کند.</p>
          <p>این دسترسی فقط برای شناسایی تراکنش‌های بانکی استفاده می‌شود.</p>
          <p className="sheet-sub">{capability.detail}</p>
          <p className="sheet-sub">رمز یکبارمصرف، رمز کارت و شماره کامل کارت ذخیره نمی‌شود. تا وقتی خودتان تأیید نکنید، مبلغ وارد دفتر نمی‌شود.</p>
          {note ? <p className="sheet-sub">{note}</p> : null}
        </div>
        <div className="sheet-footer">
          <button className="cta-confirm" type="button" onClick={() => void enableNotifications()}>
            {settings.showNotifications ? 'اعلان روشن است' : 'اجازه اعلان'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
