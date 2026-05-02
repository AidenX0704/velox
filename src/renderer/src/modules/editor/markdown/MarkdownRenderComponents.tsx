import { createElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { CodeBlock } from '../preview/CodeBlock'
export function CodeBlockPre(props: { children?: ReactNode }): React.JSX.Element {
  const codeElement = Array.isArray(props.children) ? props.children[0] : props.children

  if (!isValidElement(codeElement) || codeElement.type !== 'code') {
    return createElement('pre', props)
  }

  const codeProps = codeElement.props as { className?: string; children?: ReactNode }
  const language = /language-([\w-]+)/.exec(codeProps.className ?? '')?.[1]
  const code = extractText(codeProps.children).replace(/\n$/, '')

  return <CodeBlock code={code} language={language} />
}

export function SafeLink(props: React.ComponentProps<'a'>): ReactElement {
  const href = String(props.href ?? '')
  const external = /^https?:\/\//i.test(href)

  return (
    <a
      {...props}
      href={href}
      target={external ? '_blank' : props.target}
      rel={external ? 'noreferrer' : props.rel}
    />
  )
}

export function MarkdownTable(props: React.ComponentProps<'table'>): ReactElement {
  return (
    <div className="markdown-table-scroller">
      <table {...props} />
    </div>
  )
}

export function MarkdownImage(props: React.ComponentProps<'img'>): ReactElement {
  return <img loading="lazy" decoding="async" {...props} />
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children)
  }

  return ''
}
