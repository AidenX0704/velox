import { useEffect } from 'react'

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

export interface NoticeAction {
  label: string
  onClick: () => void
  primary?: boolean
}

export interface InlineNoticeProps {
  tone?: NoticeTone
  title: string
  description?: string
  actions?: NoticeAction[]
  /** Rule 10: feedback retracts itself instead of lingering. */
  autoDismissMs?: number
  onDismiss?: () => void
}

export function InlineNotice({
  tone = 'info',
  title,
  description,
  actions,
  autoDismissMs,
  onDismiss
}: InlineNoticeProps): React.JSX.Element {
  useEffect(() => {
    if (autoDismissMs === undefined || !onDismiss) {
      return
    }

    const timer = window.setTimeout(onDismiss, autoDismissMs)

    return () => window.clearTimeout(timer)
  }, [autoDismissMs, onDismiss, title])

  return (
    <div
      className="inline-notice"
      data-tone={tone}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
      aria-live={tone === 'danger' || tone === 'warning' ? 'assertive' : 'polite'}
    >
      <div className="inline-notice-body">
        <strong className="inline-notice-title">{title}</strong>
        {description ? <span className="inline-notice-desc">{description}</span> : null}
      </div>
      {actions && actions.length > 0 ? (
        <div className="inline-notice-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="inline-notice-action"
              data-primary={action.primary ? 'true' : undefined}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
