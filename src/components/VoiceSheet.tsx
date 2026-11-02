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
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultList> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
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
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const [accountId, setAccountId] = useState(() => activeAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useScrollFocusedIntoView()
  const draft = parseVoiceCommand(text || interimText)

  const kind = draft?.kind ?? 'expense'
  const availableCategories = useMemo(
    () => categoriesFor(kind, customCategories),
    [kind, customCategories],
  )

  // Suggest category automatically when voice recognition identifies note or amount
  useEffect(() => {
    const currentText = text || interimText
    if (draft && currentText) {
      const suggested = suggestCategory(currentText, draft.kind === 'income' ? 'INCOME' : 'EXPENSE')
      if (suggested) {
        setCategoryId(suggested)
      } else if (!categoryId) {
        setCategoryId(draft.kind === 'income' ? 'other-inc' : 'other-exp')
      }
    }
  }, [text, interimText, draft?.kind])

  // Clean up audio streams and speech recognition on unmount
  useEffect(() => {
    return () => {
      stopAudioVisualizer()
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
    }
  }, [])

  // Auto-start listening on open for instant assistant feel
  useEffect(() => {
    const timer = setTimeout(() => {
      void startListening()
    }, 350)
    return () => clearTimeout(timer)
  }, [])

  function startAudioVisualizer(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      audioContextRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyserRef.current = analyser
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateLevel = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]!
        }
        const avg = sum / dataArray.length
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)))
        animFrameRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()
    } catch {}
  }

  function stopAudioVisualizer() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        void audioContextRef.current.close()
      } catch {}
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    setAudioLevel(0)
  }

  async function startListening() {
    setError(null)
    setInterimText('')

    // 1. Explicitly request microphone stream for Android Chrome, iOS Safari & Mobile WebApp
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        mediaStreamRef.current = stream
        startAudioVisualizer(stream)
      } catch (err) {
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('دسترسی به میکروفن توسط دستگاه یا مرورگر مسدود شده است. لطفاً از نوار آدرس یا تنظیمات گوشی، مجوز میکروفن را برای حساب‌یار فعال کنید.')
        } else {
          setError('میکروفن در دسترس نیست. می‌توانید متن را دستی در کادر پایین بنویسید.')
        }
        return
      }
    }

    // 2. Setup Web Speech Recognition
    const SpeechCtor = speechCtor()
    if (!SpeechCtor) {
      setError('مرورگر از تبدیل گفتار به متن پشتیبانی نمی‌کند. لطفاً متن را در کادر زیر تایپ کنید.')
      return
    }

    try {
      const rec = new SpeechCtor()
      recognitionRef.current = rec
      rec.lang = 'fa-IR'
      rec.continuous = true
      rec.interimResults = true

      rec.onresult = (event) => {
        let finalStr = ''
        let interimStr = ''
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i]
          if (res && res[0]) {
            if (res.isFinal) {
              finalStr += res[0].transcript + ' '
            } else {
              interimStr += res[0].transcript
            }
          }
        }
        if (finalStr.trim()) {
          setText(finalStr.trim())
          setInterimText('')
        } else if (interimStr.trim()) {
          setInterimText(interimStr.trim())
        }
      }

      rec.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setError('مجوز دسترسی به میکروفن فعال نیست.')
        } else if (event.error === 'no-speech') {
          // Keep waiting for user voice
        } else if (event.error !== 'aborted') {
          setError('دریافت صدا با خطا روبرو شد. لطفاً دوباره صحبت کنید.')
        }
      }

      rec.onend = () => {
        setListening(false)
        stopAudioVisualizer()
      }

      rec.start()
      setListening(true)
    } catch {
      setListening(false)
      stopAudioVisualizer()
    }
  }

  function stopListening() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    stopAudioVisualizer()
    setListening(false)
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

  const displayText = text || interimText

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
            style={{
              transform: `scale(${1 + (audioLevel / 100) * 0.45})`,
              boxShadow: listening
                ? `0 0 ${35 + audioLevel}px rgba(16, 185, 129, ${0.4 + (audioLevel / 100) * 0.5})`
                : '0 0 25px rgba(37, 99, 235, 0.35)',
            }}
            onClick={() => {
              if (listening) {
                stopListening()
              } else {
                void startListening()
              }
            }}
            role="button"
            tabIndex={0}
            title={listening ? 'کلیک برای توقف شنیدن' : 'کلیک برای شروع شنیدن'}
          >
            <div className="voice-orb-inner">
              <span className="voice-orb-icon">{listening ? '🎙️' : '🎤'}</span>
            </div>
          </div>

          {/* Sound waves animation bars */}
          {listening ? (
            <div className="voice-bars-row">
              {[0.4, 0.8, 1.2, 0.6, 1.4, 0.9, 0.5].map((factor, idx) => (
                <span
                  key={idx}
                  className="voice-bar-item"
                  style={{
                    height: `${Math.max(8, Math.min(42, 8 + audioLevel * factor))}px`,
                    opacity: 0.6 + (audioLevel / 100) * 0.4,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="voice-tap-hint">برای شروع ضبط مجدد، روی میکروفن لمس کنید</div>
          )}
        </div>

        {/* Live Recognized Transcript Display */}
        <div className="voice-transcript-card">
          <div className="voice-transcript-header">
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text-secondary)' }}>
              {listening ? '🔴 در حال شنیدن و تحلیل زنده گفتار شما…' : 'متن شناسایی‌شده:'}
            </span>
            {displayText && (
              <button
                type="button"
                className="voice-clear-btn"
                onClick={() => {
                  setText('')
                  setInterimText('')
                }}
              >
                پاک کردن
              </button>
            )}
          </div>
          <div className="voice-transcript-body">
            {displayText ? (
              <span className="voice-text-highlight">{displayText}</span>
            ) : (
              <span className="voice-text-placeholder">
                مثال بگویید: «پنجاه هزار تومان اسنپ» یا «دو میلیون حقوق واریزی»...
              </span>
            )}
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
              onClick={() => {
                setText(sample)
                setInterimText('')
              }}
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
            onClick={() => {
              if (listening) {
                stopListening()
              } else {
                void startListening()
              }
            }}
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
