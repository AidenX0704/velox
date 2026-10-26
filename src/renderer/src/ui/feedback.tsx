import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/* ── toast ─────────────────────────────────────────────────────────────── */

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

let toastItems: ToastItem[] = []
const toastListeners = new Set<() => void>()
let toastCounter = 0

function emitToast(): void {
  toastListeners.forEach((listener) => listener())
}

function pushToast(kind: ToastKind, text: string): void {
  const id = (toastCounter += 1)
  toastItems = [...toastItems, { id, kind, text }]
  emitToast()

  window.setTimeout(() => {
    toastItems = toastItems.filter((item) => item.id !== id)
    emitToast()
  }, 3200)
}

export const Toast = {
  success: (text: string): void => pushToast('success', text),
  error: (text: string): void => pushToast('error', text),
  info: (text: string): void => pushToast('info', text),
  warning: (text: string): void => pushToast('warning', text)
}

export function Toaster(): React.JSX.Element {
  const items = useSyncExternalStore(
    (listener) => {
      toastListeners.add(listener)
      return () => toastListeners.delete(listener)
    },
    () => toastItems
  )

  return createPortal(
    <div className="ui-toaster" role="region" aria-label="通知">
      {items.map((item) => (
        <div key={item.id} className="ui-toast" data-kind={item.kind} role="status">
          {item.text}
        </div>
      ))}
    </div>,
    document.body
  )
}

/* ── imperative confirm ──────────────────────────────────────────────────── */

interface ConfirmOptions {
  title?: ReactNode
  content?: ReactNode
  okText?: string
  cancelText?: string
  onOk?: () => void
  onCancel?: () => void
}

interface ConfirmState extends ConfirmOptions {
  id: number
}

let confirmState: ConfirmState | null = null
const confirmListeners = new Set<() => void>()
let confirmCounter = 0

function emitConfirm(): void {
  confirmListeners.forEach((listener) => listener())
}

function closeConfirm(): void {
  confirmState = null
  emitConfirm()
}

export interface ModalProps {
  visible?: boolean
  title?: ReactNode
  footer?: ReactNode | null
  okText?: string
  cancelText?: string
  width?: number | string
  className?: string
  closable?: boolean
  onOk?: () => void
  onCancel?: () => void
  children?: ReactNode
}

/** Declarative dialog used for export/update flows. */
function ModalDialog({
  visible = false,
  title,
  footer,
  okText = '确定',
  cancelText = '取消',
  width = 480,
  className,
  closable = true,
  onOk,
  onCancel,
  children
}: ModalProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!visible) {
      return
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => {
      const autofocus = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')

      if (autofocus) {
        autofocus.focus()
      } else {
        dialogRef.current?.focus()
      }
    }, 0)

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [onCancel, visible])

  if (!visible) {
    return null
  }

  return createPortal(
    <div className="ui-modal-layer" role="presentation">
      <div className="ui-modal-scrim" onClick={closable ? onCancel : undefined} />
      <div
        className={['ui-modal', className].filter(Boolean).join(' ')}
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        tabIndex={-1}
      >
        {title ? <h2 className="ui-modal-title">{title}</h2> : null}
        <div className="ui-modal-body">{children}</div>
        {footer === null ? null : (
          <div className="ui-modal-footer">
            {footer ?? (
              <>
                <button type="button" className="ui-button" data-theme="light" onClick={onCancel}>
                  {cancelText}
                </button>
                <button
                  type="button"
                  className="ui-button"
                  data-theme="solid"
                  data-type="primary"
                  data-autofocus
                  onClick={onOk}
                >
                  {okText}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

/** Mounted once; renders the confirm dialog requested through Modal.confirm. */
export function ModalHost(): React.JSX.Element | null {
  const state = useSyncExternalStore(
    (listener) => {
      confirmListeners.add(listener)
      return () => confirmListeners.delete(listener)
    },
    () => confirmState
  )

  const handleOk = useCallback(() => {
    const handler = state?.onOk
    closeConfirm()
    handler?.()
  }, [state])

  const handleCancel = useCallback(() => {
    const handler = state?.onCancel
    closeConfirm()
    handler?.()
  }, [state])

  if (!state) {
    return null
  }

  return createPortal(
    <div className="ui-modal-layer" role="presentation">
      <div className="ui-modal-scrim" onClick={handleCancel} />
      <div className="ui-modal ui-modal--confirm" role="dialog" aria-modal="true">
        {state.title ? <h2 className="ui-modal-title">{state.title}</h2> : null}
        <div className="ui-modal-body">{state.content}</div>
        <div className="ui-modal-footer">
          <button type="button" className="ui-button" data-theme="light" onClick={handleCancel}>
            {state.cancelText ?? '取消'}
          </button>
          <button
            type="button"
            className="ui-button"
            data-theme="solid"
            data-type="primary"
            data-autofocus
            onClick={handleOk}
          >
            {state.okText ?? '确定'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export const Modal = Object.assign(ModalDialog, {
  confirm: (options: ConfirmOptions): void => {
    confirmState = { ...options, id: (confirmCounter += 1) }
    emitConfirm()
  }
})
