import { useEffect, useState } from 'react'
import { PatternLock } from '../components/PatternLock'
import { SyncSheet } from '../components/SyncSheet'
import { loadLock, registerBiometric, setPattern, type AppLockRecord } from '../lib/applock'
import { rememberedAccountPassword } from '../lib/account'
import { joinSharedCode } from '../lib/share'
import { toFaDigits } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useExtras } from '../store/Extras'
import { SmsSettingsSection } from '../components/SmsSettingsSection'
import { VaultRecover } from '../components/VaultRecover'

type Popup = 'cloud' | 'security' | 'vault' | null

export function SettingsPage({ onScroll }: { onScroll: (compact: boolean) => void }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const [popup, setPopup] = useState<Popup>(null)
  const [shareCode, setShareCode] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('hy-theme', theme)
  }, [theme])

  return (
    <div className="app-scroll settings-page" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="top-row">
        <h1>تنظیمات</h1>
        <span style={{ width: 40 }} />
      </div>
      <section className="lg settings-block">
        <h2>ظاهر</h2>
        <p className="sheet-sub">روشن یا تاریک، با همان زبان شیشه‌ای.</p>
        <div className="seg" role="tablist">
          <button className={`seg-btn${theme === 'light' ? ' active' : ''}`} type="button" onClick={() => setTheme('light')}>روشن</button>
          <button className={`seg-btn${theme === 'dark' ? ' active' : ''}`} type="button" onClick={() => setTheme('dark')}>تاریک</button>
        </div>
      </section>
      <SmsSettingsSection />
      <section className="lg settings-block">
        <h2>پیوستن به کارت مشترک</h2>
        <p className="sheet-sub">کدی که صاحب کارت به شما داده را وارد کنید. درآمد و هزینهٔ همان کارت برای هر دو نفر به‌روز می‌شود.</p>
        {shareError ? <div className="banner error"><span>{shareError}</span></div> : null}
        <div className="field-stack">
          <input
            className="field-input"
            placeholder="کد اشتراک"
            value={shareCode}
            onChange={(e) => setShareCode(e.target.value.toUpperCase())}
            aria-label="کد اشتراک"
          />
          <button
            className="cta-confirm"
            type="button"
            disabled={joining || shareCode.trim().length < 4}
            onClick={() => {
              setJoining(true)
              setShareError(null)
              void joinSharedCode(shareCode)
                .then(() => {
                  setShareCode('')
                  notifyUser('به کارت مشترک پیوستید')
                  window.dispatchEvent(new Event('hy-share-refresh'))
                })
                .catch((err: unknown) => {
                  setShareError(err instanceof Error ? err.message : 'پیوستن انجام نشد')
                })
                .finally(() => setJoining(false))
            }}
          >
            {joining ? 'در حال پیوستن…' : 'پیوستن'}
          </button>
        </div>
      </section>
      <button className="settings-row lg" type="button" onClick={() => setPopup('cloud')}>
        <span>
          <strong>اتصال ابری</strong>
          <small>حساب متصل، همگام‌سازی خودکار، و خروج کامل.</small>
        </span>
        <span className="fchev">‹</span>
      </button>
      <button className="settings-row lg" type="button" onClick={() => setPopup('vault')}>
        <span>
          <strong>گاوصندوق کارت</strong>
          <small>رمز گاوصندوق اینجا تعیین می‌شود و قفل کارت‌ها با همان رمز باز می‌شود.</small>
        </span>
        <span className="fchev">‹</span>
      </button>
      <button className="settings-row lg" type="button" onClick={() => setPopup('security')}>
        <span>
          <strong>امنیت ورود</strong>
          <small>الگوی کشیدنی، یا روشن کردن ورود با اثر انگشت و چهرهٔ خود گوشی.</small>
        </span>
        <span className="fchev">‹</span>
      </button>
      <p className="settings-credit">سازنده محمد احمدی · نسخه {toFaDigits('0.1.0').replaceAll('.', '\u066b')}</p>
      {popup === 'cloud' ? <SyncSheet onClose={() => setPopup(null)} /> : null}
      {popup === 'security' ? <SecurityPopup onClose={() => setPopup(null)} /> : null}
      {popup === 'vault' ? <VaultPopup onClose={() => setPopup(null)} /> : null}
    </div>
  )
}

