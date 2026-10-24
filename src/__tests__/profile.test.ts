import { describe, expect, it } from 'vitest'
import {
  collectDeletedExpenseIds,
  displayNameOf,
  explainCloudError,
  handleError,
  mergeSharedDong,
  normalizeHandle,
  phoneError,
  presentSharedAsset,
  profileFromRow,
  shareableAccount,
  shareableCard,
  stampDongExpenses,
  stripSecrets,
  toPublicHandle,
  validateProfile,
  emptyProfile,
} from '../lib/profile'
import type { Account, BankCard, DongEvent } from '../types'

function event(patch: Partial<DongEvent> = {}): DongEvent {
  return {
    id: 'dong_1',
    title: 'سفر شمال',
    date: '2026-10-01',
    participants: [
      { id: 'a', name: 'علی' },
      { id: 'b', name: 'سارا' },
    ],
    expenses: [],
    createdAt: 1,
    updatedAt: 10,
    ...patch,
  }
}

describe('handles and profile fields', () => {
  it('normalizes handles and rejects the wrong shape', () => {
    expect(normalizeHandle(' @Ali_User ')).toBe('ali_user')
    expect(normalizeHandle('کاربر۱۲')).toBe('کاربر12')
    expect(handleError('ali_user')).toBeNull()
    expect(handleError('ab')).toMatch(/۳ تا ۲۰/)
    expect(handleError('1ali')).toMatch(/حرف انگلیسی/)
    expect(handleError('hesabyar')).toMatch(/قابل انتخاب نیست/)
    expect(handleError('علی')).toMatch(/حرف انگلیسی/)
  })

  it('checks phone and contact email without blocking an empty profile', () => {
    expect(phoneError('')).toBeNull()
    expect(phoneError('۰۹۱۲۳۴۵۶۷۸۹')).toBeNull()
    expect(phoneError('+989123456789')).toBeNull()
    expect(phoneError('02112345678')).toMatch(/۰۹/)
    expect(validateProfile({ ...emptyProfile(), email: 'not-an-email' })).toMatch(/ایمیل/)
    expect(validateProfile(emptyProfile())).toBeNull()
  })

  it('builds a display name from the first filled field', () => {
    expect(displayNameOf({ displayName: 'مادر', firstName: 'علی', lastName: 'رضایی', handle: 'ali' })).toBe('مادر')
    expect(displayNameOf({ displayName: '', firstName: 'علی', lastName: 'رضایی', handle: 'ali' })).toBe('علی رضایی')
    expect(displayNameOf({ displayName: '', firstName: '', lastName: '', handle: 'Ali' })).toBe('ali')
    expect(displayNameOf({ displayName: '', firstName: '', lastName: '', handle: '' })).toBe('کاربر حسابیار')
  })

  it('keeps a stored profile to its own fields', () => {
    const profile = profileFromRow({
      user_id: 'secret-user',
      first_name: 'علی',
      last_name: 'رضایی',
      email: 'ali@example.com',
      phone: '09120000000',
      avatar_url: 'data:image/jpeg;base64,aa',
      handle: 'ali',
      display_name: '',
      about: 'سلام',
      updated_at: '2026-10-24T00:00:00.000Z',
      cvv: '123',
    })
    expect(profile).toMatchObject({ firstName: 'علی', handle: 'ali', about: 'سلام' })
    expect(profile && 'user_id' in profile).toBe(false)
    expect(JSON.stringify(profile)).not.toContain('secret-user')
    expect(JSON.stringify(profile)).not.toContain('cvv')
  })
})

describe('public handle lookup', () => {
  it('returns only the handle and display name', () => {
    const pub = toPublicHandle({
      user_id: 'uuid-1',
      handle: 'sara',
      display_name: 'سارا محمدی',
      email: 'sara@example.com',
      phone: '09120000000',
      avatar_url: 'secret',
    })
    expect(pub).toEqual({ handle: 'sara', displayName: 'سارا محمدی' })
    expect(Object.keys(pub ?? {}).sort()).toEqual(['displayName', 'handle'])
    expect(toPublicHandle({ handle: '' })).toBeNull()
  })
})

describe('shared cards and accounts', () => {
  it('shares the card number and drops the CVV', () => {
    const card: BankCard = {
      id: 'card_1',
      bankName: 'ملت',
      holder: 'علی',
      pan: '6037991234567890',
      expiry: '1408/01',
      cvv: '123',
      sheba: 'IR123',
      note: '',
      createdAt: 1,
    }
    const shared = shareableCard(card)
    expect(shared.pan).toBe('6037991234567890')
    expect(shared).not.toHaveProperty('cvv')
    expect(stripSecrets({ pan: '1', CVV: '999', pin: '0000', nested: true }).CVV).toBeUndefined()
  })

  it('shares account identity without the ledger', () => {
    const account: Account = {
      id: 'acc',
      name: 'جاری',
      type: 'bank',
      archived: false,
      openingBalance: 0,
      balance: 250000,
      createdAt: 1,
      updatedAt: 2,
      accountNumber: '1234',
    }
    expect(shareableAccount(account)).toEqual({
      name: 'جاری',
      type: 'bank',
      accountNumber: '1234',
      balance: 250000,
    })
  })

  it('shows a received share without user ids or secrets', () => {
    const view = presentSharedAsset(
      {
        id: 'asset-1',
        owner_id: 'owner-1',
        grantee_id: 'me',
        kind: 'card',
        local_id: 'card_1',
        handle: 'sara',
        display_name: 'سارا',
        payload: { pan: '6037', cvv: '999', holder: 'علی' },
        updated_at: '2026-10-24T00:00:00.000Z',
      },
      'me',
    )
    expect(view?.mine).toBe(false)
    expect(view?.payload).toEqual({ pan: '6037', holder: 'علی' })
    expect(JSON.stringify(view)).not.toContain('owner-1')
    expect(JSON.stringify(view)).not.toContain('grantee')
    expect(JSON.stringify(view)).not.toContain('999')
  })
})

