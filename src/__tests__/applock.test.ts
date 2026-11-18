import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadLock,
  saveLock,
  lockEnabled,
  setPin,
  checkPin,
  setPattern,
  checkPattern,
  clearLock,
  isBiometricActive,
  setBiometricActive,
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
  authenticateWithBiometrics,
  verifyBiometric,
} from '../lib/applock'

function installBrowser() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  const sessionStore = new Map<string, string>()
  const sessionStorage = {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      sessionStore.set(key, value)
    },
    removeItem: (key: string) => {
      sessionStore.delete(key)
    },
    clear: () => {
      sessionStore.clear()
    },
  }
  Object.assign(globalThis, {
    localStorage,
    sessionStorage,
    window: { localStorage, sessionStorage, dispatchEvent: () => true },
  })
  return { store }
}

describe('applock and passkey-free biometrics', () => {
  beforeEach(() => {
    installBrowser()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks and persists PIN and pattern hashes', async () => {
    expect(lockEnabled()).toBe(false)

    await setPin('1234')
    expect(lockEnabled()).toBe(true)
    expect(await checkPin('1234')).toBe(true)
    expect(await checkPin('9999')).toBe(false)

    await setPattern('0-1-2-5')
    expect(await checkPattern('0-1-2-5')).toBe(true)
    expect(await checkPattern('0-1-2-4')).toBe(false)

    clearLock()
    expect(lockEnabled()).toBe(false)
  })

  it('supports biometric login universally without WebAuthn / Passkey APIs', async () => {
    // Even without PublicKeyCredential or navigator.credentials, biometric unlock is supported
    // @ts-expect-error mock
    delete globalThis.window.PublicKeyCredential
    // @ts-expect-error mock
    delete globalThis.navigator.credentials

    expect(isWebAuthnSupported()).toBe(true)
    expect(await isPlatformAuthenticatorAvailable()).toBe(true)
  })

  it('registers and authenticates locally without ever calling navigator.credentials (Passkey)', async () => {
    const createSpy = vi.fn().mockRejectedValue(new Error('Should never invoke Passkey create'))
    const getSpy = vi.fn().mockRejectedValue(new Error('Should never invoke Passkey get'))

    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: { create: createSpy, get: getSpy },
      configurable: true,
      writable: true,
    })

    // Seed a legacy credentialId to confirm registerBiometric clears it
    saveLock({ credentialId: 'legacy-passkey-id' })

    await registerBiometric()

    expect(createSpy).not.toHaveBeenCalled()
    expect(getSpy).not.toHaveBeenCalled()

    const saved = loadLock()
    expect(saved.biometricEnabled).toBe(true)
    expect(saved.biometricMode).toBe('device')
    expect(saved.biometricSalt).toBeDefined()
    expect(saved.biometricToken).toBeDefined()
    expect(saved.biometricHash).toBeDefined()
    expect(saved.credentialId).toBeUndefined()
    expect(isBiometricActive(saved)).toBe(true)
    expect(lockEnabled(saved)).toBe(true)

    const authResult = await authenticateWithBiometrics({ allowRegistration: false })
    expect(authResult.ok).toBe(true)
    expect(authResult.mode).toBe('device')
    expect(await verifyBiometric()).toBe(true)
    expect(createSpy).not.toHaveBeenCalled()
    expect(getSpy).not.toHaveBeenCalled()
  })

  it('migrates legacy credentialId records seamlessly on authenticate without Passkey', async () => {
    saveLock({ credentialId: btoa(String.fromCharCode(1, 2, 3, 4)) })

    const result = await authenticateWithBiometrics({ allowRegistration: false })
    expect(result.ok).toBe(true)
    expect(result.mode).toBe('device')

    const updated = loadLock()
    expect(updated.credentialId).toBeUndefined()
    expect(updated.biometricEnabled).toBe(true)
    expect(updated.biometricHash).toBeDefined()
  })

  it('returns error when biometric is not enabled and allowRegistration is false', async () => {
    const result = await authenticateWithBiometrics({ allowRegistration: false })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('فعال نشده')
  })

  it('uses native hardware biometric bridge when present and handles cancel gracefully', async () => {
    const nativeAuth = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    // @ts-expect-error mock native bridge
    globalThis.window.HesabyarBiometric = { authenticate: nativeAuth }

    await registerBiometric()
    expect(nativeAuth).toHaveBeenCalledTimes(1)
    expect(loadLock().biometricMode).toBe('native')

    const cancelled = await authenticateWithBiometrics({ allowRegistration: false })
    expect(cancelled.ok).toBe(false)
    expect(cancelled.error).toContain('لغو')
  })

  it('clears biometric state cleanly when disabled', async () => {
    await registerBiometric()
    expect(isBiometricActive()).toBe(true)

    setBiometricActive(false)
    const saved = loadLock()
    expect(isBiometricActive(saved)).toBe(false)
    expect(saved.biometricHash).toBeUndefined()
    expect(saved.biometricToken).toBeUndefined()
    expect(saved.credentialId).toBeUndefined()
  })
})
