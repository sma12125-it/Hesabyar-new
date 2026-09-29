import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toFaDigits } from '../lib/money'
import { useStore } from '../store/Store'
import { useExtras } from '../store/Extras'
import { CardFormSheet } from '../components/CardFormSheet'
import { CardVaultSection } from '../components/CardVaultSection'
import { AccountRow } from '../components/TxRow'
import { BalanceHero } from '../components/BalanceHero'
import { SettingsButton } from '../components/SettingsButton'

export function AccountsPage({
  onScroll,
}: {
  onScroll: (compact: boolean) => void
}) {
  const { accounts, activeAccounts, totalBalance } = useStore()
  const { cards } = useExtras()
  const [cardId, setCardId] = useState<string | null | undefined>(undefined)
  const navigate = useNavigate()
  useEffect(() => {
    const open = () => setCardId(null)
    window.addEventListener('hy-new-card', open)
    return () => window.removeEventListener('hy-new-card', open)
  }, [])
  const visible = accounts.filter((a) => !a.archived)
  const archived = accounts.filter((a) => a.archived)

  return (
    <div className="app-scroll" onScroll={(e) => onScroll(e.currentTarget.scrollTop > 28)}>
      <div className="top-row">
        <h1>حساب‌ها</h1>
        <SettingsButton />
      </div>

      {visible.length === 0 && archived.length === 0 ? (
        <>
        <div className="empty-state lg">
          <div className="empty-ico">💳</div>
          <h2>هنوز حسابی نداری</h2>
          <p>با دکمه ＋ در گوشهٔ صفحه اولین حساب یا کارت را بساز.</p>
        </div>
        <CardVaultSection onEdit={(id) => setCardId(id)} />
        </>
      ) : (
        <>
          <div style={{ marginTop: 12 }}>
            <BalanceHero
              label="مجموع موجودی"
              amount={totalBalance}
              sub={`${toFaDigits(activeAccounts.length)} حساب فعال`}
            />
          </div>
          <div className="split-wide">
          <div>
          <div className="section-head">
            <h2>حساب‌های من</h2>
          </div>
          <div className="acct-list">
            {visible.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onClick={() => navigate(`/accounts/${account.id}`)}
              />
            ))}
          </div>
          {archived.length > 0 ? (
            <>
              <div className="section-head">
                <h2>آرشیو</h2>
              </div>
              <div className="acct-list">
                {archived.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    onClick={() => navigate(`/accounts/${account.id}`)}
                  />
                ))}
              </div>
            </>
          ) : null}
          </div>
          <CardVaultSection onEdit={(id) => setCardId(id)} />
          </div>
        </>
      )}
      {cardId !== undefined ? (
        <CardFormSheet card={cards.find((card) => card.id === cardId)} onClose={() => setCardId(undefined)} />
      ) : null}
    </div>
  )
}
