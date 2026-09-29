const WORDS: Record<string, number> = {
  صفر: 0,
  یک: 1,
  دو: 2,
  سه: 3,
  چهار: 4,
  پنج: 5,
  شش: 6,
  هفت: 7,
  هشت: 8,
  نه: 9,
  ده: 10,
  بیست: 20,
  سی: 30,
  چهل: 40,
  پنجاه: 50,
  شصت: 60,
  هفتاد: 70,
  هشتاد: 80,
  نود: 90,
  صد: 100,
  هزار: 1_000,
  میلیون: 1_000_000,
  میلیارد: 1_000_000_000,
}

export interface VoiceDraft {
  kind: 'expense' | 'income'
  amount: number
  note: string
}

export function parseVoiceCommand(raw: string): VoiceDraft | null {
  const text = raw.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim()
  if (!text) return null
  const kind: VoiceDraft['kind'] = /درآمد|واریز|حقوق/.test(text) ? 'income' : 'expense'
  const digit = text.match(/(\d[\d,]*)/)
  let amount = digit ? Number(digit[1]!.replace(/,/g, '')) : 0
  if (!amount) {
    let acc = 0
    let current = 0
    for (const part of text.split(/\s+/)) {
      const value = WORDS[part]
      if (value == null) continue
      if (value >= 1000) {
        current = (current || 1) * value
        acc += current
        current = 0
      } else if (value === 100) {
        current = (current || 1) * 100
      } else {
        current += value
      }
    }
    amount = acc + current
  }
  if (!Number.isInteger(amount) || amount <= 0) return null
  if (/هزار/.test(text) && digit && amount < 1000) amount *= 1000
  if (/میلیون/.test(text) && digit && amount < 1_000_000) amount *= 1_000_000
  const note = text
    .replace(/هزینه|درآمد|واریز|حقوق|هزار|میلیون|تومان|ریال/g, '')
    .replace(/\d[\d,]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { kind, amount, note }
}
