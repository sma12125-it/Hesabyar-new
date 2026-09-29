import { useState } from 'react'
import { notifyUser } from '../lib/sync'
import { useExtras } from '../store/Extras'

export function VaultRecover({ onDone }: { onDone: (code: string) => void }) {
  const { recoverVaultPassword, resetVault } = useExtras()
  const [mode, setMode] = useState<'account' | 'code'>('account')
  const [secret, setSecret] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    if (next.length < 4) {
      setError('رمز تازه حداقل ۴ حرف است')
      return
    }
    if (next !== again) {
      setError('تکرار رمز یکسان نیست')
      return
    }
    try {
      const code = await recoverVaultPassword(secret, mode, next)
      notifyUser('رمز گاوصندوق عوض شد')
      onDone(code)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'بازیابی نشد'
      setError(message)
      notifyUser(message)
    }
  }

  async function startOver() {
    setError(null)
    if (next.length < 4 || next !== again) {
      setError('رمز تازه و تکرارش را بنویسید')
      return
    }
    try {
      const code = await resetVault(next, mode === 'account' ? secret : undefined)
      notifyUser('گاوصندوق تازه ساخته شد')
      onDone(code)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ساخته نشد'
      setError(message)
      notifyUser(message)
    }
  }

  return (
    <div className="field-stack">
      <p className="sheet-sub">رمز گاوصندوق را با رمز حساب، یا با کد بازیابی که هنگام ساخت گاوصندوق نشان داده شد، عوض کنید. کارت‌ها می‌مانند.</p>
      <div className="seg">
        <button className={`seg-btn${mode === 'account' ? ' active' : ''}`} type="button" onClick={() => setMode('account')}>رمز حساب</button>
        <button className={`seg-btn${mode === 'code' ? ' active' : ''}`} type="button" onClick={() => setMode('code')}>کد بازیابی</button>
      </div>
      <input className="field-input" type="password" placeholder={mode === 'account' ? 'رمز حساب' : 'کد بازیابی'} value={secret} onChange={(e) => setSecret(e.target.value)} />
      <input className="field-input" type="password" placeholder="رمز تازهٔ گاوصندوق" value={next} onChange={(e) => setNext(e.target.value)} />
      <input className="field-input" type="password" placeholder="تکرار رمز تازه" value={again} onChange={(e) => setAgain(e.target.value)} />
      <button className="cta-confirm" type="button" onClick={() => void save()}>بازیابی و رمز تازه</button>
      <button className="cat-mini danger" type="button" onClick={() => void startOver()}>شروع دوباره بدون کارت‌های قبلی</button>
      {error ? <div className="banner error"><span>{error}</span></div> : null}
    </div>
  )
}
