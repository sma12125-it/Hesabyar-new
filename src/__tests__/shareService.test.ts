import { describe, expect, it } from 'vitest'
import {
  registerUserProfile,
  lookupUserProfile,
  shareAssetWithUser,
  getAssetShares,
  revokeAssetShare,
  getIncomingSharesForUser,
} from '../server/shareService'

describe('server shareService', () => {
  it('registers and looks up a real user profile', () => {
    const registered = registerUserProfile({
      userId: 'usr_test_ali',
      handle: 'ali_rezaei',
      displayName: 'علی رضایی',
      firstName: 'علی',
      lastName: 'رضایی',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240',
      email: 'ali@example.com',
    })

    expect(registered.userId).toBe('usr_test_ali')
    expect(registered.handle).toBe('ali_rezaei')

    // Lookup by handle with @
    const byHandle = lookupUserProfile('@ali_rezaei')
    expect(byHandle).not.toBeNull()
    expect(byHandle?.displayName).toBe('علی رضایی')
    expect(byHandle?.userId).toBe('usr_test_ali')

    // Lookup by userId
    const byId = lookupUserProfile('usr_test_ali')
    expect(byId).not.toBeNull()
    expect(byId?.handle).toBe('ali_rezaei')

    // Lookup by non-existent query returns null (strictly no fake sample user generation)
    const notFound = lookupUserProfile('usr_unknown_random_user_999')
    expect(notFound).toBeNull()
  })

  it('shares an asset and enforces maximum 10 users capacity', () => {
    const assetId = `acc_test_unique_${Date.now()}_${Math.random().toString(36).slice(2)}`

    for (let i = 1; i <= 10; i++) {
      const res = shareAssetWithUser({
        assetKind: 'account',
        assetId,
        assetName: 'حساب بانک صادرات',
        ownerUserId: 'usr_owner_1',
        ownerDisplayName: 'محمد صاحب‌حساب',
        granteeUser: {
          userId: `usr_grantee_${i}`,
          handle: `user_grantee_${i}`,
          displayName: `عضو مجاز ${i}`,
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=240',
        },
      })
      expect(res.success).toBe(true)
      expect(res.total).toBe(i)
    }

    const currentShares = getAssetShares('account', assetId)
    expect(currentShares.length).toBe(10)

    // Attempting to add an 11th user should throw max capacity error
    expect(() =>
      shareAssetWithUser({
        assetKind: 'account',
        assetId,
        assetName: 'حساب بانک صادرات',
        ownerUserId: 'usr_owner_1',
        granteeUser: {
          userId: 'usr_grantee_11',
          handle: 'user_grantee_11',
          displayName: 'عضو مجاز ۱۱',
        },
      }),
    ).toThrow('حداکثر با ۱۰ کاربر')

    // Revoking 1 user allows adding again
    const revokeRes = revokeAssetShare('account', assetId, 'usr_grantee_1')
    expect(revokeRes.success).toBe(true)
    expect(revokeRes.remaining).toBe(9)

    const reAddRes = shareAssetWithUser({
      assetKind: 'account',
      assetId,
      assetName: 'حساب بانک صادرات',
      ownerUserId: 'usr_owner_1',
      granteeUser: {
        userId: 'usr_grantee_11',
        handle: 'user_grantee_11',
        displayName: 'عضو مجاز ۱۱',
      },
    })
    expect(reAddRes.success).toBe(true)
    expect(reAddRes.total).toBe(10)
  })

  it('retrieves incoming shares for a recipient user', () => {
    const cardId = 'card_test_incoming_789'

    shareAssetWithUser({
      assetKind: 'card',
      assetId: cardId,
      assetName: 'کارت بانک ملت',
      assetDetails: { bankName: 'بانک ملت', pan: '6104-3378-9999-1111' },
      ownerUserId: 'usr_owner_boss',
      ownerDisplayName: 'امیر مدیر',
      granteeUser: {
        userId: 'usr_recipient_sara',
        handle: 'sara_recipient',
        displayName: 'سارا تقوی',
      },
    })

    const saraShares = getIncomingSharesForUser('usr_recipient_sara', 'sara_recipient')
    expect(saraShares.length).toBeGreaterThanOrEqual(1)
    const foundCard = saraShares.find((s) => s.assetId === cardId)
    expect(foundCard).toBeDefined()
    expect(foundCard?.ownerDisplayName).toBe('امیر مدیر')
    expect(foundCard?.assetName).toBe('کارت بانک ملت')
  })
})
