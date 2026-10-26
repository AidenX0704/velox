import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export interface InputNumberProps {
  value?: number
  min?: number
  max?: number
  step?: number
  precision?: number
  disabled?: boolean
  className?: string
  suffix?: ReactNode
  onChange?: (value: number) => void
}

/**
 * Keeps a text buffer while the field is focused so typing "1." or "1.35" is not
 * normalised away mid-keystroke; the numeric value is only committed when the
 * text parses as a complete number (and clamped on blur).
 */
export function InputNumber({
  value,
  min,
  max,
  step = 1,
  precision,
  disabled,
  className,
  suffix,
  onChange
}: InputNumberProps): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    // External changes (settings reload, presets) reset the buffer.
    if (document.activeElement !== inputRef.current) {
      setDraft(null)
    }
  }, [value])

  const clamp = useCallback(
    (next: number): number => {
      let bounded = next

      if (typeof min === 'number') {
        bounded = Math.max(min, bounded)
      }

      if (typeof max === 'number') {
        bounded = Math.min(max, bounded)
      }

      return typeof precision === 'number' ? Number(bounded.toFixed(precision)) : bounded
    },
    [max, min, precision]
  )

  const commit = useCallback(
    (raw: string) => {
      const parsed = Number(raw)

      if (raw.trim() === '' || Number.isNaN(parsed)) {
        return
      }

      // Ignore half-typed decimals such as "1." or "-".
      if (/[.,]$/.test(raw)) {
        return
      }

      onChange?.(clamp(parsed))
    },
    [clamp, onChange]
  )

  return (
    <span className={['ui-field', 'ui-field--number', className].filter(Boolean).join(' ')}>
      <input
        ref={inputRef}
        className="ui-input"
        type="number"
        inputMode="decimal"
        value={draft ?? value ?? ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value)
          commit(event.target.value)
        }}
        onBlur={(event) => {
          const parsed = Number(event.target.value)

          if (!Number.isNaN(parsed) && event.target.value.trim() !== '') {
            onChange?.(clamp(parsed))
          }

          setDraft(null)
        }}
      />
      {suffix ? <span className="ui-field-affix">{suffix}</span> : null}
    </span>
  )
}
