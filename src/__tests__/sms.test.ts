import { describe, expect, it } from 'vitest'
import { confirmDraft, ingestBankSms, memorySmsStore } from '../lib/sms/drafts'
import { parseBankSms } from '../lib/sms/parsers'
import { toRial } from '../lib/sms/normalize'

const now = Date.UTC(2026, 8, 29, 7, 12, 0)

describe('bank sms parser', () => {
  it('reads an income amount in rial', () => {
    const parsed = parseBankSms('بانک نمونه\nواریز مبلغ 5,000,000 ریال\nمانده 10,000,000 ریال\nپیگیری 123456', now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.direction).toBe('INCOME')
    expect(parsed.value.amountRial).toBe(5_000_000)
    expect(parsed.value.currency).toBe('IRR')
    expect(parsed.value.balanceAfterRial).toBe(10_000_000)
    expect(parsed.value.reference).toBe('123456')
    expect(parsed.value.bankLabel).toBe('بانک نمونه')
  })

  it('reads a withdrawal as an expense', () => {
    const parsed = parseBankSms('برداشت مبلغ 2,000,000 ریال', now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.direction).toBe('EXPENSE')
    expect(parsed.value.amountRial).toBe(2_000_000)
  })

  it('reads a purchase in toman without multiplying twice', () => {
    const parsed = parseBankSms('خرید 850,000 تومان', now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.direction).toBe('EXPENSE')
    expect(parsed.value.currency).toBe('IRT')
    expect(parsed.value.amountMinor).toBe(850_000)
    expect(parsed.value.amountRial).toBe(8_500_000)
  })

  it('keeps a transfer out of income and expense', () => {
    const parsed = parseBankSms('انتقال مبلغ 3,000,000 ریال کارت به کارت', now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.direction).toBe('TRANSFER')
    expect(parsed.value.amountRial).toBe(3_000_000)
  })

  it('normalizes Persian digits', () => {
    const parsed = parseBankSms('واریز ۵,۰۰۰,۰۰۰ ریال', now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.amountRial).toBe(5_000_000)
  })

  it('normalizes Arabic-Indic digits', () => {
    const arabic = `واریز ${String.fromCharCode(0x0665, 0x066c, 0x0660, 0x0660, 0x0660, 0x066c, 0x0660, 0x0660, 0x0660)} ریال`
    const parsed = parseBankSms(arabic, now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.amountRial).toBe(5_000_000)
  })

  it('does not treat a rial amount as toman', () => {
    const parsed = parseBankSms('واریز 1000 ریال', now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.amountRial).toBe(1000)
    expect(toRial(1000, 'IRT')).toBe(10_000)
  })

  it('does not invent a unit when the SMS omits one', () => {
    const parsed = parseBankSms('واریز 5000000', now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.amountMinor).toBe(5_000_000)
    expect(parsed.value.currency).toBeNull()
    expect(parsed.value.amountRial).toBeNull()
    expect(parsed.value.needsReview).toBe(true)
  })

  it('does not invent an amount for an incomplete bank SMS', () => {
    const parsed = parseBankSms('بانک نمونه موجودی حساب بروز شد', now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.amountRial).toBeNull()
    expect(parsed.value.amountMinor).toBeNull()
    expect(parsed.value.needsReview).toBe(true)
    expect(parsed.value.direction).toBe('UNKNOWN')
  })

  it('ignores a message that is not a bank SMS', () => {
    expect(parseBankSms('سلام، خوبی؟', now)).toEqual({ kind: 'ignored', reason: 'not-bank' })
  })

  it('ignores a one-time password and does not return the code', () => {
    const parsed = parseBankSms('رمز یکبار مصرف شما ۴۵۸۲۱', now)
    expect(parsed).toEqual({ kind: 'ignored', reason: 'otp' })
  })

  it('does not parse a decimal as an integer amount', () => {
    const parsed = parseBankSms('واریز 12.5 ریال', now)
    expect(parsed.kind).toBe('parsed')
    if (parsed.kind !== 'parsed') return
    expect(parsed.value.amountRial).toBeNull()
  })
})

describe('sms review queue', () => {
  const body = 'واریز مبلغ 5,000,000 ریال پیگیری 999111'

  it('creates one pending draft when the same SMS arrives twice', async () => {
    const store = memorySmsStore()
    const first = await ingestBankSms({ sender: 'بانک', body, mode: 'manual-import' }, store)
    const second = await ingestBankSms({ sender: 'بانک', body, mode: 'manual-import' }, store)
    expect(first.status).toBe('created')
    expect(second.status).toBe('duplicate')
    const pending = (await store.load()).drafts.filter((draft) => draft.status === 'PENDING')
    expect(pending).toHaveLength(1)
  })

  it('does not store a one-time password', async () => {
    const store = memorySmsStore({ settings: { ...memorySettings(), saveOriginalSms: true } })
    const code = '458219'
    const result = await ingestBankSms({ sender: 'بانک', body: `رمز یکبار مصرف ${code}`, mode: 'manual-import' }, store)
    expect(result.status).toBe('ignored')
    expect(JSON.stringify(await store.load())).not.toContain(code)
  })

  it('does not create another ledger entry after the SMS was confirmed', async () => {
    const store = memorySmsStore()
    const created = await ingestBankSms({ sender: 'بانک', body, mode: 'manual-import' }, store)
    if (created.status !== 'created') throw new Error('expected a draft')
    let writes = 0
    const sink = {
      addQuickEntry: async () => {
        writes += 1
      },
      addTransfer: async () => {
        writes += 1
      },
    }
    const draft = (await store.load()).drafts[0]!
    await confirmDraft(draft.id, {
      direction: 'INCOME',
      amountRial: draft.amountRial ?? 0,
      accountId: 'acc-1',
      categoryId: 'salary',
      description: 'حقوق شهریور',
      date: '2026-09-29',
    }, sink, store)
    await expect(confirmDraft(draft.id, {
      direction: 'INCOME',
      amountRial: 5_000_000,
      accountId: 'acc-1',
      categoryId: 'salary',
      description: '',
      date: '2026-09-29',
    }, sink, store)).rejects.toThrow()
    const again = await ingestBankSms({ sender: 'بانک', body, mode: 'manual-import' }, store)
    expect(again.status).toBe('duplicate')
    expect(writes).toBe(1)
    const saved = await store.load()
    expect(saved.drafts[0]?.status).toBe('CONFIRMED')
    expect(saved.drafts[0]?.originalMessage).toBeNull()
    expect(JSON.stringify(saved)).not.toContain('واریز مبلغ')
  })

  it('keeps a transfer as one transfer, not income plus expense', async () => {
    const store = memorySmsStore()
    const created = await ingestBankSms({
      sender: 'بانک',
      body: 'انتقال مبلغ 3,000,000 ریال',
      mode: 'manual-import',
    }, store)
    if (created.status !== 'created') throw new Error('expected a draft')
    let transfer = 0
    let entry = 0
    await confirmDraft(created.draftId, {
      direction: 'TRANSFER',
      amountRial: 3_000_000,
      accountId: 'a',
      counterpartyAccountId: 'b',
      categoryId: 'transfer',
      description: '',
      date: '2026-09-29',
    }, {
      addQuickEntry: async () => {
        entry += 1
      },
      addTransfer: async () => {
        transfer += 1
      },
    }, store)
    expect(transfer).toBe(1)
    expect(entry).toBe(0)
  })
})

function memorySettings() {
  return {
    enableDetection: true,
    autoDetect: true,
    showNotifications: false,
    saveOriginalSms: false,
    descriptionRequired: false,
    displayUnit: 'IRR' as const,
  }
}
