import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useExtras } from '../store/Extras'
import { lookupHandle, revokeAssetShare, shareAssetWithHandle } from '../lib/profileApi'
import { handleError, normalizeHandle, stripSecrets, type SharedAssetView } from '../lib/profile'
import { replaceSharedAssets, sharedAssetViews, subscribeSharedAssets } from '../lib/shareInbox'
import { fetchIncomingShares, lookupUserByIdOrHandle, type IncomingSharedAsset } from '../lib/userShare'
import { notifyUser } from '../lib/sync'
import { toFaDigits } from '../lib/money'
import type { ShareAssetKind } from '../types'

export function useSharedAssets(): SharedAssetView[] {
  return useSyncExternalStore(subscribeSharedAssets, sharedAssetViews, sharedAssetViews)
}

const SHARE_KIND_DESC: Record<ShareAssetKind, string> = {
  card: 'شماره کارت و شبا برای این شناسه دیده می‌شود. CVV فرستاده نمی‌شود.',
  account: 'نام حساب، نوع، شماره حساب و موجودی دیده می‌شود. دفتر تراکنش‌ها فرستاده نمی‌شود.',
  installment: 'نام برنامه، مبلغ هر قسط، سررسیدها و وضعیت پرداخت اقساط دیده می‌شود.',
  debt: 'نام طرف حساب، مبلغ، سررسید و وضعیت تسویه بدهی یا طلب دیده می‌شود.',
  cheque: 'مبلغ، بانک، سررسید، صیاد و وضعیت چک دیده می‌شود.',
}

export function ShareByHandle({
  kind,
  localId,
  title,
  payload,
}: {
  kind: ShareAssetKind
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
    const raw = handle.trim()
    const clean = normalizeHandle(raw)
    if (!raw) {
      notifyUser('User ID یا شناسه کاربری را وارد کنید')
      return
    }
    setBusy(true)
    try {
      let resolvedHandle = clean
      let resolvedDisplay = clean
      const resolved = await lookupUserByIdOrHandle(raw)
      if (resolved) {
        resolvedHandle = resolved.handle || clean
        resolvedDisplay = resolved.displayName || resolvedHandle
      } else {
        const problem = handleError(clean)
        if (problem) {
          notifyUser('کاربری با این User ID یا شناسه در سرور پیدا نشد')
          return
        }
        const found = await lookupHandle(clean)
        if (!found) {
          notifyUser('این شناسه در حسابیار پیدا نشد')
          return
        }
        resolvedHandle = found.handle
        resolvedDisplay = found.displayName
      }
      await shareAssetWithHandle(kind, localId, resolvedHandle, safePayload)
      const next: SharedAssetView = {
        id: `${kind}:${localId}:${resolvedHandle}`,
        kind,
        localId,
        handle: resolvedHandle,
        displayName: resolvedDisplay,
        payload: safePayload,
        updatedAt: new Date().toISOString(),
        mine: true,
      }
      replaceSharedAssets([next, ...assets.filter((item) => !(item.mine && item.kind === kind && item.localId === localId && item.handle === resolvedHandle))])
      setHandle('')
      notifyUser(`${title} برای ${resolvedDisplay} (${resolvedHandle}) قابل دیدن شد`)
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
          <p className="sheet-sub">{SHARE_KIND_DESC[kind]}</p>
          <div className="share-handle-row">
            <input
              className="field-input"
              value={handle}
              placeholder="User ID یا شناسه حسابیار"
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

const KIND_BADGES: Record<ShareAssetKind, string> = {
  card: '💳 کارت مشترک',
  account: '🏦 حساب مشترک',
  installment: '📅 اقساط مشترک',
  debt: '🤝 بدهی/طلب مشترک',
  cheque: '🧾 چک مشترک',
}

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
          🤝 با شناسهٔ من به اشتراک گذاشته شده
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
                <span>{KIND_BADGES[item.assetKind] || '🤝 مورد مشترک'}</span>
                <span style={{ color: 'var(--hy-accent)' }}>· {item.assetName}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)', fontWeight: 600 }}>
                از طرف: {item.ownerDisplayName || 'کاربر حسابیار'}
              </span>
            </div>

            <AssetFacts kind={item.assetKind} payload={item.assetDetails || {}} formatMoney={formatMoney} />
          </article>
        ))}

        {incoming.map((item) => (
          <article key={`${item.kind}:${item.id}`} className="share-incoming-card">
            <div className="share-incoming-title">
              {KIND_BADGES[item.kind]} · از {item.displayName || item.handle}
              <span>@{item.handle}</span>
            </div>
            <AssetFacts kind={item.kind} payload={item.payload} formatMoney={formatMoney} />
          </article>
        ))}
      </div>
    </section>
  )
}

function AssetFacts({
  kind,
  payload,
  formatMoney,
}: {
  kind: ShareAssetKind
  payload: Record<string, unknown>
  formatMoney: (amount: number) => string
}) {
  if (kind === 'card') return <CardFacts payload={payload} />
  if (kind === 'account') return <AccountFacts payload={payload} formatMoney={formatMoney} />
  if (kind === 'installment') {
    const installmentAmount = Number(payload.installmentAmount ?? 0)
    const totalCount = Number(payload.totalCount ?? 0)
    return (
      <dl>
        <div><dt>عنوان</dt><dd>{text(payload.name) || '—'}</dd></div>
        <div><dt>مبلغ هر قسط</dt><dd>{Number.isFinite(installmentAmount) ? formatMoney(installmentAmount) : '—'}</dd></div>
        <div><dt>تعداد اقساط</dt><dd>{toFaDigits(Number.isFinite(totalCount) ? totalCount : 0)} قسط</dd></div>
        <div><dt>شروع</dt><dd>{text(payload.startDate) || '—'}</dd></div>
      </dl>
    )
  }
  if (kind === 'debt') {
    const amount = Number(payload.amount ?? 0)
    return (
      <dl>
        <div><dt>طرف حساب</dt><dd>{text(payload.party) || '—'}</dd></div>
        <div><dt>مبلغ</dt><dd>{Number.isFinite(amount) ? formatMoney(amount) : '—'}</dd></div>
        <div><dt>وضعیت</dt><dd>{payload.status === 'settled' ? 'تسویه‌شده' : 'جاری'}</dd></div>
        <div><dt>سررسید</dt><dd>{text(payload.dueDate) || '—'}</dd></div>
      </dl>
    )
  }
  const amount = Number(payload.amount ?? 0)
  return (
    <dl>
      <div><dt>طرف حساب</dt><dd>{text(payload.party) || '—'}</dd></div>
      <div><dt>مبلغ چک</dt><dd>{Number.isFinite(amount) ? formatMoney(amount) : '—'}</dd></div>
      <div><dt>بانک</dt><dd>{text(payload.bankName) || '—'}</dd></div>
      <div><dt>سررسید</dt><dd>{text(payload.dueDate) || '—'}</dd></div>
    </dl>
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