describe('shared dong merge', () => {
  it('leaves an unshared event on the newer copy', () => {
    const local = event({ expenses: [{ id: 'e1', title: 'نان', amount: 10, paidById: 'a', splitAmongIds: ['a', 'b'] }] })
    const incoming = event({ updatedAt: 20, expenses: [] })
    expect(mergeSharedDong(local, incoming).expenses).toEqual([])
    expect(mergeSharedDong(incoming, { ...local, updatedAt: 30 }).expenses).toHaveLength(1)
  })

  it('keeps a member expense and the owner structure', () => {
    const owner = event({
      remoteId: 'remote-1',
      shareRole: 'owner',
      structureUpdatedAt: 50,
      updatedAt: 50,
      madreKharj: { enabled: true, responsibleId: 'a', contributions: { a: 100, b: 100 } },
      expenses: [{ id: 'e1', title: 'ناهار', amount: 90, paidById: 'a', splitAmongIds: ['a', 'b'], updatedAt: 40 }],
    })
    const member = event({
      id: 'shared_remote-1',
      remoteId: 'remote-1',
      shareRole: 'member',
      title: 'عنوان عوض‌شده',
      participants: [{ id: 'a', name: 'شخص دیگر' }],
      madreKharj: undefined,
      updatedAt: 80,
      structureUpdatedAt: 1,
      expenses: [
        { id: 'e1', title: 'ناهار', amount: 90, paidById: 'a', splitAmongIds: ['a', 'b'], updatedAt: 40 },
        { id: 'e2', title: 'شام', amount: 40, paidById: 'b', splitAmongIds: ['a', 'b'], updatedAt: 80 },
      ],
    })
    const merged = mergeSharedDong(member, owner)
    expect(merged.id).toBe('shared_remote-1')
    expect(merged.title).toBe('سفر شمال')
    expect(merged.participants[0]?.name).toBe('علی')
    expect(merged.madreKharj?.enabled).toBe(true)
    expect(merged.expenses.map((item) => item.id).sort()).toEqual(['e1', 'e2'])
    expect(merged.shareRole).toBe('member')
  })

  it('does not bring back a deleted shared expense', () => {
    const local = event({
      remoteId: 'remote-1',
      shareRole: 'owner',
      expenses: [],
      deletedExpenseIds: ['e1'],
      updatedAt: 30,
    })
    const incoming = event({
      remoteId: 'remote-1',
      shareRole: 'member',
      updatedAt: 20,
      expenses: [{ id: 'e1', title: 'قدیمی', amount: 10, paidById: 'a', splitAmongIds: ['a'], updatedAt: 20 }],
    })
    expect(mergeSharedDong(local, incoming).expenses).toEqual([])
  })

  it('stamps only the expense that changed', () => {
    const prev = [{ id: 'e1', title: 'نان', amount: 10, paidById: 'a', splitAmongIds: ['a'], updatedAt: 5 }]
    const next = [
      { id: 'e1', title: 'نان', amount: 12, paidById: 'a', splitAmongIds: ['a'], updatedAt: 5 },
      { id: 'e2', title: 'شیر', amount: 8, paidById: 'b', splitAmongIds: ['a', 'b'] },
    ]
    const stamped = stampDongExpenses(prev, next, 100)
    expect(stamped[0]?.updatedAt).toBe(100)
    expect(stamped[1]?.updatedAt).toBe(100)
    const again = stampDongExpenses(stamped, stamped, 200)
    expect(again[0]?.updatedAt).toBe(100)
    const existing = event({
      remoteId: 'remote-1',
      expenses: prev,
    })
    expect(collectDeletedExpenseIds(existing, [])).toEqual(['e1'])
    expect(collectDeletedExpenseIds(event({ expenses: prev }), [])).toBeUndefined()
  })
})

describe('cloud errors', () => {
  it('points a missing table at the migration file', () => {
    expect(explainCloudError(404, '{"code":"PGRST205","message":"Could not find the table"}')).toMatch(/20261024_profiles_and_sharing/)
    expect(explainCloudError(400, '{"message":"این شناسه در حسابیار پیدا نشد"}')).toBe('این شناسه در حسابیار پیدا نشد')
    expect(explainCloudError(409, '{"code":"23505","message":"duplicate key value violates profiles_handle_lower_idx"}')).toBe(
      'این شناسه قبلاً گرفته شده',
    )
    expect(explainCloudError(401, 'Expected 3 parts in JWT: got 1')).toMatch(/نشست ابری معتبر نیست/)
  })
})
