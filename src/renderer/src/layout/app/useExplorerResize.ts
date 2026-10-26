import { useCallback, useState } from 'react'
import { DEFAULT_EXPLORER_WIDTH, clampExplorerWidth } from './format'

interface ExplorerResize {
  width: number
  handleResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void
  handleResizeKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
}

const KEYBOARD_STEP = 10

/**
 * Pointer drag for the sidebar. The width is written straight to the DOM during
 * the drag (one rAF-throttled write, no React render per move) and committed to
 * state only on release — anything else makes a resize feel laggy.
 */
export function useExplorerResize(): ExplorerResize {
  const [width, setWidth] = useState(DEFAULT_EXPLORER_WIDTH)

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      event.preventDefault()

      const startX = event.clientX
      const startWidth = width
      const explorerElement = event.currentTarget.parentElement
      const root = window.document.documentElement
      const previousCursor = root.style.cursor
      const previousUserSelect = root.style.userSelect
      let nextWidth = startWidth
      let resizeFrame = 0

      root.style.cursor = 'col-resize'
      root.style.userSelect = 'none'

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        nextWidth = clampExplorerWidth(startWidth + moveEvent.clientX - startX)

        if (resizeFrame !== 0) {
          return
        }

        resizeFrame = window.requestAnimationFrame(() => {
          resizeFrame = 0

          if (!explorerElement) {
            return
          }

          explorerElement.style.width = `${nextWidth}px`
          explorerElement.style.flexBasis = `${nextWidth}px`
        })
      }

      const stopResizing = (): void => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', stopResizing)
        window.removeEventListener('pointercancel', stopResizing)

        if (resizeFrame !== 0) {
          window.cancelAnimationFrame(resizeFrame)
        }

        root.style.cursor = previousCursor
        root.style.userSelect = previousUserSelect
        setWidth(nextWidth)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', stopResizing)
      window.addEventListener('pointercancel', stopResizing)
    },
    [width]
  )

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
    const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0

    if (direction === 0) {
      return
    }

    event.preventDefault()
    setWidth((current) => clampExplorerWidth(current + direction * KEYBOARD_STEP))
  }, [])

  return { width, handleResizeStart, handleResizeKeyDown }
}
