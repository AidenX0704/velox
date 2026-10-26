import { forwardRef, type ChangeEvent, type TextareaHTMLAttributes } from 'react'

export interface TextAreaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange'
> {
  size?: 'small' | 'default' | 'large'
  /** Semi-compatible: receives the value, not the event. */
  onChange?: (value: string, event: ChangeEvent<HTMLTextAreaElement>) => void
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { size = 'default', className, onChange, ...rest },
  ref
) {
  return (
    <span
      className={['ui-field', 'ui-field--area', className].filter(Boolean).join(' ')}
      data-size={size}
    >
      <textarea
        {...rest}
        ref={ref}
        className="ui-textarea"
        onChange={(event) => onChange?.(event.target.value, event)}
      />
    </span>
  )
})
