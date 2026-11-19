import { useEffect, useState } from 'react'
import { BankCardFace } from './BankCardFace'
import { CardLegacySyncBanner } from './CardLegacySyncBanner'
import { useExtras } from '../store/Extras'
import type { AccountClassification } from '../types'

export function CardVaultSection({
  onEdit,
  classificationFilter,
  title = 'کارت‌های بانکی',
}: {
  onEdit: (id: string) => void
  classificationFilter?: AccountClassification
  title?: string
}) {
  const { unlocked, vaultConfigured, hasRecoverableBackup, cards, syncVaultWithAccountPassword, deleteCard } = useExtras()
  const [revealed, setRevealed] = useState<string | null>(null)

  useEffect(() => {
    if (!unlocked) {
      void syncVaultWithAccountPassword()
    }
  }, [unlocked, syncVaultWithAccountPassword])

  const displayedCards = classificationFilter
    ? cards.filter((c) => (c.classification ?? 'cash') === classificationFilter)
    : cards

  return (
    <section className="card-vault">
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      {(vaultConfigured && !unlocked) || (displayedCards.length === 0 && hasRecoverableBackup) ? (
        <CardLegacySyncBanner compact />
      ) : displayedCards.length === 0 ? (
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
                <button className="cat-mini" type="button" onClick={() => setRevealed(revealed === card.id ? null : card.id)}>
                  {revealed === card.id ? 'پوشاندن' : 'نمایش'}
                </button>
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
                <button className="cat-mini danger" type="button" onClick={() => void deleteCard(card.id)}>حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
