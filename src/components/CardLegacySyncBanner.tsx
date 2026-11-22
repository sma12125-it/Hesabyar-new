import { useState } from 'react'
import { useExtras } from '../store/Extras'
import { notifyUser } from '../lib/sync'
import { VaultRecover } from './VaultRecover'

/**
 * Rendered ONLY when an existing encrypted card vault is present on disk/cloud
 * but could not be auto-decrypted yet (e.g., encrypted with an older separate
 * vault password before unification, or logged in via biometric before the
 * device key was cached).
 *
 * Once the user enters their password ONCE, all existing cards are immediately
 * decrypted, re-encrypted with the unified account password + cached locally,
 * and this banner never appears again.
 */
export function CardLegacySyncBanner({ compact = false }: { compact?: boolean }) {
  const { vaultConfigured, unlocked, hasRecoverableBackup, unlockVault } = useExtras()
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRecover, setShowRecover] = useState(false)

  if (!hasRecoverableBackup && (!vaultConfigured || unlocked)) return null

  async function handleRecover() {
    setError(null)
    if (!phrase.trim()) {
      setError('لطفاً رمز ورود حساب یا رمز قبلی کارت‌ها را وارد کنید')
      return
    }
    setBusy(true)
    try {
      await unlockVault(phrase)
      setPhrase('')
      notifyUser('کارت‌های ثبت‌شده بازیابی و با ورود شما همگام شدند')
    } catch {
      setError('رمز واردشده نادرست است. رمز قبلی گاوصندوق یا رمز ورود حساب خود را امتحان کنید.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="lg"
      style={{
        padding: compact ? '14px 12px' : '18px 16px',
        borderRadius: 18,
        margin: '8px 0 12px',
        border: '1px solid rgba(20, 184, 166, 0.35)',
        background: 'rgba(15, 118, 110, 0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'rgba(20, 184, 166, 0.2)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 19,
            flexShrink: 0,
          }}
        >
          🔄
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--hy-text)' }}>
            بازیابی یک‌باره کارت‌های ثبت‌شده قبلی
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--hy-text-secondary)', lineHeight: 1.6 }}>
            کارت‌های شما امن در حافظه ذخیره هستند. برای یک‌بار رمز ورود حساب (یا رمز قبلی کارت‌ها) را وارد کنید تا کارت‌ها فوراً نمایش داده شوند و دیگر هرگز رمز مجزا پرسیده نشود.
          </p>
        </div>
      </div>

      <div className="field-stack" style={{ marginTop: 10 }}>
        <input
          className="field-input"
          type="password"
          placeholder="رمز ورود حساب یا رمز قبلی کارت‌ها"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleRecover()
          }}
        />
        <button
          type="button"
          className="cta-confirm"
          disabled={busy}
          style={{ minHeight: 44, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => void handleRecover()}
        >
          <span>{busy ? 'در حال بازیابی کارت‌ها…' : '🔓 بازیابی و نمایش کارت‌ها'}</span>
        </button>

        {error ? (
          <div className="banner error" style={{ marginTop: 2 }}>
            <span>{error}</span>
          </div>
        ) : null}

        <div style={{ textAlign: 'center', marginTop: 2 }}>
          <button
            type="button"
            className="link"
            style={{ fontSize: 12 }}
            onClick={() => setShowRecover((v) => !v)}
          >
            {showRecover ? 'بستن بخش بازیابی اضطراری' : 'رمز قبلی کارت‌ها را فراموش کرده‌ام'}
          </button>
        </div>

        {showRecover ? (
          <div style={{ marginTop: 6 }}>
            <VaultRecover
              onDone={() => {
                setShowRecover(false)
                notifyUser('کارت‌ها بازیابی و همگام شدند')
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
