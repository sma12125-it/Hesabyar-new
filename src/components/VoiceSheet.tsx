import { useEffect, useMemo, useRef, useState } from 'react'
import { useScrollFocusedIntoView } from '../lib/keyboardInset'
import { parseVoiceCommand, type VoiceDraft } from '../lib/voice'
import { formatRial } from '../lib/money'
import { notifyUser } from '../lib/sync'
import { categoriesFor } from '../lib/categories'
import { suggestCategory } from '../lib/sms/categorize'
import { useStore } from '../store/Store'
import { useExtras } from '../store/Extras'
import { startAudioRecording, isAudioRecordingSupported, type RecorderHandle } from '../lib/audioRecorder'

type SpeechRecognitionResultItem = { transcript: string }
type SpeechRecognitionResultList = ArrayLike<SpeechRecognitionResultItem> & { isFinal?: boolean }

type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onstart: (() => void) | null
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultList> }) => void) | null
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

function deduplicateWords(input: string): string {
  const words = input.trim().split(/\s+/)
  const result: string[] = []
  for (let i = 0; i < words.length; i++) {
    const current = words[i]!
    if (result.length > 0 && result[result.length - 1] === current) {
      continue
    }
    result.push(current)
  }
  return result.join(' ')
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
  const [processing, setProcessing] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [accountId, setAccountId] = useState(() => activeAccounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [aiDraft, setAiDraft] = useState<VoiceDraft | null>(null)

  const recorderRef = useRef<RecorderHandle | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isSessionActiveRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useScrollFocusedIntoView()

  // Calculate local draft as fallback or live complement
  const localDraft = useMemo(() => parseVoiceCommand(text, activeAccounts), [text, activeAccounts])
  const effectiveDraft: VoiceDraft | null = aiDraft || localDraft

  const kind = effectiveDraft?.kind ?? 'expense'
  const availableCategories = useMemo(
    () => categoriesFor(kind, customCategories),
    [kind, customCategories],
  )

  // Automatically select recognized bank account
  useEffect(() => {
    if (effectiveDraft?.matchedAccountId) {
      const exists = activeAccounts.some((a) => a.id === effectiveDraft.matchedAccountId)
      if (exists) {
        setAccountId(effectiveDraft.matchedAccountId)
      }
    }
  }, [effectiveDraft?.matchedAccountId, activeAccounts])

  // Suggest category automatically when voice recognition identifies note or amount
  useEffect(() => {
    if (effectiveDraft && text) {
      const suggested = suggestCategory(effectiveDraft.note || text, effectiveDraft.kind === 'income' ? 'INCOME' : 'EXPENSE')
      if (suggested) {
        setCategoryId(suggested)
      } else if (!categoryId) {
        setCategoryId(effectiveDraft.kind === 'income' ? 'other-inc' : 'other-exp')
      }
    }
  }, [text, effectiveDraft, categoryId])

  // Clean up recording, speech recognition and timers on unmount
  useEffect(() => {
    return () => {
      isSessionActiveRef.current = false
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
        recognitionRef.current = null
      }
      if (recorderRef.current) {
        try {
          recorderRef.current.cancel()
        } catch {}
        recorderRef.current = null
      }
    }
  }, [])

  async function startListening() {
    setError(null)
    setAiDraft(null)
    finalTranscriptRef.current = text.trim()

    if (!isAudioRecordingSupported()) {
      setError('مرورگر شما دسترسی به ضبط صدا را پشتیبانی نمی‌کند. لطفاً از مرورگر استاندارد (کروم یا سافاری) استفاده کنید.')
      return
    }

    try {
      // 1. Start audio recording via getUserMedia (works reliably on iOS 11+ and Android)
      const handle = await startAudioRecording((level) => {
        setAudioLevel(level)
      })
      recorderRef.current = handle
      isSessionActiveRef.current = true
      setListening(true)
      setProcessing(false)
      setError(null)

      // 2. Concurrently run SpeechRecognition if available (Chrome/Android) for progressive live text preview
      // Silently swallow any recognition errors on iOS/WebKit without breaking audio recording
      const SpeechCtor = speechCtor()
      if (SpeechCtor) {
        try {
          const rec = new SpeechCtor()
          recognitionRef.current = rec
          rec.lang = 'fa-IR'
          rec.continuous = true
          rec.interimResults = true

          rec.onresult = (event) => {
            let interim = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i]
              if (res && res[0]) {
                const chunk = res[0].transcript.trim()
                if (res.isFinal) {
                  finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + chunk).trim()
                } else {
                  interim += ' ' + chunk
                }
              }
            }
            const combined = (finalTranscriptRef.current + ' ' + interim).trim()
            const clean = deduplicateWords(combined)
            if (clean) {
              setText(clean)
            }

            // Generous silence timeout (4.5s) to avoid rushing or cutting off natural speech
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current)
            }
            silenceTimerRef.current = setTimeout(() => {
              if (isSessionActiveRef.current) {
                void stopListening()
              }
            }, 4500)
          }

          rec.onerror = () => {
            // Swallow speech recognition error: server Gemini audio transcription will process the audio recording!
          }

          rec.onend = () => {
            if (isSessionActiveRef.current) {
              try {
                rec.start()
              } catch {}
            }
          }

          rec.start()
        } catch {
          // If Web Speech fails to initialize, standard audio recording continues
        }
      }
    } catch (err) {
      isSessionActiveRef.current = false
      setListening(false)
      const errName = err instanceof DOMException ? err.name : ''
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setError('مجوز دسترسی به میکروفن فعال نیست. لطفاً در تنظیمات مرورگر به حساب‌یار اجازه دسترسی دهید.')
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        setError('خطا در دسترسی به میکروفن: ' + msg)
      }
    }
  }

  async function stopListening() {
    isSessionActiveRef.current = false
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }

    const recorder = recorderRef.current
    if (!recorder) {
      setListening(false)
      return
    }

    setListening(false)
    setProcessing(true)
    setError(null)

    try {
      const { base64, mimeType } = await recorder.stop()
      recorderRef.current = null

      // Send recorded audio to server for Gemini Persian transcription & parsing
      const res = await fetch('/api/v1/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType,
          accounts: activeAccounts.map((a) => ({ id: a.id, name: a.name })),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const rawTranscript = (data.transcript || '').trim()
          if (rawTranscript) {
            setText(rawTranscript)
            finalTranscriptRef.current = rawTranscript
          }
          if (data.draft) {
            setAiDraft({
              kind: data.draft.kind,
              amount: data.draft.amount,
              note: data.draft.note,
              matchedAccountId: data.draft.matchedAccountId || undefined,
              matchedAccountName: data.draft.matchedAccountName || undefined,
            })
            if (data.draft.matchedAccountId) {
              setAccountId(data.draft.matchedAccountId)
            }
          }
        } else {
          // If AI server failed or had no voice, check if client captured any text
          if (!text.trim()) {
            setError('صدایی با وضوح کافی دریافت نشد. لطفاً دوباره صحبت کنید.')
          }
        }
      } else {
        if (!text.trim()) {
          setError('خطا در ارتباط با سرور پردازش گفتار. لطفاً دوباره امتحان کنید.')
        }
      }
    } catch {
      if (!text.trim()) {
        setError('خطا در ارسال فایل صوتی. وضعیت شبکه را بررسی کنید.')
      }
    } finally {
      setProcessing(false)
      setAudioLevel(0)
    }
  }

  function toggleListening() {
    if (listening) {
      void stopListening()
    } else {
      void startListening()
    }
  }

  async function handleConfirm() {
    if (!effectiveDraft) return
    const account = activeAccounts.find((a) => a.id === accountId) || activeAccounts[0]
    if (!account) {
      setError('لطفاً ابتدا حداقل یک حساب بانکی یا نقدی ایجاد کنید.')
      return
    }
    setSaving(true)
    try {
      await addQuickEntry({
        kind: effectiveDraft.kind,
        amount: effectiveDraft.amount,
        accountId: account.id,
        categoryId: categoryId || (effectiveDraft.kind === 'income' ? 'other-inc' : 'other-exp'),
        note: effectiveDraft.note || (effectiveDraft.kind === 'income' ? 'درآمد صوتی' : 'هزینه صوتی'),
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
              <p className="voice-modal-subtitle">با گفتار طبیعی به زبان فارسی، تراکنش خود را ثبت کنید</p>
            </div>
          </div>
          <button type="button" className="voice-modal-close" onClick={onClose} aria-label="بستن">
            ✕
          </button>
        </div>

        {/* Central Orb / Microphone Visualizer */}
        <div className="voice-orb-container">
          <div
            className={`voice-glow-orb${listening ? ' is-listening' : ''}${processing ? ' is-processing' : ''}`}
            onClick={processing ? undefined : toggleListening}
            role="button"
            tabIndex={0}
            style={{
              transform: listening && audioLevel > 5 ? `scale(${1 + Math.min(0.2, (audioLevel / 100) * 0.2)})` : undefined,
            }}
            title={listening ? 'توقف و ثبت صحبت' : processing ? 'در حال پردازش گفتار…' : 'شروع ضبط صدا'}
          >
            <div className="voice-orb-inner">
              <span className="voice-orb-icon">
                {processing ? '⏳' : listening ? '🎙️' : '🎤'}
              </span>
            </div>
          </div>

          {/* Sound waves animation bars */}
          {listening ? (
            <div className="voice-bars-row">
              {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
                const height = Math.max(8, Math.min(38, 8 + (audioLevel / 100) * 30 * (1 + (idx % 3) * 0.2)))
                return (
                  <span
                    key={idx}
                    className="voice-bar-item"
                    style={{
                      height: `${height}px`,
                      animationPlayState: audioLevel > 5 ? 'running' : 'paused',
                    }}
                  />
                )
              })}
            </div>
          ) : processing ? (
            <div className="voice-tap-hint" style={{ color: 'var(--hy-teal)' }}>
              ✨ در حال تحلیل هوشمند گفتار، استخراج مبلغ و حساب بانکی…
            </div>
          ) : (
            <div className="voice-tap-hint">
              {text ? 'برای ضبط مجدد یا صحبت روی میکروفن لمس کنید' : 'برای شروع صحبت، روی میکروفن لمس کنید'}
            </div>
          )}
        </div>

        {/* Live Recognized Transcript / Editable Input */}
        <div className="voice-transcript-card">
          <div className="voice-transcript-header">
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hy-text-secondary)' }}>
              {listening
                ? '🔴 در حال شنیدن گفتار شما (بدون عجله صحبت کنید)…'
                : processing
                ? '⏳ در حال تبدیل گفتار به متن فارسی…'
                : 'متن فرمان صوتی (دقیق و قابل ویرایش):'}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {text && !listening && !processing && (
                <button
                  type="button"
                  className="voice-clear-btn"
                  onClick={() => {
                    setText('')
                    setAiDraft(null)
                    finalTranscriptRef.current = ''
                  }}
                >
                  پاک کردن
                </button>
              )}
            </div>
          </div>
          <div className="voice-transcript-body">
            <textarea
              ref={textareaRef}
              className="voice-text-highlight"
              value={text}
              disabled={listening || processing}
              onChange={(e) => {
                setText(e.target.value)
                setAiDraft(null)
                finalTranscriptRef.current = e.target.value
              }}
              placeholder={
                listening
                  ? 'در حال گوش دادن... بگویید مثلاً: پنجاه هزار تومان کرایه تاکسی بانک ملت'
                  : processing
                  ? 'در حال پردازش هوشمند صدا...'
                  : 'روی میکروفن لمس کرده و صحبت کنید، یا متن را اینجا بنویسید...'
              }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="voice-chips-scroll">
            <span style={{ fontSize: 11, color: 'var(--hy-text-secondary)', alignSelf: 'center', flexShrink: 0 }}>
              نمونه‌ها:
            </span>
            {[
              '۵۰ هزار تومان کرایه تاکسی بانک ملت',
              '۱۸۰ هزار تومان سوپرمارکت',
              '۱۵ میلیون واریز حقوق بلوبانک',
              '۷۵ هزار تومان ناهار نقد',
            ].map((sample, idx) => (
              <button
                key={idx}
                type="button"
                className="voice-chip-btn"
                onClick={() => {
                  setText(sample)
                  setAiDraft(null)
                  finalTranscriptRef.current = sample
                }}
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Error notification banner if any */}
        {error && (
          <div className="banner error" style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.6 }}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Parsed Draft Result Preview Card */}
        {effectiveDraft && (
          <div className={`voice-draft-card ${effectiveDraft.kind === 'income' ? 'is-income' : 'is-expense'}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span className="voice-draft-badge">
                  {effectiveDraft.kind === 'income' ? '🟢 واریز / درآمد شناسایی شد' : '🔴 برداشت / هزینه شناسایی شد'}
                </span>
                <div className="voice-draft-amount">
                  {currencyUnit === 'IRT' ? formatMoney(effectiveDraft.amount) : `${formatRial(effectiveDraft.amount)} ریال`}
                </div>
                {effectiveDraft.note && (
                  <div className="voice-draft-note">
                    بابت: <strong>{effectiveDraft.note}</strong>
                  </div>
                )}
                {effectiveDraft.matchedAccountName && (
                  <div style={{ fontSize: 11, color: 'var(--hy-teal)', marginTop: 4, fontWeight: 700 }}>
                    🏦 حساب شناسایی‌شده از گفتار: <b>{effectiveDraft.matchedAccountName}</b>
                  </div>
                )}
              </div>
              <div className="voice-draft-icon">{effectiveDraft.kind === 'income' ? '💰' : '🛒'}</div>
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
            disabled={processing}
            onClick={toggleListening}
          >
            {processing ? '⏳ در حال پردازش گفتار…' : listening ? '⏹️ پایان صحبت و پردازش' : '🎙️ شروع صحبت'}
          </button>

          <button
            type="button"
            className="cta-confirm voice-confirm-btn"
            disabled={!effectiveDraft || saving || processing || activeAccounts.length === 0}
            onClick={() => void handleConfirm()}
          >
            {saving ? 'در حال ثبت…' : processing ? 'در حال پردازش گفتار…' : '✨ تایید و ثبت تراکنش'}
          </button>
        </div>
      </div>
    </div>
  )
}
