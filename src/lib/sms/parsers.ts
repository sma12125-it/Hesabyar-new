import { jalaliToIso } from '../jalaali'
import { isValidIsoDate } from '../iso'
import { currencyFromUnit, normalizeSmsText, parseIntegerToken, toRial } from './normalize'
import type { BankParser, ParsedBankSms, SmsCurrency, SmsDirection } from './types'

export const PARSER_VERSION = '1'

const BANK_HINT = /واریز|برداشت|خرید|انتقال|کارت\s*به\s*کارت|مانده|موجودی|مبلغ|پیگیری|بانک/
const OTP = /رمز\s*(?:یک\s*بار|یکبار|پویا|دوم)|کد\s*(?:تایید|تأیید|فعال)|یک\s*بار\s*مصرف|گذرواژه|\botp\b|one[-\s]?time/i
const TX_VERB = /واریز|برداشت|خرید|انتقال|کارت\s*به\s*کارت|پرداخت/

const parsers: BankParser[] = []

export function registerBankParser(parser: BankParser) {
  const next = parsers.filter((item) => item.id !== parser.id)
  next.push(parser)
  next.sort((a, b) => b.priority - a.priority)
  parsers.splice(0, parsers.length, ...next)
}

export function listBankParsers(): Array<{ id: string; label: string }> {
  return parsers.map((parser) => ({ id: parser.id, label: parser.label }))
}

export type ParseOutcome =
  | { kind: 'parsed'; value: ParsedBankSms; normalized: string }
  | { kind: 'ignored'; reason: 'otp' | 'not-bank' | 'empty' }
  | { kind: 'error' }

export function parseBankSms(raw: string, receivedAt: number): ParseOutcome {
  const text = raw.trim()
  if (!text) return { kind: 'ignored', reason: 'empty' }
  try {
    const normalized = normalizeSmsText(text)
    const clearTransaction = TX_VERB.test(normalized) && /\d/.test(normalized) && /ریال|تومان|تومن/.test(normalized)
    if (OTP.test(normalized) && !clearTransaction) return { kind: 'ignored', reason: 'otp' }
    const parser = parsers.find((item) => item.matches(normalized))
    if (!parser) return { kind: 'ignored', reason: 'not-bank' }
    const parsed = parser.parse(normalized, receivedAt)
    if ('ignored' in parsed) return { kind: 'ignored', reason: parsed.ignored }
    return { kind: 'parsed', value: parsed, normalized }
  } catch {
    return { kind: 'error' }
  }
}

const genericBankParser: BankParser = {
  id: 'generic',
  label: 'الگوی عمومی پیامک بانکی',
  priority: 0,
  matches(text) {
    return BANK_HINT.test(text)
  },
  parse(text) {
    const secret = OTP.test(text)
    const hasVerb = TX_VERB.test(text)
    const amount = extractAmount(text)
    if (secret && !(hasVerb && amount.amountMinor != null && amount.currency)) {
      return { ignored: 'otp' }
    }
    const direction = directionOf(text)
    const when = extractWhen(text)
    const card = extractCard(text)
    const reference = extractReference(text)
    const balance = extractBalance(text)
    const bank = extractBankLabel(text)
    const amountRial = toRial(amount.amountMinor ?? 0, amount.currency)
    const resolvedRial = amount.amountMinor == null || amount.currency == null ? null : amountRial
    const needsReview = direction === 'UNKNOWN' || resolvedRial == null || secret
    let confidence = 20
    if (direction !== 'UNKNOWN') confidence += 25
    if (resolvedRial != null) confidence += 30
    if (reference) confidence += 10
    if (card) confidence += 5
    if (when.date) confidence += 5
    if (balance != null) confidence += 5
    if (needsReview) confidence = Math.min(confidence, 45)
    return {
      parserId: 'generic',
      parserVersion: PARSER_VERSION,
      bankId: bank.id,
      bankLabel: bank.label,
      direction,
      amountMinor: amount.amountMinor,
      currency: amount.currency,
      amountRial: resolvedRial,
      date: when.date,
      time: when.time,
      maskedCard: card,
      balanceAfterRial: balance,
      reference,
      confidence,
      needsReview,
      containsSecret: secret,
    }
  },
}

