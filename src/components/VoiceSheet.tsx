import { useEffect, useMemo, useState } from 'react'
import { useScrollFocusedIntoView } from '../lib/keyboardInset'
import { parseVoiceCommand } from '../lib/voice'
import { formatRial } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { categoriesFor } from '../lib/categories'
import { suggestCategory } from '../lib/sms/categorize'
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
  const { activeAccounts, addQuickEntry, customCategories } = useStore()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const [accountId, setAccountId] = useState(() => activeAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  useScrollFocusedIntoView()
  const draft = parseVoiceCommand(text)

  const kind = draft?.kind ?? 'expense'
  const availableCategories = useMemo(
    () => categoriesFor(kind, customCategories),
    [kind, customCategories],
  )

  // Automatically suggest category when speech/text changes
  useEffect(() => {
    if (draft) {
      const suggested = suggestCategory(text, draft.kind === 'income' ? 'INCOME' : 'EXPENSE')
      if (suggested) {
        setCategoryId(suggested)
      } else if (!categoryId) {
        setCategoryId(draft.kind === 'income' ? 'other-inc' : 'other-exp')
      }
    }
  }, [text, draft?.kind])

  // Sync default account if not yet selected
  useEffect(() => {
    if (!accountId && activeAccounts.length > 0) {
      setAccountId(activeAccounts[0]!.id)
    }
  }, [activeAccounts, accountId])

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
    const account = activeAccounts.find((a) => a.id === accountId) || activeAccounts[0]
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
        categoryId: categoryId || (draft.kind === 'income' ? 'other-inc' : 'other-exp'),
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
      defaultHeight={580}
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
            disabled={!draft || saving || activeAccounts.length === 0}
            onClick={() => void confirm()}
            style={{ flex: 1 }}
          >
            {saving ? 'در حال ثبت…' : 'تأیید و ثبت'}
          </button>
        </div>
      }
    >
      <div className="sheet-body-scroll" style={{ padding: '8px 2px' }}>
        {/* Quick Suggestion Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)', fontWeight: 700 }}>نمونه‌های سریع:</span>
          {[
            '۵۰ هزار تومان اسنپ',
            '۱۵۰ هزار تومان سوپرمارکت',
            '۱۰ میلیون حقوق واریزی',
            '۸۰ هزار تومان ناهار',
          ].map((sample, idx) => (
            <button
              key={idx}
              type="button"
              className="cat-mini"
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8 }}
              onClick={() => setText(sample)}
            >
              {sample}
            </button>
          ))}
        </div>

        {error ? <div className="banner error"><span>{error}</span></div> : null}

        {/* Text Input with Microphone Status */}
        <textarea
          className="field-input voice-box"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اینجا صحبت کنید یا بنویسید (مثلاً: ۵۰ هزار تومان سوپرمارکت)..."
          rows={3}
          style={{ width: '100%', resize: 'none', fontSize: 14 }}
        />

        {/* Animated Waveform Visualizer when recording */}
        {listening ? (
          <div style={{ textAlign: 'center', margin: '14px 0 6px' }}>
            <div className="voice-wave-container">
              <span className="voice-wave-bar" />
              <span className="voice-wave-bar" />
              <span className="voice-wave-bar" />
              <span className="voice-wave-bar" />
              <span className="voice-wave-bar" />
              <span className="voice-wave-bar" />
              <span className="voice-wave-bar" />
            </div>
            <p style={{ fontSize: 12, color: 'var(--hy-accent)', margin: '8px 0 0', fontWeight: 700 }}>
              در حال ضبط و پردازش صدای شما... واضح صحبت کنید
            </p>
          </div>
        ) : null}

        {draft ? (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: draft.kind === 'income' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: draft.kind === 'income' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: 'var(--hy-text-secondary)' }}>تراکنش شناسایی‌شده:</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: draft.kind === 'income' ? 'var(--hy-income)' : 'var(--hy-expense)', marginTop: 2 }}>
                  {draft.kind === 'income' ? '🟢 درآمد: ' : '🔴 هزینه: '} {formatRial(draft.amount)} ریال
                </div>
                {draft.note && (
                  <div style={{ fontSize: 12, color: 'var(--hy-text)', marginTop: 2 }}>
                    توضیحات: <b>{draft.note}</b>
                  </div>
                )}
              </div>
              <span style={{ fontSize: 28 }}>{draft.kind === 'income' ? '💰' : '🛒'}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="field-stack" style={{ margin: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>حساب واریز/برداشت</span>
                <select
                  className="field-input"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  {activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack" style={{ margin: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>دسته‌بندی</span>
                <select
                  className="field-input"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  style={{ fontSize: 13 }}
                >
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </WindowPopup>
  )
}
