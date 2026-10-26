export interface ProgressProps {
  percent?: number
  showInfo?: boolean
  size?: 'small' | 'default' | 'large'
  className?: string
}

/** Rule 6: the percentage uses tabular figures so it never jitters. */
export function Progress({
  percent = 0,
  showInfo = false,
  size = 'default',
  className
}: ProgressProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))

  return (
    <div className={['ui-progress', className].filter(Boolean).join(' ')} data-size={size}>
      <div
        className="ui-progress-track"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="ui-progress-fill" style={{ width: `${clamped}%` }} />
      </div>
      {showInfo ? <span className="ui-progress-info tnum">{clamped}%</span> : null}
    </div>
  )
}