registerBankParser(genericBankParser)

function directionOf(text: string): SmsDirection {
  const transfer = /کارت\s*به\s*کارت|انتقال/.test(text)
  const expense = /برداشت|خرید|پرداخت|کارمزد/.test(text)
  const income = /واریز|دریافت/.test(text)
  if (transfer) return 'TRANSFER'
  if (expense && income) return 'UNKNOWN'
  if (expense) return 'EXPENSE'
  if (income) return 'INCOME'
  return 'UNKNOWN'
}

function extractAmount(text: string): { amountMinor: number | null; currency: SmsCurrency | null } {
  const balanceSpans = spans(text, /(?:مانده|موجودی)\s*[:：]?\s*\d{1,18}(?:\s*(?:ریال|تومان|تومن))?/g)
  const labeled = firstOutside(text, /مبلغ\s*[:：]?\s*(\d{1,18})(?:\s*(ریال|تومان|تومن))?/g, balanceSpans)
  const withUnit = labeled ?? firstOutside(text, /(?<![\d])(\d{1,18})\s*(ریال|تومان|تومن)/g, balanceSpans)
  const bare = withUnit ?? firstOutside(text, /(?:واریز|برداشت|خرید|انتقال|پرداخت)\s*[:：]?\s*(\d{1,18})(?!\s*(?:ریال|تومان|تومن))/g, balanceSpans)
  const match = withUnit ?? bare
  if (!match) return { amountMinor: null, currency: null }
  if (/\d[./\u066B]\d/.test(match.raw)) return { amountMinor: null, currency: null }
  const amountMinor = parseIntegerToken(match.digits)
  return { amountMinor, currency: currencyFromUnit(match.unit) }
}

function extractBalance(text: string): number | null {
  const match = /(?:مانده|موجودی)\s*[:：]?\s*(\d{1,18})(?:\s*(ریال|تومان|تومن))?/.exec(text)
  if (!match) return null
  const minor = parseIntegerToken(match[1] ?? '')
  if (minor == null) return null
  return toRial(minor, currencyFromUnit(match[2]))
}

