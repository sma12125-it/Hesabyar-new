import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addSharedUser,
  getSharedUsers,
  isIncomingSharedAsset,
  lookupUserByIdOrHandle,
  removeSharedUser,
  type SharedUserProfile,
} from '../lib/userShare'

describe('userShare module', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('looks up a real user profile from server', async () => {
    const mockProfile = {
      userId: 'usr_9a2f1c84',
      handle: 'ali_reza',
      displayName: 'علی رضایی',
      firstName: 'علی',
      lastName: 'رضایی',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240',
      email: 'ali@example.com',
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, profile: mockProfile }),
    } as any)

    const user = await lookupUserByIdOrHandle('@ali_reza')
    expect(user).not.toBeNull()
    expect(user?.handle).toBe('ali_reza')
    expect(user?.displayName).toBe('علی رضایی')
    expect(user?.userId).toBe('usr_9a2f1c84')
    expect(user?.avatarUrl).toContain('images.unsplash.com')
  })

  it('strictly returns null when user is not found on server (no sample mock generation)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: 'کاربری با این مشخصات یافت نشد' }),
    } as any)

    const user = await lookupUserByIdOrHandle('usr_unknown_fake_user_123')
    expect(user).toBeNull()
  })

  it('enforces maximum 10 shared users limit', async () => {
    const cardId = 'test_card_limit_10'

    // Mock fetch to succeed
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as any)

    // Add 10 users
    for (let i = 1; i <= 10; i++) {
      const u: SharedUserProfile = {
        userId: `usr_limit_${i}`,
        handle: `user_${i}`,
        displayName: `کاربر شماره ${i}`,
        sharedAt: new Date().toISOString(),
      }
      const res = await addSharedUser('card', cardId, u)
      expect(res.success).toBe(true)
    }

    const current = await getSharedUsers('card', cardId)
    expect(current.length).toBe(10)

    // Attempt to add 11th user should throw error
    const eleventh: SharedUserProfile = {
      userId: 'usr_limit_11',
      handle: 'user_11',
      displayName: 'کاربر شماره ۱۱',
      sharedAt: new Date().toISOString(),
    }

    await expect(addSharedUser('card', cardId, eleventh)).rejects.toThrow('حداکثر با ۱۰ کاربر')

    // Removing one user should allow adding another
    await removeSharedUser('card', cardId, 'usr_limit_1')
    const afterRemove = await getSharedUsers('card', cardId)
    expect(afterRemove.length).toBe(9)

    await expect(addSharedUser('card', cardId, eleventh)).resolves.toEqual({
      success: true,
      total: 10,
    })
  })

  it('isIncomingSharedAsset strictly returns false for owned assets even with shareId', () => {
    const me = 'usr_owner_me'

    // Normal owned account / card (unshared)
    expect(isIncomingSharedAsset({ isShared: false, ownerUserId: me }, me)).toBe(false)
    expect(isIncomingSharedAsset({}, me)).toBe(false)

    // Owned account attached with a legacy Supabase shareId
    expect(isIncomingSharedAsset({ shareId: 'ledger_123', isShared: false, ownerUserId: me }, me)).toBe(false)
    expect(isIncomingSharedAsset({ shareId: 'ledger_123' } as any, me)).toBe(false)

    // Even if isShared were accidentally true, ownerUserId === me must return false
    expect(isIncomingSharedAsset({ isShared: true, ownerUserId: me }, me)).toBe(false)

    // Shared card received by another recipient account in same browser must return false
    expect(
      isIncomingSharedAsset(
        { isShared: true, ownerUserId: 'usr_other_boss', recipientUserId: 'usr_different_user' },
        me,
      ),
    ).toBe(false)

    // Genuine incoming shared asset from another user to me returns true
    expect(
      isIncomingSharedAsset(
        { isShared: true, ownerUserId: 'usr_other_boss', recipientUserId: me },
        me,
      ),
    ).toBe(true)
  })

  it('normalizes Persian digits during profile lookup and serializes installment/debt/cheque details', async () => {
    const {
      serializeInstallmentShareDetails,
      serializeDebtShareDetails,
      serializeChequeShareDetails,
    } = await import('../lib/userShare')

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        profile: { userId: 'usr_1234', handle: 'user_1234', displayName: 'کاربر ۱۲۳۴' },
      }),
    } as any)

    const found = await lookupUserByIdOrHandle('usr_۱۲۳۴')
    expect(found?.userId).toBe('usr_1234')
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/profiles/lookup?q=usr_1234')

    const planDetails = serializeInstallmentShareDetails(
      {
        id: 'p1',
        name: 'وام',
        installmentAmount: 2_000_000,
        totalCount: 2,
        startDate: '2026-10-01',
        categoryId: 'installments',
        status: 'active',
        createdAt: 1,
        updatedAt: 50,
      },
      [
        { id: 'i2', planId: 'p1', index: 2, dueDate: '2026-11-01', amount: 2_000_000, status: 'pending' },
        { id: 'i1', planId: 'p1', index: 1, dueDate: '2026-10-01', amount: 2_000_000, status: 'paid', paidAt: '2026-10-02' },
      ],
    )
    expect((planDetails.items as any[]).map((i) => i.index)).toEqual([1, 2])
    expect(planDetails.name).toBe('وام')

    const debtDetails = serializeDebtShareDetails({
      id: 'd1',
      direction: 'lent',
      party: 'سعید',
      amount: 500_000,
      note: 'ناهار',
      status: 'settled',
      settledAt: '2026-10-10',
      createdAt: 1,
    })
    expect(debtDetails).toMatchObject({ direction: 'lent', party: 'سعید', status: 'settled' })

    const chequeDetails = serializeChequeShareDetails({
      id: 'c1',
      direction: 'payable',
      sayadId: '1234567890123456',
      bankName: 'بانک ملت',
      amount: 12_000_000,
      dueDate: '2026-12-01',
      party: 'شرکت',
      status: 'pending',
      note: 'قرارداد',
      createdAt: 1,
    })
    expect(chequeDetails).toMatchObject({ sayadId: '1234567890123456', bankName: 'بانک ملت', status: 'pending' })
  })
})

