import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearVaultBiometric,
  ensureTemporaryVaultDeviceKey,
  getVaultDeviceKeyInfo,
  hasVaultBiometric,
  saveVaultBiometricPhrase,
  unwrapVaultBiometricPhrase,
} from '../lib/vaultBiometric'
import { openCards, sealCards, unwrapText, wrapText } from '../lib/vault'
import type { BankCard } from '../types'

describe('vaultBiometric & unified account-password migration', () => {
  beforeEach(async () => {
    await clearVaultBiometric()
  })

  it('returns false before biometric/device key is configured', async () => {
    expect(await hasVaultBiometric()).toBe(false)
    expect(await getVaultDeviceKeyInfo()).toBeNull()
    await expect(unwrapVaultBiometricPhrase()).rejects.toThrow()
  })

  it('rejects empty passphrases', async () => {
    await expect(saveVaultBiometricPhrase('   ')).rejects.toThrow()
    expect(await hasVaultBiometric()).toBe(false)
  })

  it('wraps and unwraps a vault passphrase cleanly', async () => {
    await saveVaultBiometricPhrase('my-secret-123')
    expect(await hasVaultBiometric()).toBe(true)

    const unwrapped = await unwrapVaultBiometricPhrase()
    expect(unwrapped).toBe('my-secret-123')

    const info = await getVaultDeviceKeyInfo()
    expect(info).toEqual({ phrase: 'my-secret-123', isTemporaryDeviceKey: false })
  })

  it('overwrites existing wrapped passphrase when account password changes', async () => {
    await saveVaultBiometricPhrase('old-pass-111')
    expect(await unwrapVaultBiometricPhrase()).toBe('old-pass-111')

    await saveVaultBiometricPhrase('new-pass-999')
    expect(await hasVaultBiometric()).toBe(true)
    expect(await unwrapVaultBiometricPhrase()).toBe('new-pass-999')
  })

  it('creates a temporary device key and cleanly migrates it to real account password', async () => {
    const tempKey = await ensureTemporaryVaultDeviceKey()
    expect(tempKey.length).toBeGreaterThanOrEqual(24)

    const info1 = await getVaultDeviceKeyInfo()
    expect(info1).toEqual({ phrase: tempKey, isTemporaryDeviceKey: true })

    // Re-calling returns the same temporary key
    expect(await ensureTemporaryVaultDeviceKey()).toBe(tempKey)

    // Saving real account password clears temporary flag
    await saveVaultBiometricPhrase('real-account-pass', { isTemporaryDeviceKey: false })
    const info2 = await getVaultDeviceKeyInfo()
    expect(info2).toEqual({ phrase: 'real-account-pass', isTemporaryDeviceKey: false })
  })

  it('clears stored biometric material completely', async () => {
    await saveVaultBiometricPhrase('temp-pass-456')
    expect(await hasVaultBiometric()).toBe(true)

    await clearVaultBiometric()
    expect(await hasVaultBiometric()).toBe(false)
    expect(await getVaultDeviceKeyInfo()).toBeNull()
    await expect(unwrapVaultBiometricPhrase()).rejects.toThrow()
  })

  it('migrates legacy separate vault password to account login password without data loss', async () => {
    const sampleCards: BankCard[] = [
      {
        id: 'card-1',
        bankName: 'بانک ملت',
        holder: 'علی رضایی',
        pan: '6104337812345678',
        expiry: '08/07',
        cvv: '412',
        sheba: 'IR120120000000001234567890',
        accountNumber: '123456789',
        accountId: 'acc-1',
        note: 'کارت اصلی',
        createdAt: Date.now(),
      },
    ]

    const legacyVaultPass = 'old-separate-vault-pass'
    const accountLoginPass = 'my-hesabyar-login-2026'

    // Legacy vault sealed with separate password, wrapped with account password
    const legacySealed = await sealCards(legacyVaultPass, sampleCards)
    const accountWrap = await wrapText(legacyVaultPass, accountLoginPass)

    // Opening directly with accountLoginPass fails initially
    await expect(openCards(accountLoginPass, legacySealed.salt, legacySealed.payload)).rejects.toThrow()

    // Unwrap legacy passphrase via accountWrap, open cards, and migrate to accountLoginPass
    const recoveredLegacyPass = await unwrapText(accountWrap, accountLoginPass)
    const opened = await openCards(recoveredLegacyPass, legacySealed.salt, legacySealed.payload)
    const migratedSealed = await sealCards(accountLoginPass, opened)
    await saveVaultBiometricPhrase(accountLoginPass, { isTemporaryDeviceKey: false })

    // Subsequent open works directly with accountLoginPass and device-local unwrapped key
    const unwrapped = await unwrapVaultBiometricPhrase()
    expect(unwrapped).toBe(accountLoginPass)

    const reopened = await openCards(unwrapped, migratedSealed.salt, migratedSealed.payload)
    expect(reopened).toHaveLength(1)
    expect(reopened[0].pan).toBe('6104337812345678')
    expect(reopened[0].sheba).toBe('IR120120000000001234567890')
  })

  it('persists and recovers device-local vault key via localStorage mirror across reloads', async () => {
    const store = new Map<string, string>()
    Object.assign(globalThis, {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    })

    await saveVaultBiometricPhrase('persistent-card-key-77')
    expect(store.has('hy-card-vault-bio-v1')).toBe(true)

    const recovered = await getVaultDeviceKeyInfo()
    expect(recovered?.phrase).toBe('persistent-card-key-77')

    await clearVaultBiometric()
    expect(store.has('hy-card-vault-bio-v1')).toBe(false)
    expect(await getVaultDeviceKeyInfo()).toBeNull()
  })
})
