import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'

export type ButtonTheme = 'solid' | 'light' | 'borderless' | 'outline'
export type ButtonType = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'warning'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  theme?: ButtonTheme
  type?: ButtonType
  size?: 'small' | 'default' | 'large'
  icon?: ReactNode
  loading?: boolean
  block?: boolean
  style?: CSSProperties
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    theme = 'light',
    type = 'primary',
    size = 'default',
    icon,
    loading = false,
    block = false,
    disabled,
    className,
    children,
    ...rest
  },
  ref
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      className={['ui-button', className].filter(Boolean).join(' ')}
      data-theme={theme}
      data-type={type}
      data-size={size}
      data-block={block ? 'true' : undefined}
      data-icon-only={!children ? 'true' : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ui-button-spinner" aria-hidden="true" /> : icon}
      {children ? <span className="ui-button-label">{children}</span> : null}
    </button>
  )
})
