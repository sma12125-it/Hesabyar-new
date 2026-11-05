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
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
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

describe('applock and WebAuthn biometrics', () => {
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

  it('detects WebAuthn support correctly', () => {
    // When window.PublicKeyCredential and navigator.credentials are undefined
    expect(isWebAuthnSupported()).toBe(false)

    // @ts-expect-error mock
    globalThis.window.PublicKeyCredential = class {}
    // @ts-expect-error mock
    globalThis.navigator.credentials = {}
    expect(isWebAuthnSupported()).toBe(true)
  })

  it('returns false gracefully when WebAuthn is unsupported or credentials missing', async () => {
    // @ts-expect-error mock
    delete globalThis.window.PublicKeyCredential
    // @ts-expect-error mock
    delete globalThis.navigator.credentials

    const res = await authenticateWithBiometrics()
    expect(res.ok).toBe(false)
    expect(res.error).toContain('WebAuthn')
  })

  it('authenticates and registers new biometric credential via WebAuthn create', async () => {
    const rawIdBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer
    const mockCred = {
      rawId: rawIdBuffer,
      id: 'mock-cred-id',
      type: 'public-key',
    }

    class MockPublicKeyCredential {
      static isUserVerifyingPlatformAuthenticatorAvailable = vi.fn().mockResolvedValue(true)
    }

    // @ts-expect-error mock
    globalThis.window.PublicKeyCredential = MockPublicKeyCredential
    // @ts-expect-error mock
    globalThis.PublicKeyCredential = MockPublicKeyCredential

    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: {
        create: vi.fn().mockResolvedValue(mockCred),
        get: vi.fn(),
      },
      configurable: true,
      writable: true,
    })

    expect(await isPlatformAuthenticatorAvailable()).toBe(true)

    const result = await authenticateWithBiometrics({ allowRegistration: true })
    expect(result.ok).toBe(true)
    expect(result.registered).toBe(true)

    const saved = loadLock()
    expect(saved.credentialId).toBeDefined()
    expect(lockEnabled()).toBe(true)
  })

  it('authenticates with existing credential via WebAuthn get', async () => {
    const rawIdBuffer = new Uint8Array([1, 2, 3, 4]).buffer
    const mockCred = {
      rawId: rawIdBuffer,
      id: 'existing-cred-id',
      type: 'public-key',
    }

    saveLock({ credentialId: btoa(String.fromCharCode(1, 2, 3, 4)) })

    class MockPublicKeyCredential {}
    // @ts-expect-error mock
    globalThis.window.PublicKeyCredential = MockPublicKeyCredential
    // @ts-expect-error mock
    globalThis.PublicKeyCredential = MockPublicKeyCredential

    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: {
        create: vi.fn(),
        get: vi.fn().mockResolvedValue(mockCred),
      },
      configurable: true,
      writable: true,
    })

    const result = await authenticateWithBiometrics()
    expect(result.ok).toBe(true)
    expect(await verifyBiometric()).toBe(true)
  })

  it('handles user cancellation (NotAllowedError) gracefully', async () => {
    saveLock({ credentialId: btoa(String.fromCharCode(9, 8, 7)) })

    const notAllowed = new Error('User cancelled')
    notAllowed.name = 'NotAllowedError'

    class MockPublicKeyCredential {}
    // @ts-expect-error mock
    globalThis.window.PublicKeyCredential = MockPublicKeyCredential
    // @ts-expect-error mock
    globalThis.PublicKeyCredential = MockPublicKeyCredential

    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: {
        create: vi.fn().mockRejectedValue(notAllowed),
        get: vi.fn().mockRejectedValue(notAllowed),
      },
      configurable: true,
      writable: true,
    })

    const result = await authenticateWithBiometrics({ allowRegistration: false })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('لغو')
  })
})
