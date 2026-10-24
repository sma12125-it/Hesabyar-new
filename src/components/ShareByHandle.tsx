import { useMemo, useState, useSyncExternalStore } from 'react'
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

export function IncomingShares() {
  const assets = useSharedAssets()
  const { formatMoney } = useExtras()
  const incoming = assets.filter((item) => !item.mine)
  if (incoming.length === 0) return null
  return (
    <section className="lg report-card share-incoming">
      <h2>با شناسهٔ من به اشتراک گذاشته شده</h2>
      <p className="sheet-sub">فقط مشاهده. صاحب هر مورد می‌تواند دسترسی را قطع کند.</p>
      <div className="share-incoming-list">
        {incoming.map((item) => (
          <article key={`${item.kind}:${item.id}`} className="share-incoming-card">
            <div className="share-incoming-title">
              {item.kind === 'card' ? 'کارت' : 'حساب'} · از {item.displayName || item.handle}
              <span>@{item.handle}</span>
            </div>
            {item.kind === 'card' ? <CardFacts payload={item.payload} /> : <AccountFacts payload={item.payload} formatMoney={formatMoney} />}
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
