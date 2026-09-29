import type { NativeSmsHost } from './types'
import { ingestBankSms } from './drafts'

/**
 * This app is a PWA. Browsers cannot read the device SMS inbox.
 * iOS does not offer that access to a normal app either.
 * Android inbox reading needs a native shell that installs `window.__HESABYAR_NATIVE_SMS__`
 * and pushes one message at a time. This module never invents messages.
 */
declare global {
  interface Window {
    __HESABYAR_NATIVE_SMS__?: NativeSmsHost
  }
}

export interface SmsCapability {
  platform: 'ios' | 'android' | 'web'
  canReadInbox: false
  nativeBridge: boolean
  detail: string
}

export function smsCapability(): SmsCapability {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua)
  const android = /Android/.test(ua)
  const nativeBridge = typeof window !== 'undefined' && typeof window.__HESABYAR_NATIVE_SMS__?.subscribe === 'function'
  if (ios) {
    return {
      platform: 'ios',
      canReadInbox: false,
      nativeBridge,
      detail: 'iOS خواندن صندوق پیامک را در اختیار برنامه نمی‌گذارد. متن پیامک را می‌توانید دستی وارد کنید تا روی همین دستگاه بررسی شود.',
    }
  }
  if (android) {
    return {
      platform: 'android',
      canReadInbox: false,
      nativeBridge,
      detail: nativeBridge
        ? 'پوستهٔ بومی متصل است و پیامک را به صف بررسی می‌فرستد. این صفحهٔ وب خودش صندوق پیامک را نمی‌خواند.'
        : 'این نسخه وب به صندوق پیامک اندروید دسترسی ندارد. خواندن خودکار فقط با پوستهٔ بومی و مجوز SMS ممکن است. فعلاً متن پیامک را بچسبانید.',
    }
  }
  return {
    platform: 'web',
    canReadInbox: false,
    nativeBridge,
    detail: 'مرورگر اجازه خواندن پیامک دستگاه را ندارد. متن پیامک بانکی را اینجا وارد کنید تا محلی بررسی شود.',
  }
}

/** Listen only when a native host already installed the bridge. */
export function attachNativeSmsHost(): () => void {
  const host = typeof window === 'undefined' ? undefined : window.__HESABYAR_NATIVE_SMS__
  if (!host || typeof host.subscribe !== 'function') return () => {}
  return host.subscribe((message) => {
    const body = message.body?.trim() ?? ''
    if (!body) return
    void ingestBankSms({
      sender: message.sender?.trim() || 'بانک',
      body,
      receivedAt: message.receivedAt,
      mode: 'bridge',
    })
  })
}
