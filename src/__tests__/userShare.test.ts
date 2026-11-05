import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addSharedUser,
  getSharedUsers,
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
})
