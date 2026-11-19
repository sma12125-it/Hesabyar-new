import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadLock,
  saveLock,
  lockEnabled,
  setPin,
  checkPin,
  clearPin,
  setPattern,
  checkPattern,
  clearPattern,
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
  const mockWin = {
    localStorage,
    sessionStorage,
    location: { hostname: 'localhost' },
    dispatchEvent: () => true,
  } as Record<string, unknown>
  mockWin.self = mockWin
  mockWin.top = mockWin

  Object.assign(globalThis, {
    localStorage,
    sessionStorage,
    window: mockWin,
  })
  return { store }
}

describe('applock and real hardware biometrics', () => {
  beforeEach(() => {
    installBrowser()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks, persists, and clears PIN and pattern hashes', async () => {
    expect(lockEnabled()).toBe(false)

    await setPin('1234')
    expect(lockEnabled()).toBe(true)
    expect(await checkPin('1234')).toBe(true)
    expect(await checkPin('9999')).toBe(false)

    clearPin()
    expect(await checkPin('1234')).toBe(false)

    await setPattern('0-1-2-5')
    expect(await checkPattern('0-1-2-5')).toBe(true)
    expect(await checkPattern('0-1-2-4')).toBe(false)

    clearPattern()
    expect(await checkPattern('0-1-2-5')).toBe(false)

    clearLock()
    expect(lockEnabled()).toBe(false)
  })

  it('rejects simulated legacy device-only biometric records and never fake-unlocks', async () => {
    // @ts-expect-error mock
    delete globalThis.window.PublicKeyCredential
    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    // A previously stored fake 'device' token without real credentialId must NOT be treated as active
    saveLock({
      biometricEnabled: true,
      biometricMode: 'device',
      biometricHash: 'fakehash',
      biometricSalt: 'fakesalt',
      biometricToken: 'faketoken',
    })
    expect(isBiometricActive()).toBe(false)
    expect(isWebAuthnSupported()).toBe(false)
    expect(await isPlatformAuthenticatorAvailable()).toBe(false)

    const res = await authenticateWithBiometrics()
    expect(res.ok).toBe(false)
    expect(await verifyBiometric()).toBe(false)
  })

  it('registers real local device-bound platform biometric (residentKey discouraged, userVerification required)', async () => {
    const rawIdBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer
    const createSpy = vi.fn().mockResolvedValue({
      rawId: rawIdBuffer,
      id: 'platform-cred-id',
      type: 'public-key',
    })

    class MockPublicKeyCredential {
      static isUserVerifyingPlatformAuthenticatorAvailable = vi.fn().mockResolvedValue(true)
    }

    // @ts-expect-error mock
    globalThis.window.PublicKeyCredential = MockPublicKeyCredential
    // @ts-expect-error mock
    globalThis.PublicKeyCredential = MockPublicKeyCredential

    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: { create: createSpy, get: vi.fn() },
      configurable: true,
      writable: true,
    })

    expect(isWebAuthnSupported()).toBe(true)
    expect(await isPlatformAuthenticatorAvailable()).toBe(true)

    await registerBiometric()

    expect(createSpy).toHaveBeenCalledTimes(1)
    const callArg = createSpy.mock.calls[0]![0]
    expect(callArg.publicKey.authenticatorSelection).toEqual({
      authenticatorAttachment: 'platform',
      residentKey: 'discouraged',
      requireResidentKey: false,
      userVerification: 'required',
    })

    const saved = loadLock()
    expect(saved.credentialId).toBeDefined()
    expect(saved.biometricMode).toBe('platform')
    expect(saved.biometricEnabled).toBe(true)
    expect(isBiometricActive(saved)).toBe(true)
    expect(lockEnabled(saved)).toBe(true)
  })

  it('verifies existing hardware credential via credentials.get and checks UV flag', async () => {
    saveLock({
      credentialId: btoa(String.fromCharCode(1, 2, 3, 4)),
      biometricEnabled: true,
      biometricMode: 'platform',
    })

    // AuthenticatorData with User Verified (UV = 0x04) + User Present (UP = 0x01) at byte 32
    const authDataVerified = new Uint8Array(37)
    authDataVerified[32] = 0x05

    const authDataUnverified = new Uint8Array(37)
    authDataUnverified[32] = 0x01 // UP only, NO UV!

    const getSpy = vi
      .fn()
      .mockResolvedValueOnce({
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        response: { authenticatorData: authDataVerified.buffer },
      })
      .mockResolvedValueOnce({
        rawId: new Uint8Array([1, 2, 3, 4]).buffer,
        response: { authenticatorData: authDataUnverified.buffer },
      })

    class MockPublicKeyCredential {
      static isUserVerifyingPlatformAuthenticatorAvailable = vi.fn().mockResolvedValue(true)
    }

    // @ts-expect-error mock
    globalThis.window.PublicKeyCredential = MockPublicKeyCredential
    // @ts-expect-error mock
    globalThis.PublicKeyCredential = MockPublicKeyCredential

    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: { create: vi.fn(), get: getSpy },
      configurable: true,
      writable: true,
    })

    const okRes = await authenticateWithBiometrics()
    expect(okRes.ok).toBe(true)
    expect(okRes.mode).toBe('platform')
    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(getSpy.mock.calls[0]![0].publicKey.userVerification).toBe('required')
    expect(getSpy.mock.calls[0]![0].publicKey.allowCredentials[0].transports).toEqual(['internal'])

    // Must reject if UV flag is NOT set
    const unverifiedRes = await authenticateWithBiometrics()
    expect(unverifiedRes.ok).toBe(false)
  })

  it('handles cancellation and iframe SecurityError honestly without unlocking', async () => {
    saveLock({
      credentialId: btoa(String.fromCharCode(9, 8, 7)),
      biometricEnabled: true,
      biometricMode: 'platform',
    })

    const notAllowed = new Error('User cancelled')
    notAllowed.name = 'NotAllowedError'

    const secErr = new Error('publickey-credentials-get not allowed in this document')
    secErr.name = 'SecurityError'

    class MockPublicKeyCredential {}
    // @ts-expect-error mock
    globalThis.window.PublicKeyCredential = MockPublicKeyCredential
    // @ts-expect-error mock
    globalThis.PublicKeyCredential = MockPublicKeyCredential

    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: {
        create: vi.fn().mockRejectedValue(secErr),
        get: vi.fn().mockRejectedValueOnce(notAllowed).mockRejectedValueOnce(secErr),
      },
      configurable: true,
      writable: true,
    })

    const cancelled = await authenticateWithBiometrics({ allowRegistration: false })
    expect(cancelled.ok).toBe(false)
    expect(cancelled.error).toContain('لغو')

    const blocked = await authenticateWithBiometrics({ allowRegistration: false })
    expect(blocked.ok).toBe(false)
    expect(blocked.error).toContain('iframe')
  })

  it('uses native hardware biometric bridge when present and handles cancel gracefully', async () => {
    const nativeAuth = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    // @ts-expect-error mock native bridge
    globalThis.window.HesabyarBiometric = { authenticate: nativeAuth }

    await registerBiometric()
    expect(nativeAuth).toHaveBeenCalledTimes(1)
    expect(loadLock().biometricMode).toBe('native')
    expect(isBiometricActive()).toBe(true)

    const cancelled = await authenticateWithBiometrics({ allowRegistration: false })
    expect(cancelled.ok).toBe(false)
    expect(cancelled.error).toContain('لغو')

    setBiometricActive(false)
    expect(isBiometricActive()).toBe(false)
  })
})
