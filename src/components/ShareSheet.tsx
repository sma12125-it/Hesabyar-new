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
            درآمد و هزینهٔ این کارت برای هر دو کاربر یکی می‌ماند و کنار هر تراکنش نام ثبت‌کننده دیده می‌شود.
          </p>
          {error ? <div className="banner error"><span>{error}</span></div> : null}
          {code ? (
            <>
              <p className="recovery-code" aria-label="کد اشتراک">{code}</p>
              <p className="sheet-sub">کاربر دیگر این کد را در تنظیمات، بخش «پیوستن به کارت مشترک» وارد می‌کند.</p>
              <div className="field-stack">
                <input
                  className="field-input"
                  type="email"
                  inputMode="email"
                  placeholder="ایمیل کاربر دیگر"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="ایمیل کاربر دیگر"
                />
              </div>
              {members.length > 0 ? (
                <ul className="share-members">
                  {members.map((member) => (
                    <li key={member.email}>
                      {actorLabel(member.email) ?? member.email}
                      <span>{member.role === 'owner' ? 'صاحب کارت' : 'عضو'}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="sheet-sub">با ساخت اشتراک، یک کد ساخته می‌شود. هر دو نفر باید وارد حساب ابری شده باشند.</p>
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
