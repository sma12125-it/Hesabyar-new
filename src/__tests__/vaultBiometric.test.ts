import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearVaultBiometric,
  hasVaultBiometric,
  saveVaultBiometricPhrase,
  unwrapVaultBiometricPhrase,
} from '../lib/vaultBiometric'
import { openCards, sealCards } from '../lib/vault'
import type { BankCard } from '../types'

describe('vaultBiometric', () => {
  beforeEach(async () => {
    await clearVaultBiometric()
  })

  it('returns false before biometric unlock is configured', async () => {
    expect(await hasVaultBiometric()).toBe(false)
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
  })

  it('overwrites existing wrapped passphrase when password changes', async () => {
    await saveVaultBiometricPhrase('old-pass-111')
    expect(await unwrapVaultBiometricPhrase()).toBe('old-pass-111')

    await saveVaultBiometricPhrase('new-pass-999')
    expect(await hasVaultBiometric()).toBe(true)
    expect(await unwrapVaultBiometricPhrase()).toBe('new-pass-999')
  })

  it('clears stored biometric material completely', async () => {
    await saveVaultBiometricPhrase('temp-pass-456')
    expect(await hasVaultBiometric()).toBe(true)

    await clearVaultBiometric()
    expect(await hasVaultBiometric()).toBe(false)
    await expect(unwrapVaultBiometricPhrase()).rejects.toThrow()
  })

  it('performs full round-trip card vault decryption using unwrapped biometric passphrase', async () => {
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

    const vaultPass = 'hesabyar-vault-2026'
    const sealed = await sealCards(vaultPass, sampleCards)
    await saveVaultBiometricPhrase(vaultPass)

    const unlockedPass = await unwrapVaultBiometricPhrase()
    const opened = await openCards(unlockedPass, sealed.salt, sealed.payload)

    expect(opened).toHaveLength(1)
    expect(opened[0].pan).toBe('6104337812345678')
    expect(opened[0].bankName).toBe('بانک ملت')
    expect(opened[0].sheba).toBe('IR120120000000001234567890')
  })
})
