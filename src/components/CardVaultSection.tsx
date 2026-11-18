import { useState } from 'react'
import { BankCardFace } from './BankCardFace'
import { VaultRecover } from './VaultRecover'
import { useExtras } from '../store/Extras'
import type { AccountClassification } from '../types'

export function CardVaultSection({
  onEdit,
  classificationFilter,
  title = 'گاوصندوق کارت',
}: {
  onEdit: (id: string) => void
  classificationFilter?: AccountClassification
  title?: string
}) {
  const { unlocked, vaultConfigured, vaultBiometricEnabled, cards, unlockVault, unlockVaultWithBiometric, lockVault, deleteCard } = useExtras()
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [bioBusy, setBioBusy] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  const displayedCards = classificationFilter
    ? cards.filter((c) => (c.classification ?? 'cash') === classificationFilter)
    : cards

  async function unlock() {
    setError(null)
    try {
      await unlockVault(phrase)
    } catch {
      setError('رمز گاوصندوق نادرست است')
    }
  }

  async function unlockBio() {
    setError(null)
    setBioBusy(true)
    try {
      await unlockVaultWithBiometric()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'احراز هویت بیومتریک ناموفق بود')
    } finally {
      setBioBusy(false)
    }
  }

  return (
    <section className="card-vault">
      <div className="section-head">
        <h2>{title}</h2>
        {unlocked ? <button className="link" type="button" onClick={lockVault}>قفل</button> : null}
      </div>
      <p className="sheet-sub">شماره، انقضا و CVV فقط با رمز شما رمزنگاری می‌شود.</p>
      {error ? <div className="banner error"><span>{error}</span></div> : null}
      {!vaultConfigured ? (
        <p className="sheet-sub">رمز گاوصندوق هنوز تعیین نشده. آن را در تنظیمات مشخص کنید.</p>
      ) : !unlocked ? (
        <>
          {vaultBiometricEnabled ? (
            <button
              className="cta-confirm"
              type="button"
              disabled={bioBusy}
              onClick={() => void unlockBio()}
              style={{ marginBottom: 10, minHeight: 44 }}
            >
              {bioBusy ? 'در حال بررسی بیومتریک…' : '👆 باز کردن با اثر انگشت / چهره'}
            </button>
          ) : null}
          <div className="field-chip">
            <input
              className="field-input"
              type="password"
              placeholder="رمز گاوصندوق"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void unlock()
              }}
            />
            <button className="cat-mini" type="button" onClick={() => void unlock()}>باز کردن</button>
            <button className="link" type="button" onClick={() => setForgot((value) => !value)}>رمز را فراموش کرده‌ام</button>
          </div>
          {forgot ? <VaultRecover onDone={(code) => { setRecoveryCode(code); setForgot(false) }} /> : null}
          {recoveryCode ? (
            <>
              <p className="sheet-sub">کد تازهٔ بازیابی را نگه دارید.</p>
              <p className="recovery-code">{recoveryCode}</p>
            </>
          ) : null}
        </>
      ) : (
        <>
          {displayedCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--hy-text-tertiary)', fontSize: 13 }}>
              کارت بانکی در این دسته ثبت نشده است.
            </div>
          ) : (
            <div className="card-gallery">
              {displayedCards.map((card) => (
                <div key={card.id}>
                  <BankCardFace card={card} revealed={revealed === card.id} />
                  {card.accountId ? <div className="plan-meta">متصل به حساب</div> : null}
                  <div className="cat-actions">
                    <button className="cat-mini" type="button" onClick={() => setRevealed(revealed === card.id ? null : card.id)}>نمایش</button>
                    <button
                      className="cat-mini"
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('hy-open-share', {
                            detail: {
                              kind: 'card',
                              item: {
                                id: card.id,
                                name: card.bankName || 'کارت بانکی',
                                bankName: card.bankName,
                                pan: card.pan,
                                accountNumber: card.accountNumber,
                              },
                            },
                          }),
                        )
                      }
                    >
                      🤝 اشتراک
                    </button>
                    <button className="cat-mini" type="button" onClick={() => onEdit(card.id)}>ویرایش</button>
                    <button className="cat-mini danger" type="button" onClick={() => void deleteCard(card.id, phrase)}>حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
