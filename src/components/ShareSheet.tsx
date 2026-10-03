import { useEffect, useState } from 'react'
import { actorLabel } from '../lib/actor'
import {
  createSharedLedger,
  formatShareCode,
  inviteSharedEmail,
  listShareMembers,
  listSharedLedgers,
  rememberShareIds,
  type ShareMember,
} from '../lib/share'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import type { Account } from '../types'

export function ShareSheet({ account, onClose }: { account: Account; onClose: () => void }) {
  const { transactions, attachShare } = useStore()
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [members, setMembers] = useState<ShareMember[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ledgerId, setLedgerId] = useState(account.shareId)

  useEffect(() => {
    if (account.shareId) setLedgerId(account.shareId)
  }, [account.shareId])

  useEffect(() => {
    if (!ledgerId) return
    let closed = false
    void listSharedLedgers()
      .then((rows) => {
        const row = rows.find((item) => item.id === ledgerId)
        if (!closed && row) setCode(formatShareCode(row.code))
      })
      .catch(() => {})
    void listShareMembers(ledgerId)
      .then((rows) => {
        if (!closed) setMembers(rows)
      })
      .catch(() => {})
    return () => {
      closed = true
    }
  }, [ledgerId])

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const created = await createSharedLedger(account, transactions)
      await attachShare(account.id, created.id)
      setLedgerId(created.id)
      rememberShareIds(created.id, transactions.filter((tx) => tx.accountId === account.id).map((tx) => tx.id))
      setCode(formatShareCode(created.code))
      notifyUser('این کارت مشترک شد. کد را به کاربر دیگر بدهید.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'اشتراک ساخته نشد')
    } finally {
      setBusy(false)
    }
  }

  async function invite() {
    if (!ledgerId) return
    setBusy(true)
    setError(null)
    try {
      await inviteSharedEmail(ledgerId, email)
      setEmail('')
      setMembers(await listShareMembers(ledgerId))
      notifyUser('دعوت ثبت شد. اگر آن ایمیل حساب داشته باشد، کارت را می‌بیند.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'دعوت ارسال نشد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="glass-sheet sheet-sticky-cta" role="dialog" aria-label="اشتراک کارت">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>اشتراک {account.name}</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="sheet-body-scroll">
          <p className="sheet-sub">
            درآمد و هزینهٔ این کارت برای اعضای مجاز همگام می‌شود و نام ثبت‌کننده کنار هر تراکنش دیده خواهد شد.
          </p>
          {error ? <div className="banner error"><span>{error}</span></div> : null}
          {code ? (
            <>
              <div style={{ textAlign: 'center', margin: '8px 0' }}>
                <span style={{ fontSize: '11px', color: 'var(--hy-muted)', display: 'block', marginBottom: 4 }}>
                  کد یکتای اشتراک (تنها برای اعضای مجاز شده)
                </span>
                <p className="recovery-code" aria-label="کد اشتراک">{code}</p>
              </div>

              <div style={{ background: 'rgba(15, 118, 110, 0.08)', borderRadius: 12, padding: '10px 12px', margin: '10px 0', border: '1px solid rgba(15, 118, 110, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontWeight: 600, fontSize: '13px', color: 'var(--hy-teal)' }}>
                  <span>🔒</span>
                  <span>امنیت اختصاصی ایمیل</span>
                </div>
                <p style={{ fontSize: '11px', margin: 0, color: 'var(--hy-subtext)', lineHeight: 1.6 }}>
                  تنها کاربرانی که ایمیل آن‌ها را در زیر اضافه کنید می‌توانند با این کد به حساب متصل شوند. دسترسی سایر ایمیل‌ها به طور خودکار مسدود می‌شود.
                </p>
              </div>

              <p className="sheet-sub" style={{ marginTop: 12, fontWeight: 500 }}>
                دعوت ایمیل کاربر هدف:
              </p>
              <div className="field-stack">
                <input
                  className="field-input"
                  type="email"
                  inputMode="email"
                  placeholder="مثال: colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="ایمیل کاربر دیگر"
                />
              </div>
              {members.length > 0 ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, color: 'var(--hy-subtext)' }}>
                    اعضای دارای دسترسی مجاز ({members.length}):
                  </div>
                  <ul className="share-members">
                    {members.map((member) => (
                      <li key={member.email}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>👤</span>
                          <span>{actorLabel(member.email) ?? member.email}</span>
                        </div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          background: member.role === 'owner' ? 'rgba(15, 118, 110, 0.15)' : 'rgba(124, 58, 237, 0.15)',
                          color: member.role === 'owner' ? 'var(--hy-teal)' : 'var(--hy-accent)'
                        }}>
                          {member.role === 'owner' ? 'صاحب حساب' : 'عضو مجاز'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="sheet-sub">با ایجاد اشتراک، یک کد امن ساخته شده و دسترسی فقط برای ایمیل‌هایی که مشخص می‌کنید فعال خواهد شد.</p>
          )}
        </div>
        <div className="sheet-footer">
          {code && ledgerId ? (
            <button className="cta-confirm" type="button" disabled={busy || !email.trim()} onClick={() => void invite()}>
              {busy ? 'در حال دعوت…' : 'دعوت با ایمیل'}
            </button>
          ) : (
            <button className="cta-confirm" type="button" disabled={busy} onClick={() => void create()}>
              {busy ? 'در حال ساخت…' : 'اشتراک این کارت'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
