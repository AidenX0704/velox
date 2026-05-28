import { cloneElement, createElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { CodeBlock } from '../preview/CodeBlock'

export interface MarkdownFrontmatterEntry {
  key: string
  value: string | string[]
}

const githubAlertLabels: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution'
}

const githubAlertPattern = /\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

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

export function MarkdownBlockquote(props: React.ComponentProps<'blockquote'>): ReactElement {
  const text = extractText(props.children).trimStart()
  const match = githubAlertPattern.exec(text)

  if (!match || match.index !== 0) {
    return <blockquote {...props} />
  }

  const alertType = match[1].toLowerCase()
  const content = removeFirstAlertMarker(props.children)

  return (
    <aside className={`markdown-alert markdown-alert-${alertType}`} role="note">
      <div className="markdown-alert-title">{githubAlertLabels[alertType]}</div>
      <div className="markdown-alert-content">{content}</div>
    </aside>
  )
}

export function MarkdownFrontmatter({
  entries
}: {
  entries: MarkdownFrontmatterEntry[]
}): ReactElement | null {
  if (entries.length === 0) {
    return null
  }

  const entryMap = new Map(entries.map((entry) => [entry.key, entry.value]))
  const name = getScalarFrontmatterValue(entryMap.get('name'))
  const description = getScalarFrontmatterValue(entryMap.get('description'))
  const restEntries = entries.filter((entry) => !['name', 'description'].includes(entry.key))

  return (
    <section className="markdown-frontmatter" aria-label="文档元信息">
      <header className="markdown-frontmatter-header">
        <span className="markdown-frontmatter-kicker">Skill Metadata</span>
        {name ? <h1 className="markdown-frontmatter-title">{name}</h1> : null}
        {description ? <p className="markdown-frontmatter-description">{description}</p> : null}
      </header>
      {restEntries.length > 0 ? (
        <dl className="markdown-frontmatter-grid">
          {restEntries.map((entry) => (
            <div key={entry.key} className="markdown-frontmatter-row">
              <dt>{formatFrontmatterKey(entry.key)}</dt>
              <dd>{renderFrontmatterValue(entry.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

function removeFirstAlertMarker(node: ReactNode): ReactNode {
  let removed = false

  const visit = (candidate: ReactNode): ReactNode => {
    if (removed) {
      return candidate
    }

    if (typeof candidate === 'string') {
      const next = candidate.replace(githubAlertPattern, '')
      removed = next !== candidate
      return next
    }

    if (Array.isArray(candidate)) {
      return compactReactNodes(candidate.map(visit))
    }

    if (isValidElement<{ children?: ReactNode }>(candidate)) {
      const children = visit(candidate.props.children)

      if (candidate.type === 'p' && isEmptyReactNode(children)) {
        return null
      }

      return cloneElement(candidate, undefined, children)
    }

    return candidate
  }

  return visit(node)
}

function compactReactNodes(nodes: ReactNode[]): ReactNode[] {
  return nodes.filter((node) => !isEmptyReactNode(node))
}

function isEmptyReactNode(node: ReactNode): boolean {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return true
  }

  if (typeof node === 'string') {
    return node.trim() === ''
  }

  if (Array.isArray(node)) {
    return node.every(isEmptyReactNode)
  }

  return false
}

function getScalarFrontmatterValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(', ') : (value ?? '')
}

function renderFrontmatterValue(value: string | string[]): ReactNode {
  if (!Array.isArray(value)) {
    return value
  }

  return (
    <span className="markdown-frontmatter-list">
      {value.map((item) => (
        <code key={item}>{item}</code>
      ))}
    </span>
  )
}

function formatFrontmatterKey(key: string): string {
  return key
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
