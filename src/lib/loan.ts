/**
 * Equal-installment declining-balance amortization (قسط مساوی / مانده‌نزولی).
 *
 * This is the classic bank annuity used by most Iranian loans with a fixed
 * monthly payment, not "سود ساده" (simple interest = P × r × years).
 *
 * Let
 *   P = principal (integer Rials)
 *   r = annual nominal rate as a percent (e.g. 18 means 18%)
 *   n = term in months
 *   i = r / 100 / 12   (monthly rate)
 *
 * Monthly payment (unrounded):
 *   A = P × i × (1+i)^n / ((1+i)^n − 1)     if i > 0
 *   A = P / n                                if i = 0
 *
 * Integer Rial schedule:
 *   A_rounded = round(A)
 *   For k = 1 .. n−1:
 *     interest_k  = round(remaining × i)
 *     principal_k = clamp(A_rounded − interest_k, 0, remaining)
 *     amount_k    = principal_k + interest_k
 *     remaining  −= principal_k
 *   Last payment:
 *     interest_n = round(remaining × i)
 *     amount_n   = remaining + interest_n
 *     (the last installment may differ from A_rounded so that
 *      Σ principal = P and Σ amount = P + Σ interest, with no leftover.)
 *
 * Zero-rate loans split P as evenly as possible; leftover Rials go on the last item.
 */

export interface LoanSchedule {
  principal: number
  annualRatePercent: number
  months: number
  /** Typical (rounded) monthly payment; last item may differ. */
  monthlyPayment: number
  totalInterest: number
  totalRepayment: number
  amounts: number[]
}

export const MAX_ANNUAL_RATE_PERCENT = 100

export function buildLoanSchedule(
  principal: number,
  annualRatePercent: number,
  months: number,
): LoanSchedule {
  if (!Number.isInteger(principal) || principal <= 0) {
    throw new Error('مبلغ اصل وام نامعتبر است')
  }
  if (!Number.isInteger(months) || months < 1) {
    throw new Error('تعداد اقساط باید حداقل ۱ باشد')
  }
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0 || annualRatePercent > MAX_ANNUAL_RATE_PERCENT) {
    throw new Error('نرخ سود نامعتبر است')
  }

  if (annualRatePercent === 0) {
    const base = Math.floor(principal / months)
    const leftover = principal - base * months
    const amounts = Array.from({ length: months }, (_, idx) => (idx === months - 1 ? base + leftover : base))
    return {
      principal,
      annualRatePercent,
      months,
      monthlyPayment: amounts[0] ?? 0,
      totalInterest: 0,
      totalRepayment: principal,
      amounts,
    }
  }

  const monthlyRate = annualRatePercent / 100 / 12
  const factor = (1 + monthlyRate) ** months
  const exact = (principal * monthlyRate * factor) / (factor - 1)
  const monthlyPayment = Math.round(exact)

  const amounts: number[] = []
  let remaining = principal
  let totalInterest = 0

  for (let k = 1; k <= months; k += 1) {
    const interest = Math.round(remaining * monthlyRate)
    if (k === months) {
      amounts.push(remaining + interest)
      totalInterest += interest
      remaining = 0
      break
    }
    let principalPart = monthlyPayment - interest
    if (principalPart < 0) principalPart = 0
    if (principalPart > remaining) principalPart = remaining
    amounts.push(principalPart + interest)
    remaining -= principalPart
    totalInterest += interest
  }

  const totalRepayment = amounts.reduce((sum, amount) => sum + amount, 0)
  return {
    principal,
    annualRatePercent,
    months,
    monthlyPayment,
    totalInterest,
    totalRepayment,
    amounts,
  }
}

export function tryLoanSchedule(
  principal: number,
  annualRatePercent: number,
  months: number,
): LoanSchedule | null {
  try {
    return buildLoanSchedule(principal, annualRatePercent, months)
  } catch {
    return null
  }
}
