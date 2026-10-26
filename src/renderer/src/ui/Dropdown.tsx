import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'

/** Lets menu items close the menu after activation (Semi's `clickToHide`). */
const DismissContext = createContext<(() => void) | null>(null)

type Trigger = 'click' | 'contextMenu' | 'hover' | 'custom'
type Position = 'bottomLeft' | 'bottomRight' | 'bottom' | 'top' | 'topLeft' | 'topRight'

interface Point {
  x: number
  y: number
}

export interface DropdownProps {
  render: () => ReactNode
  trigger?: Trigger
  position?: Position
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
  className?: string
  children: ReactNode
}

type UnknownProps = Record<string, unknown> & {
  onClick?: (event: React.MouseEvent) => void
  onContextMenu?: (event: React.MouseEvent) => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}

function compose<A extends unknown[]>(
  first: ((...args: A) => void) | undefined,
  second: ((...args: A) => void) | undefined
): ((...args: A) => void) | undefined {
  if (!first) return second
  if (!second) return first

  return (...args: A) => {
    first(...args)
    second(...args)
  }
}

export function Dropdown({
  render,
  trigger = 'click',
  position = 'bottomLeft',
  visible,
  onVisibleChange,
  children
}: DropdownProps): React.JSX.Element {
  const anchorRef = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [point, setPoint] = useState<Point | null>(null)
  const [placement, setPlacement] = useState<Point>({ x: 0, y: 0 })

  const isControlled = visible !== undefined
  const isOpen = isControlled ? visible : open

  const setOpenState = useCallback(
    (next: boolean) => {
      // Clear the context-menu origin while closing, so a later click-open can
      // never be placed at a stale pointer position.
      if (!next) {
        setPoint(null)
      }

      if (!isControlled) {
        setOpen(next)
      }

      onVisibleChange?.(next)
    },
    [isControlled, onVisibleChange]
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null

      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return
      }

      setOpenState(false)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenState(false)
      }
    }

    const handleReposition = (): void => setOpenState(false)

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('blur', handleReposition)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('blur', handleReposition)
    }
  }, [isOpen, setOpenState])

  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }

    const rect = anchorRef.current?.getBoundingClientRect()
    const menu = menuRef.current
    const menuWidth = menu?.offsetWidth ?? 0
    const menuHeight = menu?.offsetHeight ?? 0
    const gap = 6

    let x = point?.x ?? rect?.left ?? 0
    let y = point?.y ?? 0

    if (!point && rect) {
      if (position === 'bottomRight' || position === 'topRight') {
        x = rect.right - menuWidth
      } else if (position === 'bottom' || position === 'top') {
        x = rect.left + rect.width / 2 - menuWidth / 2
      }

      y = position.startsWith('top') ? rect.top - menuHeight - gap : rect.bottom + gap
    }

    const maxX = window.innerWidth - menuWidth - 8
    const maxY = window.innerHeight - menuHeight - 8

    setPlacement({
      x: Math.max(8, Math.min(x, Math.max(8, maxX))),
      y: Math.max(8, Math.min(y, Math.max(8, maxY)))
    })
  }, [isOpen, point, position])

  // The trigger keeps its own DOM node (no wrapper) so flex/block layout is
  // untouched: we only merge a ref and the events the dropdown needs.
  const triggerProps: UnknownProps = {
    ref: anchorRef as unknown as RefObject<HTMLElement>
  }

  if (trigger === 'click') {
    triggerProps.onClick = (event: React.MouseEvent) => {
      event.stopPropagation()
      setOpenState(!isOpen)
    }
  }

  if (trigger === 'contextMenu') {
    triggerProps.onContextMenu = (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setPoint({ x: event.clientX, y: event.clientY })
      setOpenState(true)
    }
  }

  if (trigger === 'hover') {
    triggerProps.onPointerEnter = () => setOpenState(true)
    triggerProps.onPointerLeave = () => setOpenState(false)
  }

  const node = isValidElement(children) ? (children as ReactElement<UnknownProps>) : null

  const anchor = node
    ? cloneElement(node, {
        ...triggerProps,
        ref: anchorRef,
        onClick: compose(node.props.onClick, triggerProps.onClick),
        onContextMenu: compose(node.props.onContextMenu, triggerProps.onContextMenu),
        onPointerEnter: compose(node.props.onPointerEnter, triggerProps.onPointerEnter),
        onPointerLeave: compose(node.props.onPointerLeave, triggerProps.onPointerLeave)
      } as UnknownProps)
    : null

  return (
    <>
      {anchor ?? (
        <span
          ref={anchorRef as unknown as RefObject<HTMLSpanElement>}
          className="ui-dropdown-fallback"
        >
          {children}
        </span>
      )}
      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              className="ui-dropdown-menu"
              style={{ left: placement.x, top: placement.y }}
              role="menu"
            >
              <DismissContext.Provider value={() => setOpenState(false)}>
                {render()}
              </DismissContext.Provider>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

function Menu({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="ui-dropdown-menu-inner">{children}</div>
}

interface ItemProps {
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  icon?: ReactNode
  disabled?: boolean
  active?: boolean
  type?: 'danger' | 'warning' | 'primary'
  className?: string
  children?: ReactNode
}

function Item({
  onClick,
  icon,
  disabled,
  active,
  type,
  className,
  children
}: ItemProps): React.JSX.Element {
  const dismiss = useContext(DismissContext)

  return (
    <button
      type="button"
      role="menuitem"
      className={['ui-dropdown-item', className].filter(Boolean).join(' ')}
      data-active={active ? 'true' : undefined}
      data-type={type}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event)
        // Semi closes the menu on item activation; mirrors `clickToHide`.
        dismiss?.()
      }}
    >
      {icon ? (
        <span className="ui-dropdown-item-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="ui-dropdown-item-label">{children}</span>
    </button>
  )
}

function Divider(): React.JSX.Element {
  return <div className="ui-dropdown-divider" role="separator" />
}

Dropdown.Menu = Menu
Dropdown.Item = Item
Dropdown.Divider = Divider
