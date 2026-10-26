import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOptionProps {
  value: string
  children?: ReactNode
}

function Option({ children }: SelectOptionProps): React.JSX.Element {
  return <>{children}</>
}

export interface SelectProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  size?: 'small' | 'default' | 'large'
  children?: ReactNode
}

interface ParsedOption {
  value: string
  label: ReactNode
}

function parseOptions(children: ReactNode): ParsedOption[] {
  const options: ParsedOption[] = []

  const visit = (node: ReactNode): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }

    if (!node || typeof node !== 'object' || !('props' in node)) {
      return
    }

    const element = node as { type?: unknown; props?: Record<string, unknown> }

    if (element.type === Option && element.props) {
      options.push({
        value: String(element.props.value ?? ''),
        label: element.props.children as ReactNode
      })
      return
    }

    // Fragments / conditionals wrap the real Option nodes.
    if (element.props?.children) {
      visit(element.props.children as ReactNode)
    }
  }

  visit(children)

  return options
}

function SelectShell({
  value,
  onChange,
  placeholder = '请选择',
  disabled,
  className,
  size = 'default',
  children
}: SelectProps): React.JSX.Element {
  const options = useMemo(() => parseOptions(children), [children])
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState({ x: 0, y: 0, width: 0 })
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const selected = options.find((option) => option.value === value)

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const rect = anchorRef.current?.getBoundingClientRect()

    if (!rect) {
      return
    }

    setPlacement({
      x: rect.left,
      y: rect.bottom + 6,
      width: rect.width
    })
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null

      if (listRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return
      }

      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={['ui-select', className].filter(Boolean).join(' ')}
        data-size={size}
        data-open={open ? 'true' : undefined}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ui-select-value" data-placeholder={!selected ? 'true' : undefined}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="ui-select-chevron" aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <div
              ref={listRef}
              className="ui-select-menu"
              role="listbox"
              style={{ left: placement.x, top: placement.y, minWidth: placement.width }}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className="ui-select-item"
                  data-active={option.value === value ? 'true' : undefined}
                  onClick={() => {
                    onChange?.(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  )
}

export const Select = Object.assign(SelectShell, { Option })
