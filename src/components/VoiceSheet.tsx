import { useEffect, useMemo, useRef, useState } from 'react'
import { useScrollFocusedIntoView } from '../lib/keyboardInset'
import { parseVoiceCommand } from '../lib/voice'
import { formatRial } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { categoriesFor } from '../lib/categories'
import { suggestCategory } from '../lib/sms/categorize'
import { useStore } from '../store/Store'
import { useExtras } from '../store/Extras'

type SpeechRecognitionResultItem = { transcript: string }
type SpeechRecognitionResultList = ArrayLike<SpeechRecognitionResultItem> & { isFinal?: boolean }

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultList> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function speechCtor(): (new () => SpeechRecognitionInstance) | undefined {
  if (typeof window === 'undefined') return undefined
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
  return host.SpeechRecognition ?? host.webkitSpeechRecognition
}

export function VoiceSheet({
  onClose,
}: {
  onClose: () => void
  onMinimize?: () => void
}) {
  const { activeAccounts, addQuickEntry, customCategories } = useStore()
  const { currencyUnit, formatMoney } = useExtras()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const [accountId, setAccountId] = useState(() => activeAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isListeningRef = useRef(false)

  useScrollFocusedIntoView()
  const draft = parseVoiceCommand(text)

  const kind = draft?.kind ?? 'expense'
  const availableCategories = useMemo(
    () => categoriesFor(kind, customCategories),
    [kind, customCategories],
  )

  // Suggest category automatically when voice recognition identifies note or amount
  useEffect(() => {
    if (draft && text) {
      const suggested = suggestCategory(text, draft.kind === 'income' ? 'INCOME' : 'EXPENSE')
      if (suggested) {
        setCategoryId(suggested)
      } else if (!categoryId) {
        setCategoryId(draft.kind === 'income' ? 'other-inc' : 'other-exp')
      }
    }
  }, [text, draft?.kind])

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      isListeningRef.current = false
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
        recognitionRef.current = null
      }
    }
  }, [])

  function startListening() {
    setError(null)

    const SpeechCtor = speechCtor()
    if (!SpeechCtor) {
      setError('مرورگر شما از تبدیل گفتار پشتیبانی نمی‌کند. می‌توانید متن را در کادر زیر بنویسید یا از دکمه میکروفن کیبورد گوشی استفاده کنید.')
      return
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {}
      recognitionRef.current = null
    }

    try {
      const rec = new SpeechCtor()
      recognitionRef.current = rec
      rec.lang = 'fa-IR'

      // On mobile browsers (iOS WebKit and Android Chrome), continuous=false ensures instant,
      // responsive delivery of onresult without buffering hangs or CoreAudio hardware locks.
      const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      rec.continuous = !isMobile
      rec.interimResults = true

      rec.onstart = () => {
        isListeningRef.current = true
        setListening(true)
        setError(null)
      }

      rec.onresult = (event) => {
        let fullTranscript = ''
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i]
          if (res && res[0]) {
            fullTranscript += res[0].transcript + ' '
          }
        }
        const clean = fullTranscript.trim()
        if (clean) {
          setText(clean)
        }
      }

      rec.onerror = (event) => {
        const err = event?.error || ''
        if (err === 'no-speech' || err === 'aborted') {
          // Normal pause or user abort, no banner needed
          return
        }
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          setError('مجوز دسترسی به میکروفن فعال نیست. لطفاً از نوار آدرس مرورگر یا تنظیمات گوشی به حساب‌یار دسترسی میکروفن دهید.')
        } else if (err === 'audio-capture') {
          setError('میکروفن دستگاه در دسترس نیست یا توسط برنامه دیگری اشغال شده است.')
        } else if (err === 'network') {
          setError('خطای اتصال به سرور تبدیل گفتار. لطفاً اینترنت خود را بررسی کنید.')
        } else {
          setError(`خطا در دریافت صدا (${err}). لطفاً مجدداً روی میکروفن لمس کنید.`)
        }
      }

      rec.onend = () => {
        isListeningRef.current = false
        setListening(false)
      }

      rec.start()
      isListeningRef.current = true
      setListening(true)
    } catch (err) {
      isListeningRef.current = false
      setListening(false)
      const msg = err instanceof Error ? err.message : String(err)
      setError('خطا در راه‌اندازی میکروفن: ' + msg)
    }
  }

  function stopListening() {
    isListeningRef.current = false
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    setListening(false)
  }

  function toggleListening() {
    if (listening) {
      stopListening()
    } else {
      startListening()
    }
  }

  async function handleConfirm() {
    if (!draft) return
    const account = activeAccounts.find((a) => a.id === accountId) || activeAccounts[0]
    if (!account) {
      setError('لطفاً ابتدا حداقل یک حساب بانکی یا نقدی ایجاد کنید.')
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
      notifyUser('تراکنش صوتی با موفقیت ثبت شد ✨')
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ثبت تراکنش انجام نشد'
      setError(msg)
      notifyUser(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="voice-assistant-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="voice-assistant-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="voice-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="voice-modal-sparkle">✨</span>
            <div>
              <h2 className="voice-modal-title">دستیار صوتی هوشمند حساب‌یار</h2>
              <p className="voice-modal-subtitle">با گفتار طبیعی یا تایپ، تراکنش خود را آنی ثبت کنید</p>
            </div>
          </div>
          <button type="button" className="voice-modal-close" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>

        {/* Central Orb / Microphone Visualizer */}
        <div className="voice-orb-container">
          <div
            className={`voice-glow-orb${listening ? ' is-listening' : ''}`}
            onClick={toggleListening}
            role="button"
            tabIndex={0}
            title={listening ? 'توقف ضبط صدا' : 'شروع ضبط صدا'}
          >
            <div className="voice-orb-inner">
              <span className="voice-orb-icon">{listening ? '🎙️' : '🎤'}</span>
            </div>
          </div>

          {/* Sound waves animation bars */}
          {listening ? (
            <div className="voice-bars-row">
              {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
                <span key={idx} className="voice-bar-item" />
              ))}
            </div>
          ) : (
            <div className="voice-tap-hint">
              {text ? 'برای ضبط مجدد روی میکروفن لمس کنید' : 'برای شروع صحبت، روی میکروفن لمس کنید'}
            </div>
          )}
        </div>

        {/* Live Recognized Transcript / Editable Input */}
        <div className="voice-transcript-card">
          <div className="voice-transcript-header">
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text-secondary)' }}>
              {listening ? '🔴 در حال شنیدن گفتار شما…' : 'متن فرمان صوتی (قابل ویرایش):'}
            </span>
            {text && (
              <button
                type="button"
                className="voice-clear-btn"
                onClick={() => setText('')}
              >
                پاک کردن
              </button>
            )}
          </div>
          <div className="voice-transcript-body">
            <textarea
              className="voice-text-highlight"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={listening ? 'در حال گوش دادن... بگویید مثلاً: پنجاه هزار تومان اسنپ' : 'روی میکروفن لمس کرده و صحبت کنید، یا متن را اینجا بنویسید...'}
              rows={2}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--hy-text)',
                lineHeight: 1.6,
                direction: 'rtl',
                padding: 0,
                margin: 0,
              }}
            />
          </div>
        </div>

        {/* Quick Example Chips */}
        <div className="voice-chips-scroll">
          <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)', alignSelf: 'center', flexShrink: 0 }}>
            عبارات آماده:
          </span>
          {[
            '۵۰ هزار تومان کرایه تاکسی',
            '۱۸۰ هزار تومان سوپرمارکت',
            '۱۵ میلیون واریز حقوق',
            '۷۵ هزار تومان ناهار',
          ].map((sample, idx) => (
            <button
              key={idx}
              type="button"
              className="voice-chip-btn"
              onClick={() => setText(sample)}
            >
              {sample}
            </button>
          ))}
        </div>

        {/* Error notification banner if any */}
        {error && (
          <div className="banner error" style={{ margin: '8px 0 0', fontSize: 12 }}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Parsed Draft Result Preview Card */}
        {draft && (
          <div className={`voice-draft-card ${draft.kind === 'income' ? 'is-income' : 'is-expense'}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span className="voice-draft-badge">
                  {draft.kind === 'income' ? '🟢 واریز / درآمد شناسایی شد' : '🔴 برداشت / هزینه شناسایی شد'}
                </span>
                <div className="voice-draft-amount">
                  {currencyUnit === 'IRT' ? formatMoney(draft.amount) : `${formatRial(draft.amount)} ریال`}
                </div>
                {draft.note && (
                  <div className="voice-draft-note">
                    بابت: <strong>{draft.note}</strong>
                  </div>
                )}
              </div>
              <div className="voice-draft-icon">{draft.kind === 'income' ? '💰' : '🛒'}</div>
            </div>

            {/* Account & Category Selectors */}
            <div className="voice-draft-inputs">
              <label className="field-stack" style={{ margin: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>حساب بانکی / نقدی</span>
                <select
                  className="field-input"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  style={{ fontSize: 12, height: 38 }}
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(a.balance)})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-stack" style={{ margin: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>دسته‌بندی</span>
                <select
                  className="field-input"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  style={{ fontSize: 12, height: 38 }}
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
        )}

        {/* Footer Actions */}
        <div className="voice-modal-footer">
          <button
            type="button"
            className={`voice-listen-toggle-btn${listening ? ' active' : ''}`}
            onClick={toggleListening}
          >
            {listening ? '⏹️ توقف شنیدن' : '🎙️ شروع صحبت'}
          </button>

          <button
            type="button"
            className="cta-confirm voice-confirm-btn"
            disabled={!draft || saving || activeAccounts.length === 0}
            onClick={() => void handleConfirm()}
          >
            {saving ? 'در حال ثبت…' : '✨ تایید و ثبت تراکنش'}
          </button>
        </div>
      </div>
    </div>
  )
}
