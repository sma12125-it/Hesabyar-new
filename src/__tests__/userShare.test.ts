import { describe, expect, it } from 'vitest'
import {
  addSharedUser,
  getSharedUsers,
  lookupUserByIdOrHandle,
  removeSharedUser,
  type SharedUserProfile,
} from '../lib/userShare'

describe('userShare module', () => {
  it('looks up a user by manual handle', async () => {
    const user = await lookupUserByIdOrHandle('@ali_reza')
    expect(user).not.toBeNull()
    expect(user?.handle).toBe('ali_reza')
    expect(user?.displayName).toBe('علی رضایی')
    expect(user?.userId).toBe('usr_9a2f1c84')
  })

  it('looks up a user by user ID', async () => {
    const user = await lookupUserByIdOrHandle('usr_3b8e721a')
    expect(user).not.toBeNull()
    expect(user?.handle).toBe('sara_t')
    expect(user?.displayName).toBe('سارا تقوی')
  })

  it('enforces maximum 10 shared users limit', async () => {
    const cardId = 'test_card_limit_10'

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
