export interface SegmentOption<TValue extends string> {
  value: TValue
  label: string
  icon?: React.ReactNode
}

interface SegmentProps<TValue extends string> {
  value: TValue
  options: Array<SegmentOption<TValue>>
  ariaLabel: string
  className?: string
  size?: 'small' | 'medium'
  onChange: (value: TValue) => void
}

export function Segment<TValue extends string>({
  value,
  options,
  ariaLabel,
  className,
  size = 'medium',
  onChange
}: SegmentProps<TValue>): React.JSX.Element {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )
  const classNames = ['segment', className].filter(Boolean).join(' ')

  return (
    <div
      className={classNames}
      data-size={size}
      role="tablist"
      aria-label={ariaLabel}
      style={
        {
          '--segment-count': options.length,
          '--segment-active-index': activeIndex
        } as React.CSSProperties
      }
    >
      <span className="segment-thumb" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          className="segment-item"
          data-active={value === option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}
