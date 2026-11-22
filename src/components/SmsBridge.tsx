import { useEffect, useRef } from 'react'
import { attachNativeSmsHost } from '../lib/sms/reader'
import { ingestBankSms, ingestMultipleBankSms } from '../lib/sms/drafts'
import { notifyUser } from '../lib/sync'

/**
 * Intelligent background SMS bridge for Android & iOS:
 * 1. Attaches native SMS broadcast host if running in a native Android shell.
 * 2. Auto-detects copied bank SMS from clipboard when user returns to HesabYar on iOS & Android.
 * 3. Listens for clipboard paste events anywhere across the app.
 * 4. Processes external Web Share Target query params (?sms= or ?text=).
 */
export function SmsBridge() {
  const lastProcessedHashRef = useRef<string>('')

  useEffect(() => {
    // 1. Native shell SMS hook if available
    const detachHost = attachNativeSmsHost()

    // 2. Check URL search parameters (Web Share Target / Android Shortcuts)
    try {
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search)
        const incomingText = params.get('sms') || params.get('text')
        if (incomingText && incomingText.trim().length >= 8) {
          void ingestMultipleBankSms(incomingText.trim()).then((res) => {
            if (res.added > 0) {
              notifyUser(`📨 ${res.added} پیامک بانکی به طور خودکار دریافت و به صف تأیید اضافه شد`)
            }
          })
        }
      }
    } catch {}

    // 3. Smart Clipboard Watcher on Focus & Visibility Change (iOS & Android)
    const inspectClipboard = async () => {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return
      try {
        const clipText = await navigator.clipboard.readText()
        if (!clipText || clipText.trim().length < 8) return

        const trimmed = clipText.trim()
        if (trimmed === lastProcessedHashRef.current) return

        // Fast Iranian banking SMS regex pattern
        const isBankMessage =
          /(?:بانک|واریز|برداشت|خرید|انتقال|کارت\s*به\s*کارت|مانده|موجودی|بام|صپاد|ویپاد|بلوبانک|رسالت)/i.test(trimmed) &&
          /\d/.test(trimmed) &&
          /(?:ریال|تومان|تومن|مبلغ|\d{4,})/.test(trimmed)

        if (!isBankMessage) return

        lastProcessedHashRef.current = trimmed

        const res = await ingestBankSms({
          sender: 'بانک',
          body: trimmed,
          mode: 'manual-import',
        })

        if (res.status === 'created') {
          notifyUser('📨 پیامک بانکی کپی‌شده به طور خودکار شناسایی و به صف تأیید اضافه شد ✨')
        }
      } catch {
        // Silent catch: clipboard read permission may be withheld in some browser modes
      }
    }

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void inspectClipboard()
      }
    }

    const onWindowFocus = () => {
      void inspectClipboard()
    }

    // 4. Global Paste handler
    const onGlobalPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text')
      if (!text || text.trim().length < 8) return
      const isBankMessage =
        /(?:بانک|واریز|برداشت|خرید|انتقال|کارت\s*به\s*کارت|مانده|موجودی)/i.test(text) &&
        /\d/.test(text) &&
        /(?:ریال|تومان|تومن|مبلغ)/.test(text)

      if (isBankMessage) {
        lastProcessedHashRef.current = text.trim()
        void ingestMultipleBankSms(text.trim()).then((res) => {
          if (res.added > 0) {
            notifyUser(`📨 ${res.added} تراکنش از متن پیست‌شده شناسایی و در صف تأیید قرار گرفت`)
          }
        })
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onWindowFocus)
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('paste', onGlobalPaste)
    }

    return () => {
      detachHost()
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onWindowFocus)
        document.removeEventListener('visibilitychange', onVisibilityChange)
        window.removeEventListener('paste', onGlobalPaste)
      }
    }
  }, [])

  return null
}
