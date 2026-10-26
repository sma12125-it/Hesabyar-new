import { useCallback, useEffect, useState } from 'react'
import { listBackups, type SyncBackup } from '../db/db'
import { restoreBackup, syncBlocked, syncNow, type BlockedInfo } from '../lib/cloudSync'
import { notifyUser } from '../lib/sync'

function formatTime(at: number) {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at))
  } catch {
    return new Date(at).toLocaleString()
  }
}

/** Automatic on-device backups (last 5) and the warning when a cloud copy was refused. */
export function SyncBackupsPanel() {
  const [backups, setBackups] = useState<SyncBackup[]>([])
  const [blocked, setBlocked] = useState<BlockedInfo | null>(() => syncBlocked())
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    void listBackups().then(setBackups).catch(() => setBackups([]))
    setBlocked(syncBlocked())
  }, [])

  useEffect(() => {
    reload()
    window.addEventListener('hy-sync-blocked', reload)
    return () => window.removeEventListener('hy-sync-blocked', reload)
  }, [reload])

  async function restore(backup: SyncBackup) {
    const ok = window.confirm(
      `داده‌های این دستگاه با نسخهٔ پشتیبان ${formatTime(backup.at)} جایگزین شود؟\nپیش از آن از وضعیت فعلی هم یک نسخهٔ پشتیبان گرفته می‌شود و نسخهٔ بازگردانده‌شده به ابر هم می‌رود.`,
    )
    if (!ok) return
    setBusy(true)
    try {
      await restoreBackup(backup.id)
      notifyUser('نسخهٔ پشتیبان بازگردانده شد')
      window.location.reload()
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'بازگردانی ناموفق بود')
    } finally {
      setBusy(false)
      reload()
    }
  }

  async function applyAnyway() {
    const ok = window.confirm('حذف‌های نسخهٔ ابر روی این دستگاه اعمال شود؟ پیش از آن یک نسخهٔ پشتیبان گرفته شده است.')
    if (!ok) return
    setBusy(true)
    try {
      await syncNow({ force: true, allowLargeRemoval: true, backupReason: 'پیش از اعمال حذف گستردهٔ ابر' })
      notifyUser('نسخهٔ ابر اعمال شد')
    } catch (err) {
      notifyUser(err instanceof Error ? err.message : 'همگام‌سازی ناموفق بود')
    } finally {
      setBusy(false)
      reload()
    }
  }

  return (
    <section className="lg settings-block" style={{ marginTop: 14 }}>
      <h2 style={{ fontSize: 14, fontWeight: 800 }}>نسخه‌های پشتیبان خودکار این دستگاه</h2>
      <p className="sheet-sub" style={{ marginTop: 4 }}>
        پیش از دریافت از ابر، جایگزینی، خروج از حساب و هر حذفی که از ابر می‌رسد، یک نسخه از داده‌های این دستگاه نگه داشته می‌شود (۵ نسخهٔ آخر).
      </p>
      {blocked ? (
        <div className="banner error" style={{ marginTop: 10 }}>
          <span>
            نسخهٔ ابر می‌خواست {blocked.removed} ردیف ({blocked.transactions} تراکنش) را از این دستگاه حذف کند و اعمال نشد. داده‌های این دستگاه دست‌نخورده ماند.
          </span>
          <button className="cat-mini danger" type="button" disabled={busy} onClick={() => void applyAnyway()}>
            اعمال حذف‌ها
          </button>
        </div>
      ) : null}
      {backups.length === 0 ? (
        <p className="sheet-sub" style={{ marginTop: 10 }}>هنوز نسخهٔ پشتیبان خودکاری ساخته نشده است.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {backups.map((backup) => (
            <li key={backup.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <strong style={{ fontSize: 12 }}>{formatTime(backup.at)}</strong>
                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>
                  {backup.reason} · {backup.counts.transactions.toLocaleString('fa-IR')} تراکنش، {backup.counts.accounts.toLocaleString('fa-IR')} حساب
                </div>
              </div>
              <button className="cat-mini" type="button" disabled={busy} onClick={() => void restore(backup)}>
                بازگردانی
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
