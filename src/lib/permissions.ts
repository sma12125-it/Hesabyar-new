/**
 * Device Permissions Manager for Hesabyar (Microphone, Camera, Notifications/SMS)
 * Item 13: Handles device permission requests gracefully for web and Android PWA/APK environments.
 */

export type PermissionType = 'microphone' | 'camera' | 'notifications'

export interface PermissionResult {
  granted: boolean
  state: 'granted' | 'denied' | 'prompt' | 'unsupported'
  error?: string
}

/**
 * Requests microphone permission via navigator.mediaDevices.getUserMedia
 */
export async function requestMicrophonePermission(): Promise<PermissionResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { granted: false, state: 'unsupported', error: 'مرورگر یا دستگاه از ضبط صدا پشتیبانی نمی‌کند' }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Stop tracks immediately after confirming access
    stream.getTracks().forEach((track) => track.stop())
    return { granted: true, state: 'granted' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.name : 'UnknownError'
    if (message === 'NotAllowedError' || message === 'PermissionDeniedError') {
      return { granted: false, state: 'denied', error: 'دسترسی به میکروفن توسط کاربر رد شد' }
    }
    return { granted: false, state: 'denied', error: 'امکان دسترسی به میکروفن وجود ندارد' }
  }
}

/**
 * Requests camera permission via navigator.mediaDevices.getUserMedia
 * Used for QR code scanning (cards, Dong invitations, receipts)
 */
export async function requestCameraPermission(): Promise<PermissionResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { granted: false, state: 'unsupported', error: 'دستگاه از دوربین پشتیبانی نمی‌کند' }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    stream.getTracks().forEach((track) => track.stop())
    return { granted: true, state: 'granted' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.name : 'UnknownError'
    if (message === 'NotAllowedError' || message === 'PermissionDeniedError') {
      return { granted: false, state: 'denied', error: 'دسترسی به دوربین توسط کاربر رد شد' }
    }
    return { granted: false, state: 'denied', error: 'امکان اتصال به دوربین میسر نیست' }
  }
}

/**
 * Requests notification permission for reminders, installment alerts, and SMS bridging
 */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { granted: false, state: 'unsupported', error: 'مرورگر از اعلان‌های سیستمی پشتیبانی نمی‌کند' }
  }

  try {
    const perm = await Notification.requestPermission()
    return {
      granted: perm === 'granted',
      state: perm as 'granted' | 'denied' | 'prompt',
    }
  } catch {
    return { granted: false, state: 'denied', error: 'خطا در درخواست دسترسی به اعلان‌ها' }
  }
}

/**
 * Check current permissions states without prompting
 */
export async function checkPermissionsStatus(): Promise<{
  microphone: 'granted' | 'denied' | 'prompt' | 'unsupported'
  camera: 'granted' | 'denied' | 'prompt' | 'unsupported'
  notifications: 'granted' | 'denied' | 'prompt' | 'unsupported'
}> {
  const result: {
    microphone: 'granted' | 'denied' | 'prompt' | 'unsupported'
    camera: 'granted' | 'denied' | 'prompt' | 'unsupported'
    notifications: 'granted' | 'denied' | 'prompt' | 'unsupported'
  } = {
    microphone: 'prompt',
    camera: 'prompt',
    notifications: 'prompt',
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    result.notifications = Notification.permission as 'granted' | 'denied' | 'prompt'
  } else {
    result.notifications = 'unsupported'
  }

  if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions.query) {
    try {
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      result.microphone = micStatus.state
    } catch {
      // Ignore
    }

    try {
      const camStatus = await navigator.permissions.query({ name: 'camera' as PermissionName })
      result.camera = camStatus.state
    } catch {
      // Ignore
    }
  }

  return result
}
