import type { CSSProperties, ElementType, ReactNode } from 'react'

type TextType =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'quaternary'
  | 'warning'
  | 'danger'
  | 'success'
type TextSize = 'small' | 'normal' | 'large'

interface CommonProps {
  type?: TextType
  size?: TextSize
  weight?: 'regular' | 'medium' | 'semibold' | 'bold'
  strong?: boolean
  ellipsis?: boolean | { showTooltip?: boolean; rows?: number }
  className?: string
  style?: CSSProperties
  children?: ReactNode
  as?: ElementType
  id?: string
  title?: string
}

function classNames(base: string, props: CommonProps): string {
  return [base, props.className, props.ellipsis ? 'ui-text-ellipsis' : undefined]
    .filter(Boolean)
    .join(' ')
}

function Text({ as: Tag = 'span', ...props }: CommonProps): React.JSX.Element {
  return (
    <Tag
      className={classNames('ui-text', props)}
      data-type={props.type ?? 'primary'}
      data-size={props.size ?? 'normal'}
      data-weight={props.weight ?? (props.strong ? 'semibold' : undefined)}
      style={props.style}
      id={props.id}
      title={
        props.title ??
        (typeof props.ellipsis === 'object' && props.children ? String(props.children) : undefined)
      }
    >
      {props.children}
    </Tag>
  )
}

function Title({ as, ...props }: CommonProps): React.JSX.Element {
  return <Text {...props} as={as ?? 'h2'} weight={props.weight ?? 'semibold'} />
}

function Paragraph({ as, ...props }: CommonProps): React.JSX.Element {
  return <Text {...props} as={as ?? 'p'} />
}

export const Typography = { Text, Title, Paragraph }