function extractWhen(text: string): { date: string | null; time: string | null } {
  const timeMatch = /(?<!\d)(\d{1,2}):(\d{2})(?!\d)/.exec(text)
  const hour = Number(timeMatch?.[1])
  const minute = Number(timeMatch?.[2])
  const time = timeMatch && hour <= 23 && minute <= 59
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : null

  // Match 3-part dates: 1403/07/15 or 03/07/15 or 1403-07-15
  const dateMatch = /(?<!\d)(\d{2,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?!\d)/.exec(text)
  if (dateMatch) {
    let p1 = Number(dateMatch[1])
    let p2 = Number(dateMatch[2])
    let p3 = Number(dateMatch[3])

    let year: number
    let month: number
    let day: number

    // If format has 4-digit Jalali year at the end (e.g. 15/07/1403)
    if (p3 >= 1300 && p3 <= 1499 && p1 <= 31 && p2 <= 12) {
      day = p1
      month = p2
      year = p3
    } else {
      // Standard Persian banking order: year/month/day (e.g. 1403/07/15 or 03/07/15)
      year = p1
      month = p2
      day = p3
    }

    // Convert 2-digit Persian year (e.g. 03 -> 1403, 04 -> 1404, 99 -> 1399)
    if (year >= 0 && year <= 49) {
      year = 1400 + year
    } else if (year >= 50 && year <= 99) {
      year = 1300 + year
    }

    if (year >= 1300 && year <= 1499 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = jalaliToIso(year, month, day)
      if (iso && isValidIsoDate(iso)) return { date: iso, time }
    }

    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (isValidIsoDate(iso)) return { date: iso, time }
  }

  return { date: null, time }
}

function extractCard(text: string): string | null {
  const masked = /(?:\*{2,}|x{2,})(\d{4})(?!\d)/i.exec(text)
  if (masked) return `****${masked[1]}`
  const labeled = /کارت\s*[:：]?\s*(\d{4})(?!\d)/.exec(text)
  if (labeled) return `****${labeled[1]}`
  const pan = /(?<!\d)(\d{16})(?!\d)/.exec(text)
  if (pan) return `****${pan[1]!.slice(-4)}`
  return null
}

function extractReference(text: string): string | null {
  const match = /(?:شماره\s*)?(?:پیگیری|مرجع)\s*[:：]?\s*(\d{4,20})/.exec(text)
  return match?.[1] ?? null
}

const KNOWN_BANKS: Array<{ id: string; label: string; re: RegExp }> = [
  { id: 'blubank', label: 'بلوبانک (سامان)', re: /بلوبانک|بلو\s*[:：]|\bblubank\b/i },
  { id: 'resalat', label: 'بانک قرض‌الحسنه رسالت', re: /رسالت|قرض\s*الحسنه\s*رسالت/ },
  { id: 'mehr', label: 'بانک قرض‌الحسنه مهر ایران', re: /مهر\s*ایران/ },
  { id: 'melli', label: 'بانک ملی', re: /بانک[\s\u200c]*ملی|بام[\s\u200c]*ملی/ },
  { id: 'mellat', label: 'بانک ملت', re: /بانک[\s\u200c]*ملت/ },
  { id: 'tejarat', label: 'بانک تجارت', re: /بانک[\s\u200c]*تجارت/ },
  { id: 'saderat', label: 'بانک صادرات', re: /بانک[\s\u200c]*صادرات|صپاد/ },
  { id: 'sepah', label: 'بانک سپه', re: /بانک[\s\u200c]*سپه|انصار|قوامین|حکمت/ },
  { id: 'pasargad', label: 'بانک پاسارگاد', re: /پاسارگاد|ویپاد/ },
  { id: 'saman', label: 'بانک سامان', re: /بانک[\s\u200c]*سامان/ },
  { id: 'parsian', label: 'بانک پارسیان', re: /پارسیان/ },
  { id: 'ayandeh', label: 'بانک آینده', re: /بانک[\s\u200c]*آینده/ },
  { id: 'shahr', label: 'بانک شهر', re: /بانک[\s\u200c]*شهر/ },
  { id: 'maskan', label: 'بانک مسکن', re: /مسکن/ },
  { id: 'keshavarzi', label: 'بانک کشاورزی', re: /کشاورزی/ },
  { id: 'refah', label: 'بانک رفاه', re: /رفاه/ },
  { id: 'sina', label: 'بانک سینا', re: /بانک[\s\u200c]*سینا/ },
  { id: 'gardeshgari', label: 'بانک گردشگری', re: /گردشگری/ },
  { id: 'dey', label: 'بانک دی', re: /بانک[\s\u200c]*دی/ },
  { id: 'postbank', label: 'پست بانک', re: /پست[\s\u200c]*بانک/ },
  { id: 'karafarin', label: 'بانک کارآفرین', re: /کارآفرین/ },
]

function extractBankLabel(text: string): { id: string; label: string } {
  for (const item of KNOWN_BANKS) {
    if (item.re.test(text)) return { id: item.id, label: item.label }
  }
  const match = /بانک[\s\u200c]+(\S{2,24})/.exec(text)
  if (!match) return { id: 'unknown', label: 'بانک شناسایی‌نشده' }
  return { id: `name:${match[1]}`, label: `بانک ${match[1]}` }
}

function spans(text: string, re: RegExp): Array<{ start: number; end: number }> {
  return [...text.matchAll(re)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }))
}

function firstOutside(
  text: string,
  re: RegExp,
  blocked: Array<{ start: number; end: number }>,
): { digits: string; unit?: string; raw: string } | null {
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (blocked.some((span) => start < span.end && end > span.start)) continue
    const digitAt = match[0].search(/\d/)
    const prev = text[start + digitAt - 1]
    if (prev === '.' || prev === '/' || prev === '\u066B') continue
    return { digits: match[1] ?? '', unit: match[2], raw: match[0] }
  }
  return null
}
