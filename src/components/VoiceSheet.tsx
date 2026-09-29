import { useState } from 'react'
import { useScrollFocusedIntoView } from '../lib/keyboardInset'
import { parseVoiceCommand } from '../lib/voice'
import { formatRial } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'

type Rec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function micError(err: unknown) {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'اجازه میکروفن داده نشد. در تنظیمات آیفون، میکروفن را برای سافاری یا حساب‌یار روشن کنید و دوباره «شنیدن» را بزنید.'
  }
  if (name === 'NotFoundError') return 'میکروفنی روی این دستگاه پیدا نشد. متن را بنویسید.'
  return 'میکروفن روشن نشد. متن را بنویسید، یا دوباره «شنیدن» را بزنید.'
}

function speechCtor() {
  const host = window as Window & {
    SpeechRecognition?: new () => Rec
    webkitSpeechRecognition?: new () => Rec
  }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition
}

export function VoiceSheet({ onClose }: { onClose: () => void }) {
  const { activeAccounts, addQuickEntry } = useStore()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  useScrollFocusedIntoView()
  const draft = parseVoiceCommand(text)

  function listen() {
    setError(null)
    const media = navigator.mediaDevices
    if (!media?.getUserMedia) {
      setError('میکروفن در این حالت در دسترس نیست. متن را بنویسید، یا حساب‌یار را در سافاری باز کنید.')
      return
    }
    const permission = media.getUserMedia({ audio: true })
    const Ctor = speechCtor()
    if (!Ctor) {
      void permission
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop())
          setError('میکروفن روشن شد، ولی تشخیص گفتار در این مرورگر نیست. متن را بنویسید.')
        })
        .catch((err) => {
          setError(micError(err))
        })
      return
    }
    const rec = new Ctor()
    let allowed = false
    rec.lang = 'fa-IR'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      setText(last?.[0]?.transcript ?? '')
    }
    rec.onend = () => setListening(false)
    rec.onerror = (event) => {
      const blocked = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      if (blocked && !allowed) {
        setListening(false)
        return
      }
      if (event.error === 'aborted') return
      setListening(false)
      if (blocked) {
        setError('تشخیص گفتار اجازه نگرفت. دوباره «شنیدن» را بزنید، یا متن را بنویسید.')
        return
      }
      setError(event.error === 'no-speech' ? 'صدایی شنیده نشد. دوباره بزنید یا متن را بنویسید.' : 'گفتار شنیده نشد. متن را بنویسید.')
    }
    const begin = () => {
      try {
        rec.start()
        setListening(true)
      } catch {
        setListening(false)
      }
    }
    begin()
    void permission
      .then((stream) => {
        allowed = true
        stream.getTracks().forEach((track) => track.stop())
        begin()
      })
      .catch((err) => {
        setListening(false)
        try {
          rec.stop()
        } catch {
          /* recognition never started */
        }
        setError(micError(err))
      })
  }

  async function confirm() {
    if (!draft) return
    const account = activeAccounts[0]
    if (!account) {
      setError('اول یک حساب بساز')
      return
    }
    setSaving(true)
    try {
      await addQuickEntry({
        kind: draft.kind,
        amount: draft.amount,
        accountId: account.id,
        categoryId: draft.kind === 'income' ? 'other-inc' : 'other-exp',
        note: draft.note || (draft.kind === 'income' ? 'درآمد صوتی' : 'هزینه صوتی'),
      })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ثبت نشد'
      setError(message)
      notifyUser(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        className="glass-sheet sheet-sticky-cta"
        role="dialog"
        aria-label="دستیار صوتی"
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h1>دستیار صوتی</h1>
          <button className="sheet-close" type="button" onClick={onClose} aria-label="بستن">✕</button>
        </div>
        <div className="sheet-body-scroll">
          <p className="sheet-sub">مثلاً «هزینه ۵۰ هزار خوراک» یا «درآمد ۲ میلیون حقوق». قبل از ذخیره تأیید کنید.</p>
          {error ? <div className="banner error"><span>{error}</span></div> : null}
          <textarea className="field-input voice-box" value={text} onChange={(e) => setText(e.target.value)} placeholder="اینجا بگویید یا بنویسید" />
          {draft ? (
            <div className="banner">
              <span>{draft.kind === 'income' ? 'درآمد' : 'هزینه'} {formatRial(draft.amount)} ریال {draft.note ? `· ${draft.note}` : ''}</span>
            </div>
          ) : null}
        </div>
        <div className="sheet-footer voice-actions">
          <button className="cta-confirm" type="button" onClick={listen}>{listening ? 'در حال شنیدن…' : 'شنیدن'}</button>
          <button className="cta-confirm" type="button" disabled={!draft || saving} onClick={() => void confirm()}>
            {saving ? 'در حال ثبت…' : 'تأیید و ثبت'}
          </button>
        </div>
      </div>
    </>
  )
}
