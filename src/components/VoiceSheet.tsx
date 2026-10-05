import { useState } from 'react'
import { useScrollFocusedIntoView } from '../lib/keyboardInset'
import { parseVoiceCommand } from '../lib/voice'
import { formatRial } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { useStore } from '../store/Store'
import { WindowPopup } from './WindowPopup'

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
    return 'اجازه دسترسی به میکروفن داده نشد. لطفاً در تنظیمات مرورگر اجازه میکروفن را فعال کنید و دوباره «شنیدن» را بزنید.'
  }
  if (name === 'NotFoundError') return 'میکروفنی روی این دستگاه پیدا نشد. می‌توانید متن را بنویسید.'
  return 'میکروفن فعال نشد. لطفاً متن را بنویسید، یا دوباره دکمه «شنیدن» را بزنید.'
}

function speechCtor() {
  if (typeof window === 'undefined') return undefined
  const host = window as Window & {
    SpeechRecognition?: new () => Rec
    webkitSpeechRecognition?: new () => Rec
  }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition
}

export function VoiceSheet({
  onClose,
  onMinimize,
}: {
  onClose: () => void
  onMinimize?: () => void
}) {
  const { activeAccounts, addQuickEntry } = useStore()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  useScrollFocusedIntoView()
  const draft = parseVoiceCommand(text)

  async function listen() {
    setError(null)
    const Ctor = speechCtor()

    // Request direct microphone permission via getUserMedia first (standard for Android / iOS / Desktop)
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Once permission is granted, release stream so SpeechRecognition can bind
        stream.getTracks().forEach((track) => track.stop())
      } catch (err) {
        setError(micError(err))
        return
      }
    }

    if (!Ctor) {
      setError('مرورگر شما از تبدیل صوت به متن پشتیبانی نمی‌کند. لطفاً متن را در کادر زیر بنویسید یا از مرورگر کروم استفاده کنید.')
      return
    }

    try {
      const rec = new Ctor()
      rec.lang = 'fa-IR'
      rec.continuous = false
      rec.interimResults = true

      rec.onresult = (event) => {
        const last = event.results[event.results.length - 1]
        const transcript = last?.[0]?.transcript ?? ''
        if (transcript) {
          setText(transcript)
        }
      }

      rec.onend = () => {
        setListening(false)
      }

      rec.onerror = (event) => {
        setListening(false)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError('اجازه میکروفن داده نشد. لطفاً در تنظیمات مرورگر اجازه دسترسی به میکروفن را فعال کنید.')
        } else if (event.error === 'no-speech') {
          setError('صدایی شنیده نشد. لطفاً نزدیک‌تر به میکروفن صحبت کرده و دوباره دکمه را بزنید.')
        } else if (event.error !== 'aborted') {
          setError('گفتار به درستی شنیده نشد. لطفاً دوباره امتحان کنید یا متن را بنویسید.')
        }
      }

      rec.start()
      setListening(true)
    } catch (err) {
      setListening(false)
      setError(micError(err))
    }
  }

  async function confirm() {
    if (!draft) return
    const account = activeAccounts[0]
    if (!account) {
      setError('اول یک حساب بانکی یا نقدی بسازید.')
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
    <WindowPopup
      title="دستیار صوتی هوشمند"
      subtitle="ثبت سریع با گفتار زنده یا متن"
      icon="🎙️"
      isOpen={true}
      onClose={onClose}
      onMinimize={onMinimize}
      defaultWidth={520}
      defaultHeight={540}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
          <button
            className={`cta-confirm${listening ? ' active' : ''}`}
            type="button"
            onClick={() => void listen()}
            style={{
              flex: 1,
              background: listening ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : undefined,
              animation: listening ? 'pulse 1.5s infinite' : undefined,
            }}
          >
            {listening ? '🔴 در حال شنیدن صدای شما…' : '🎙️ شنیدن صدا (میکروفن)'}
          </button>
          <button
            className="cta-confirm"
            type="button"
            disabled={!draft || saving}
            onClick={() => void confirm()}
            style={{ flex: 1 }}
          >
            {saving ? 'در حال ثبت…' : 'تأیید و ثبت'}
          </button>
        </div>
      }
    >
      <div className="sheet-body-scroll" style={{ padding: '8px 2px' }}>
        <p className="sheet-sub">
          مثلاً بگویید: «هزینه پنجاه هزار خوراک» یا «درآمد دو میلیون حقوق». همچنین می‌توانید متن را دستی ویرایش کنید.
        </p>
        {error ? <div className="banner error"><span>{error}</span></div> : null}
        <textarea
          className="field-input voice-box"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اینجا بگویید یا بنویسید (مثلاً: ۵۰ هزار تومان سوپرمارکت)..."
          rows={3}
          style={{ width: '100%', resize: 'none', fontSize: 14 }}
        />
        {draft ? (
          <div className="banner" style={{ marginTop: 12 }}>
            <span>
              {draft.kind === 'income' ? 'درآمد' : 'هزینه'} {formatRial(draft.amount)} ریال {draft.note ? `· ${draft.note}` : ''}
            </span>
          </div>
        ) : null}
      </div>
    </WindowPopup>
  )
}
