import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'

type Position = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  content?: ReactNode
  position?: Position
  children: ReactNode
  className?: string
}

type TriggerProps = Record<string, unknown> & {
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onFocus?: () => void
  onBlur?: () => void
  ref?: unknown
}

/** Hover/focus tooltip placed next to its trigger, no wrapper element. */
export function Tooltip({
  content,
  position = 'top',
  children,
  className
}: TooltipProps): React.JSX.Element {
  const anchorRef = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })

  const update = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect()

    if (!rect) {
      return
    }

    const gap = 8
    const map: Record<Position, { x: number; y: number }> = {
      top: { x: rect.left + rect.width / 2, y: rect.top - gap },
      bottom: { x: rect.left + rect.width / 2, y: rect.bottom + gap },
      left: { x: rect.left - gap, y: rect.top + rect.height / 2 },
      right: { x: rect.right + gap, y: rect.top + rect.height / 2 }
    }

    setCoords(map[position])
  }, [position])

  useEffect(() => {
    if (!open) {
      return
    }

    const close = (): void => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('blur', close)

    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('blur', close)
    }
  }, [open])

  const node = isValidElement(children) ? (children as ReactElement<TriggerProps>) : null

  const trigger = node ? (
    cloneElement(node, {
      ref: anchorRef,
      onMouseEnter: () => {
        update()
        setOpen(true)
      },
      onMouseLeave: () => setOpen(false),
      onFocus: () => {
        update()
        setOpen(true)
      },
      onBlur: () => setOpen(false)
    } as TriggerProps)
  ) : (
    <span
      ref={anchorRef as never}
      onMouseEnter={() => {
        update()
        setOpen(true)
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
    </span>
  )

  return (
    <>
      {trigger}
      {open && content
        ? createPortal(
            <div
              className={['ui-tooltip', className].filter(Boolean).join(' ')}
              data-position={position}
              style={{ left: coords.x, top: coords.y }}
              role="tooltip"
            >
              {content}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
