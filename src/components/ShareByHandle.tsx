import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useExtras } from '../store/Extras'
import { lookupHandle, revokeAssetShare, shareAssetWithHandle } from '../lib/profileApi'
import { handleError, normalizeHandle, stripSecrets, type SharedAssetView } from '../lib/profile'
import { replaceSharedAssets, sharedAssetViews, subscribeSharedAssets } from '../lib/shareInbox'
import { notifyUser } from '../lib/sync'
import { toFaDigits } from '../lib/money'

export function useSharedAssets(): SharedAssetView[] {
  return useSyncExternalStore(subscribeSharedAssets, sharedAssetViews, sharedAssetViews)
}

export function ShareByHandle({
  kind,
  localId,
  title,
  payload,
}: {
  kind: 'card' | 'account'
  localId: string
  title: string
  payload: Record<string, unknown>
}) {
  const assets = useSharedAssets()
  const outgoing = assets.filter((item) => item.mine && item.kind === kind && item.localId === localId)
  const [open, setOpen] = useState(false)
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const safePayload = useMemo(() => stripSecrets(payload), [payload])

  async function share() {
    const clean = normalizeHandle(handle)
    const problem = handleError(clean)
    if (problem) {
      notifyUser(problem)
      return
    }
    setBusy(true)
    try {
      const found = await lookupHandle(clean)
      if (!found) {
        notifyUser('این شناسه در حسابیار پیدا نشد')
        return
      }
      await shareAssetWithHandle(kind, localId, found.handle, safePayload)
      const next: SharedAssetView = {
        id: `${kind}:${localId}:${found.handle}`,
        kind,
        localId,
        handle: found.handle,
        displayName: found.displayName,
        payload: safePayload,
        updatedAt: new Date().toISOString(),
        mine: true,
      }
      replaceSharedAssets([next, ...assets.filter((item) => !(item.mine && item.kind === kind && item.localId === localId && item.handle === found.handle))])
      setHandle('')
      notifyUser(`${title} برای ${found.displayName} (${found.handle}) قابل دیدن شد`)
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'اشتراک انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(item: SharedAssetView) {
    setBusy(true)
    try {
      await revokeAssetShare(kind, localId, item.handle)
      replaceSharedAssets(assets.filter((row) => !(row.kind === kind && row.localId === localId && row.handle === item.handle && row.mine)))
      notifyUser(`دسترسی ${item.handle} قطع شد`)
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'قطع دسترسی انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="share-by-handle">
      <button className="cat-mini" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? 'بستن اشتراک شناسه' : 'اشتراک با شناسه'}
      </button>
      {open ? (
        <div className="share-handle-panel">
          <p className="sheet-sub">
            {kind === 'card'
              ? 'شماره کارت و شبا برای این شناسه دیده می‌شود. CVV فرستاده نمی‌شود.'
              : 'نام حساب، نوع، شماره حساب و موجودی دیده می‌شود. دفتر تراکنش‌ها فرستاده نمی‌شود.'}
          </p>
          <div className="share-handle-row">
            <input
              className="field-input"
              value={handle}
              placeholder="شناسه حسابیار"
              aria-label={`شناسه برای اشتراک ${title}`}
              onChange={(e) => setHandle(e.target.value)}
            />
            <button className="cat-mini" type="button" disabled={busy || !handle.trim()} onClick={() => void share()}>
              {busy ? '…' : 'اشتراک'}
            </button>
          </div>
          {outgoing.map((item) => (
            <div key={item.handle} className="share-handle-row">
              <span>
                <b>{item.handle}</b>
                {item.displayName ? ` · ${item.displayName}` : ''} · فقط مشاهده
              </span>
              <button className="cat-mini danger" type="button" disabled={busy} onClick={() => void revoke(item)}>
                قطع
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

import { fetchIncomingShares, type IncomingSharedAsset } from '../lib/userShare'

export function IncomingShares() {
  const assets = useSharedAssets()
  const { formatMoney } = useExtras()
  const [serverShares, setServerShares] = useState<IncomingSharedAsset[]>([])

  const loadServer = async () => {
    try {
      const list = await fetchIncomingShares()
      setServerShares(list)
    } catch {}
  }

  useEffect(() => {
    void loadServer()
    window.addEventListener('hy-share-assets-updated', loadServer)
    return () => window.removeEventListener('hy-share-assets-updated', loadServer)
  }, [])

  const incoming = assets.filter((item) => !item.mine)
  if (incoming.length === 0 && serverShares.length === 0) return null

  return (
    <section className="lg report-card share-incoming" style={{ margin: '14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: 'var(--hy-text)' }}>
          🤝 با شناسهٔ من به اشتراک گذاشته شده (حساب‌ها و کارت‌های مشترک)
        </h2>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 6,
            background: 'rgba(16, 185, 129, 0.16)',
            color: 'var(--hy-income, #10b981)',
            fontWeight: 800,
          }}
        >
          {toFaDigits(incoming.length + serverShares.length)} مورد مشترک
        </span>
      </div>
      <p className="sheet-sub" style={{ margin: '0 0 12px', fontSize: 11 }}>
        دسترسی به صورت مشترک توسط مالک برای شما فعال شده است.
      </p>

      <div className="share-incoming-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Real server-synced shares */}
        {serverShares.map((item) => (
          <article
            key={item.id}
            className="share-incoming-card"
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1.5px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <div
              className="share-incoming-title"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{item.assetKind === 'card' ? '💳 کارت مشترک' : '🏦 حساب مشترک'}</span>
                <span style={{ color: 'var(--hy-accent)' }}>· {item.assetName}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)', fontWeight: 600 }}>
                از طرف: {item.ownerDisplayName || 'کاربر حسابیار'}
              </span>
            </div>

            {item.assetKind === 'card' ? (
              <CardFacts payload={item.assetDetails || {}} />
            ) : (
              <AccountFacts payload={item.assetDetails || {}} formatMoney={formatMoney} />
            )}
          </article>
        ))}

        {/* Local shares if any */}
        {incoming.map((item) => (
          <article key={`${item.kind}:${item.id}`} className="share-incoming-card">
            <div className="share-incoming-title">
              {item.kind === 'card' ? 'کارت' : 'حساب'} · از {item.displayName || item.handle}
              <span>@{item.handle}</span>
            </div>
            {item.kind === 'card' ? (
              <CardFacts payload={item.payload} />
            ) : (
              <AccountFacts payload={item.payload} formatMoney={formatMoney} />
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function CardFacts({ payload }: { payload: Record<string, unknown> }) {
  const pan = text(payload.pan)
  const groups = pan.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim()
  return (
    <dl>
      <div><dt>بانک</dt><dd>{text(payload.bankName) || '—'}</dd></div>
      <div><dt>دارنده</dt><dd>{text(payload.holder) || '—'}</dd></div>
      <div><dt>شماره کارت</dt><dd dir="ltr">{groups || '—'}</dd></div>
      <div><dt>شبا</dt><dd dir="ltr">{text(payload.sheba) || '—'}</dd></div>
      <div><dt>انقضا</dt><dd>{text(payload.expiry) || '—'}</dd></div>
    </dl>
  )
}

function AccountFacts({
  payload,
  formatMoney,
}: {
  payload: Record<string, unknown>
  formatMoney: (amount: number) => string
}) {
  const balance = typeof payload.balance === 'number' ? payload.balance : Number(payload.balance)
  return (
    <dl>
      <div><dt>نام</dt><dd>{text(payload.name) || '—'}</dd></div>
      <div><dt>نوع</dt><dd>{payload.type === 'cash' ? 'نقد' : 'بانک'}</dd></div>
      <div><dt>شماره حساب</dt><dd dir="ltr">{text(payload.accountNumber) || '—'}</dd></div>
      <div><dt>موجودی</dt><dd>{Number.isFinite(balance) ? formatMoney(balance) : toFaDigits('0')}</dd></div>
    </dl>
  )
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
