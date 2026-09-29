import { useEffect, useState } from 'react'
import { PatternLock } from './PatternLock'
import { checkPasswordVerifier, logoutCompletely, savePasswordVerifier, generateRecoveryCode } from '../lib/account'
import { checkPattern, loadLock, verifyBiometric } from '../lib/applock'
import {
  clearCloudDirty,
  loadSession,
  notifyUser,
  pullSnapshot,
  recoverWithCode,
  requestPasswordReset,
  saveRecoveryCode,
  saveSession,
  signIn,
  signUp,
  clearRecoveryFromUrl,
  takeRecoveryFromUrl,
  updatePassword,
  userFromToken,
  withoutSync,
  type CloudSession,
} from '../lib/sync'
import { useExtras } from '../store/Extras'
import { useStore } from '../store/Store'

interface Payload {
  accounts: never[]
  transactions: never[]
  plans: never[]
  items: never[]
  customCategories: unknown
  budgets: unknown
  goals: unknown
  reminders: unknown
  cardVault: unknown
}

type Mode = 'in' | 'up' | 'forgot' | 'code' | 'renew' | 'unlock' | 'code-show'

export function AuthGate({ onUnlock }: { onUnlock: () => void }) {
  const store = useStore()
  const extras = useExtras()
  const existing = loadSession()
  const [recovery] = useState(() => takeRecoveryFromUrl())
  const [mode, setMode] = useState<Mode>(recovery?.accessToken ? 'renew' : existing ? 'unlock' : 'in')
  const [recoveryToken] = useState(recovery?.accessToken ?? '')

  useEffect(() => {
    if (recovery) clearRecoveryFromUrl()
  }, [recovery])
  const [email, setEmail] = useState(existing?.email ?? '')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [code, setCode] = useState('')
  const [pattern, setPattern] = useState<number[]>([])
  const [error, setError] = useState<string | null>(recovery?.error ? 'لینک بازیابی منقضی شده است. کد بازیابی را وارد کنید.' : null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = loadLock()

  async function adopt(session: CloudSession, kind: 'in' | 'up') {
    const remote = await pullSnapshot<Payload>(session)
    if (remote?.data) {
      const data = remote.data
      await withoutSync(async () => {
        await extras.clearLocal()
        await store.importCloud({
          accounts: data.accounts ?? [],
          transactions: data.transactions ?? [],
          plans: data.plans ?? [],
          items: data.items ?? [],
          customCategories: (data.customCategories as never) ?? [],
        })
        await extras.importLocal(data as unknown as Record<string, unknown>)
      })
      clearCloudDirty()
      localStorage.setItem('hy-cloud-seen', String(remote.updatedAt))
      return
    }
    if (kind === 'in') {
      await withoutSync(async () => {
        await store.importCloud({ accounts: [], transactions: [], plans: [], items: [], customCategories: [] })
        await extras.clearLocal()
      })
      clearCloudDirty()
      return
    }
    localStorage.setItem('hy-cloud-dirty', '1')
  }

  async function finish(session: CloudSession, kind: 'in' | 'up', phrase: string) {
    saveSession(session)
    await savePasswordVerifier(session.email, phrase)
    await adopt(session, kind)
    onUnlock()
  }

  async function submitAccount() {
    setError(null)
    const trimmed = email.trim()
    if (!trimmed.includes('@')) {
      setError('ایمیل را کامل وارد کنید')
      return
    }
    if (password.length < 6) {
      setError('رمز حساب حداقل ۶ حرف است')
      return
    }
    if (mode === 'up' && password !== again) {
      setError('تکرار رمز یکسان نیست')
      return
    }
    setBusy(true)
    try {
      const session = mode === 'up' ? await signUp(trimmed, password) : await signIn(trimmed, password)
      if (mode === 'up') {
        const recoveryCode = generateRecoveryCode()
        await saveRecoveryCode(session, recoveryCode)
        saveSession(session)
        await savePasswordVerifier(session.email, password)
        await adopt(session, 'up')
        setCode(recoveryCode)
        setMode('code-show')
        return
      }
      await finish(session, 'in', password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  async function unlockWithPassword() {
    setError(null)
    const session = loadSession()
    if (!session) {
      setMode('in')
      return
    }
    setBusy(true)
    try {
      if (await checkPasswordVerifier(password)) {
        onUnlock()
        return
      }
      const next = await signIn(session.email, password)
      saveSession(next)
      await savePasswordVerifier(next.email, password)
      onUnlock()
    } catch {
      setError('رمز نادرست است')
    } finally {
      setBusy(false)
    }
  }

  async function finishPattern(next: number[]) {
    if (next.length < 4) return
    if (await checkPattern(next.join('-'))) {
      onUnlock()
      return
    }
    setError('الگو نادرست است')
    setPattern([])
  }

  async function useBiometric() {
    setError(null)
    try {
      if (await verifyBiometric()) onUnlock()
      else setError('قفل گوشی تأیید نشد')
    } catch {
      setError('قفل گوشی تأیید نشد')
    }
  }

  async function sendReset() {
    setError(null)
    setBusy(true)
    try {
      await requestPasswordReset(email.trim())
      setInfo('اگر ایمیل برسد، لینکش را باز کنید. اگر صفحه خالی شد، همان کد بازیابی را در فرم زیر وارد کنید.')
      setMode('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ایمیل فرستاده نشد')
    } finally {
      setBusy(false)
    }
  }

  async function resetWithCode() {
    setError(null)
    if (password.length < 6 || password !== again) {
      setError('رمز تازه حداقل ۶ حرف است و باید تکرارش یکسان باشد')
      return
    }
    setBusy(true)
    try {
      await recoverWithCode(email.trim(), code.trim(), password)
      const session = await signIn(email.trim(), password)
      await finish(session, 'in', password)
      notifyUser('رمز حساب عوض شد')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بازیابی ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  async function resetFromLink() {
    setError(null)
    if (password.length < 6 || password !== again) {
      setError('رمز تازه حداقل ۶ حرف است و باید تکرارش یکسان باشد')
      return
    }
    setBusy(true)
    try {
      await updatePassword(recoveryToken, password)
      const user = await userFromToken(recoveryToken)
      const session = await signIn(user.email, password)
      await finish(session, 'in', password)
      notifyUser('رمز حساب عوض شد')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تغییر رمز ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  if (!store.ready && mode !== 'renew' && mode !== 'code') {
    return (
      <div className="lock-screen">
        <h1>حساب‌یار</h1>
        <p className="sheet-sub">در حال آماده‌سازی…</p>
      </div>
    )
  }

  return (
    <div className="lock-screen">
      <h1>ورود به حساب‌یار</h1>
      {error ? <div className="banner error"><span>{error}</span></div> : null}
      {info ? <p className="sheet-sub">{info}</p> : null}

      {mode === 'unlock' ? (
        <>
          <p className="sheet-sub">{existing ? `حساب ${existing.email}` : 'برای دیدن اطلاعات وارد شوید.'}</p>
          <div className="field-stack">
            <input className="field-input" type="password" placeholder="رمز حساب" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="cta-confirm" type="button" disabled={busy} onClick={() => void unlockWithPassword()}>ورود با رمز</button>
          </div>
          {lock.credentialId ? (
            <button className="cat-mini" type="button" onClick={() => void useBiometric()}>ورود با اثر انگشت یا چهرهٔ گوشی</button>
          ) : null}
          {lock.patternHash ? <PatternLock value={pattern} onChange={setPattern} onRelease={(next) => void finishPattern(next)} /> : null}
          <button className="link" type="button" onClick={() => { setError(null); setMode('code') }}>رمز را فراموش کرده‌ام</button>
          <button className="cat-mini danger" type="button" onClick={() => void logoutCompletely()}>خروج کامل</button>
        </>
      ) : null}

      {mode === 'in' || mode === 'up' ? (
        <div className="field-stack">
          <p className="sheet-sub">
            {mode === 'up'
              ? 'اولین ورود یک حساب می‌سازد و فقط اطلاعات همین حساب در ابر ذخیره می‌شود.'
              : 'با ایمیل و رمز همان حساب وارد شوید. فقط اطلاعات این حساب نشان داده می‌شود.'}
          </p>
          <input className="field-input" type="email" placeholder="ایمیل" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="field-input" type="password" placeholder="رمز حداقل ۶ حرف" value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === 'up' ? <input className="field-input" type="password" placeholder="تکرار رمز" value={again} onChange={(e) => setAgain(e.target.value)} /> : null}
          <button className="cta-confirm" type="button" disabled={busy} onClick={() => void submitAccount()}>
            {mode === 'up' ? 'ساخت حساب' : 'ورود'}
          </button>
          {mode === 'in' ? (
            <>
              <button className="link" type="button" onClick={() => { setError(null); setMode('up') }}>حساب ندارم</button>
              <button className="link" type="button" onClick={() => { setError(null); setMode('code') }}>رمز را فراموش کرده‌ام</button>
            </>
          ) : (
            <button className="link" type="button" onClick={() => { setError(null); setMode('in') }}>حساب دارم</button>
          )}
        </div>
      ) : null}

      {mode === 'forgot' ? (
        <div className="field-stack">
          <p className="sheet-sub">ایمیل حساب را بنویسید. لینک بازیابی فرستاده می‌شود. اگر کد بازیابی را دارید، با همان رمز تازه بسازید.</p>
          <input className="field-input" type="email" placeholder="ایمیل" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="cta-confirm" type="button" disabled={busy} onClick={() => void sendReset()}>ارسال لینک بازیابی</button>
          <button className="link" type="button" onClick={() => { setError(null); setMode('code') }}>کد بازیابی دارم</button>
          <button className="link" type="button" onClick={() => { setError(null); setMode(existing ? 'unlock' : 'in') }}>بازگشت</button>
        </div>
      ) : null}

      {mode === 'code' ? (
        <div className="field-stack">
          <p className="sheet-sub">کد بازیابی حساب و رمز تازه را بنویسید. لینک ایمیل اگر صفحهٔ خالی باز کرد، از همین فرم استفاده کنید.</p>
          <input className="field-input" type="email" placeholder="ایمیل" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="field-input" placeholder="کد بازیابی" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="field-input" type="password" placeholder="رمز تازه" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input className="field-input" type="password" placeholder="تکرار رمز تازه" value={again} onChange={(e) => setAgain(e.target.value)} />
          <button className="cta-confirm" type="button" disabled={busy} onClick={() => void resetWithCode()}>ثبت رمز تازه</button>
          <button className="link" type="button" onClick={() => { setError(null); setMode('forgot') }}>ارسال لینک به ایمیل</button>
          <button className="link" type="button" onClick={() => { setError(null); setMode(existing ? 'unlock' : 'in') }}>بازگشت</button>
        </div>
      ) : null}

      {mode === 'renew' ? (
        <div className="field-stack">
          <p className="sheet-sub">رمز تازهٔ حساب را بنویسید.</p>
          <input className="field-input" type="password" placeholder="رمز تازه" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input className="field-input" type="password" placeholder="تکرار رمز تازه" value={again} onChange={(e) => setAgain(e.target.value)} />
          <button className="cta-confirm" type="button" disabled={busy} onClick={() => void resetFromLink()}>ثبت رمز تازه</button>
        </div>
      ) : null}

      {mode === 'code-show' ? (
        <div className="field-stack">
          <p className="sheet-sub">این کد بازیابی رمز حساب است. اگر رمز را فراموش کنید، با همین کد رمز تازه می‌سازید. یک‌بار نشان داده می‌شود.</p>
          <p className="recovery-code">{code}</p>
          <button className="cta-confirm" type="button" onClick={onUnlock}>ذخیره کردم، ادامه</button>
        </div>
      ) : null}
    </div>
  )
}
