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
  یازده: 11,
  دوازده: 12,
  سیزده: 13,
  چهارده: 14,
  پانزده: 15,
  شانزده: 16,
  هفده: 17,
  هجده: 18,
  نوزده: 19,
  بیست: 20,
  سی: 30,
  چهل: 40,
  پنجاه: 50,
  شصت: 60,
  هفتاد: 70,
  هشتاد: 80,
  نود: 90,
  صد: 100,
  دویست: 200,
  سیصد: 300,
  چهارصد: 400,
  پانصد: 500,
  ششصد: 600,
  هفتصد: 700,
  هشتصد: 800,
  نهصد: 900,
  هزار: 1_000,
  میلیون: 1_000_000,
  میلیارد: 1_000_000_000,
}

const FILTER_KEYWORDS = new Set([
  'هزینه',
  'درآمد',
  'واریز',
  'حقوق',
  'طلب',
  'پاداش',
  'خرید',
  'پرداخت',
  'تومان',
  'تومن',
  'تومنی',
  'ریال',
  'هزار',
  'میلیون',
  'میلیارد',
  'و',
  ...Object.keys(WORDS),
])

export interface VoiceDraft {
  kind: 'expense' | 'income'
  amount: number
  note: string
}

export function parseVoiceCommand(raw: string): VoiceDraft | null {
  const text = raw.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim()
  if (!text) return null
  const kind: VoiceDraft['kind'] = /درآمد|واریز|حقوق|طلب|پاداش/.test(text) ? 'income' : 'expense'
  const isToman = /تومان|تومن|تومنی/.test(text)
  const isRial = /ریال/.test(text)

  const digit = text.match(/(\d[\d,]*)/)
  let amount = digit ? Number(digit[1]!.replace(/,/g, '')) : 0

  if (!amount) {
    let acc = 0
    let subtotal = 0
    const parts = text.split(/[\s،,]+/)
    for (const part of parts) {
      if (part === 'و') continue
      const value = WORDS[part]
      if (value == null) continue
      if (value >= 1000) {
        subtotal = (subtotal || 1) * value
        acc += subtotal
        subtotal = 0
      } else {
        subtotal += value
      }
    }
    amount = acc + subtotal
  }

  if (!Number.isInteger(amount) || amount <= 0) return null
  if (/هزار/.test(text) && digit && amount < 1000) amount *= 1000
  if (/میلیون/.test(text) && digit && amount < 1_000_000) amount *= 1_000_000
  if (/میلیارد/.test(text) && digit && amount < 1_000_000_000) amount *= 1_000_000_000

  // In Iran, spoken amounts with "تومان/تومن" are converted to Rial (×10)
  if (isToman && !isRial) {
    amount *= 10
  }

  // Extract note by filtering out numbers and keywords
  const tokens = text.split(/[\s،,]+/)
  const noteTokens = tokens.filter((token) => {
    if (!token) return false
    if (/^\d+$/.test(token.replace(/,/g, ''))) return false
    if (FILTER_KEYWORDS.has(token)) return false
    return true
  })
  const note = noteTokens.join(' ').trim()

  return { kind, amount, note }
}