function SecurityPopup({ onClose }: { onClose: () => void }) {
  const [pattern, setPatternValue] = useState<number[]>([])
  const [lock, setLock] = useState<AppLockRecord>(() => loadLock())
  const [info, setInfo] = useState<string | null>(null)

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet" role="dialog" aria-label="امنیت ورود">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>امنیت ورود</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="sheet-body-scroll">
          <p className="sheet-sub">رمز ورود همان رمز حساب است. اثر انگشت و چهره از قفل خود گوشی خوانده می‌شود و داخل برنامه ذخیره نمی‌شود.</p>
          <p className="sheet-sub">الگو را با کشیدن انگشت روی نقطه‌ها بکشید، نه با کلیک جدا روی هر نقطه.</p>
          <PatternLock value={pattern} onChange={setPatternValue} />
          <button className="cat-mini" type="button" onClick={() => { if (pattern.length < 4) { setInfo('حداقل ۴ نقطه را به هم وصل کنید'); return }; void setPattern(pattern.join('-')).then(() => { setLock(loadLock()); setPatternValue([]); setInfo('الگو ذخیره شد') }) }}>ثبت الگو</button>
          <button
            className="cta-confirm"
            type="button"
            onClick={() => void registerBiometric()
              .then(() => { setLock(loadLock()); setInfo('ورود با قفل گوشی روشن شد') })
              .catch((err) => setInfo(err instanceof Error ? err.message : 'قفل گوشی در دسترس نیست'))}
          >
            فعال کردن ورود با اثر انگشت یا چهره
          </button>
          <p className="sheet-sub">
            {lock.patternHash ? 'الگو روشن است. ' : ''}
            {lock.credentialId ? 'قفل گوشی روشن است.' : 'قفل گوشی خاموش است.'}
          </p>
          {info ? <p className="sheet-sub">{info}</p> : null}
        </div>
      </div>
    </>
  )
}

function VaultPopup({ onClose }: { onClose: () => void }) {
  const { vaultConfigured, setVaultPassword, changeVaultPassword } = useExtras()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [accountPassword, setAccountPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [forgot, setForgot] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    setInfo(null)
    if (next.length < 4) {
      setError('رمز حداقل ۴ حرف است')
      return
    }
    if (next !== again) {
      setError('تکرار رمز یکسان نیست')
      return
    }
    try {
      const account = accountPassword || rememberedAccountPassword()
      const code = vaultConfigured
        ? await changeVaultPassword(current, next, account)
        : await setVaultPassword(next, account)
      setRecoveryCode(code)
      setInfo(vaultConfigured ? 'رمز گاوصندوق عوض شد' : 'رمز گاوصندوق تعیین شد')
      notifyUser('رمز گاوصندوق ذخیره شد')
      setCurrent('')
      setNext('')
      setAgain('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'رمز ذخیره نشد'
      setError(message)
      notifyUser(message)
    }
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet" role="dialog" aria-label="گاوصندوق کارت">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>گاوصندوق کارت</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="sheet-body-scroll">
          <p className="sheet-sub">
            {vaultConfigured
              ? 'رمز فعلی و رمز تازه را بنویسید. کارت‌ها با رمز تازه دوباره قفل می‌شوند.'
              : 'یک رمز برای گاوصندوق بگذارید. کد بازیابی را نگه دارید تا اگر رمز را فراموش کردید کارت‌ها بمانند.'}
          </p>
          {vaultConfigured ? <input className="field-input" type="password" placeholder="رمز فعلی گاوصندوق" value={current} onChange={(e) => setCurrent(e.target.value)} /> : null}
          <input className="field-input" type="password" placeholder="رمز گاوصندوق" value={next} onChange={(e) => setNext(e.target.value)} />
          <input className="field-input" type="password" placeholder="تکرار رمز" value={again} onChange={(e) => setAgain(e.target.value)} />
          {rememberedAccountPassword() ? null : <input className="field-input" type="password" placeholder="رمز حساب، برای بازیابی بعدی" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} />}
          <button className="cta-confirm" type="button" onClick={() => void save()}>ثبت رمز</button>
          {recoveryCode ? (
            <>
              <p className="sheet-sub">کد بازیابی گاوصندوق را نگه دارید. با این کد یا با رمز حساب می‌توانید رمز گاوصندوق را عوض کنید.</p>
              <p className="recovery-code">{recoveryCode}</p>
            </>
          ) : null}
          {vaultConfigured ? <button className="link" type="button" onClick={() => setForgot((value) => !value)}>رمز گاوصندوق را فراموش کرده‌ام</button> : null}
          {forgot ? <VaultRecover onDone={(code) => { setRecoveryCode(code); setForgot(false); setInfo('رمز گاوصندوق بازیابی شد') }} /> : null}
          {error ? <div className="banner error"><span>{error}</span></div> : null}
          {info ? <p className="sheet-sub">{info}</p> : null}
        </div>
      </div>
    </>
  )
}
