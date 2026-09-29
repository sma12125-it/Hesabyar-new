import { useLayoutEffect, useRef, type ChangeEvent, type CSSProperties } from 'react'
import {
  caretFromRialDigitCount,
  countRialDigits,
  formatRial,
  formatRialInput,
  parseRialInput,
} from '../lib/money'

export function AmountField({
  value,
  onChange,
  variant = 'field',
  placeholder = '۰',
  autoFocus,
  ariaLabel = 'مبلغ به ریال',
  hint = 'مبلغ',
  caret,
  over = false,
  className,
  style,
}: {
  value: number
  onChange: (amount: number) => void
  variant?: 'field' | 'hero'
  placeholder?: string
  autoFocus?: boolean
  ariaLabel?: string
  hint?: string
  caret?: 'expense' | 'income'
  over?: boolean
  className?: string
  style?: CSSProperties
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingDigitsBefore = useRef<number | null>(null)
  const display = formatRialInput(value)

  useLayoutEffect(() => {
    const el = inputRef.current
    const digits = pendingDigitsBefore.current
    if (!el || digits == null) return
    const pos = caretFromRialDigitCount(el.value, digits)
    el.setSelectionRange(pos, pos)
    pendingDigitsBefore.current = null
  }, [display])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const caretPos = e.target.selectionStart ?? raw.length
    const digitsBefore = countRialDigits(raw.slice(0, caretPos))
    const next = parseRialInput(raw)
    const masked = formatRialInput(next)
    pendingDigitsBefore.current = digitsBefore
    if (raw !== masked) {
      e.target.value = masked
      const pos = caretFromRialDigitCount(masked, digitsBefore)
      e.target.setSelectionRange(pos, pos)
    }
    if (next !== value) onChange(next)
  }

  const input = (
    <input
      ref={inputRef}
      className={variant === 'hero' ? 'amount-input' : 'field-input amount-field'}
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      value={display}
      placeholder={variant === 'field' ? placeholder : undefined}
      onChange={handleChange}
      aria-label={ariaLabel}
    />
  )

  if (variant === 'field') return input

  return (
    <div
      className={`amount-block${className ? ` ${className}` : ''}`}
      style={style}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="hint">{hint}</div>
      <div
        className={`big${value <= 0 ? ' placeholder-val' : ''}`}
        style={over ? { color: 'var(--hy-expense)' } : undefined}
      >
        {caret ? <span className={`amount-caret${caret === 'income' ? ' income' : ''}`} /> : null}
        {value > 0 ? formatRial(value) : '۰'}
        <span className="cur">ریال</span>
      </div>
      {input}
    </div>
  )
}
