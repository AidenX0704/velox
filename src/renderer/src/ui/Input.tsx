import { forwardRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react'

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size' | 'prefix' | 'onChange'
> {
  size?: 'small' | 'default' | 'large'
  prefix?: ReactNode
  suffix?: ReactNode
  /** Semi-compatible: receives the value, not the event. */
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void
  onEnterPress?: (value: string) => void
}

/**
 * Rule 2: focus is expressed with a double ring (inner 1.5px accent + 3px halo)
 * instead of an outline, so the field looks like it "bites" into the surface.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'default', prefix, suffix, className, onChange, onEnterPress, onKeyDown, ...rest },
  ref
) {
  return (
    <span className={['ui-field', className].filter(Boolean).join(' ')} data-size={size}>
      {prefix ? (
        <span className="ui-field-affix" aria-hidden="true">
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        ref={ref}
        className="ui-input"
        onChange={(event) => onChange?.(event.target.value, event)}
        onKeyDown={(event) => {
          onKeyDown?.(event)

          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            onEnterPress?.((event.target as HTMLInputElement).value)
          }
        }}
      />
      {suffix ? <span className="ui-field-affix">{suffix}</span> : null}
    </span>
  )
})
