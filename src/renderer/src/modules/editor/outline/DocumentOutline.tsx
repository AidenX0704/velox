import { useState } from 'react'
import { IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons'
import type { HeadingAnchor } from '../rendering/headingAnchors'

interface DocumentOutlineProps {
  headings: HeadingAnchor[]
  dirty?: boolean
  activeHeadingIndex?: number | null
  onHeadingSelect: (heading: HeadingAnchor) => void
}

export function DocumentOutline({
  headings,
  dirty = false,
  activeHeadingIndex = null,
  onHeadingSelect
}: DocumentOutlineProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className="document-outline" data-collapsed={collapsed} aria-label="文档目录">
      <header className="document-outline-header">
        <span className="document-outline-title">目录</span>
        <span className="document-outline-count">{headings.length}</span>
        {dirty ? <span className="document-outline-dirty" aria-label="未保存" /> : null}
        <button
          className="document-outline-toggle"
          type="button"
          aria-label={collapsed ? '展开标题导航' : '收起标题导航'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? <IconChevronDown /> : <IconChevronUp />}
        </button>
      </header>
      {!collapsed ? (
        <nav className="document-outline-list" aria-label="标题列表">
          {headings.length > 0 ? (
            headings.map((heading) => (
              <button
                key={`${heading.slug}-${heading.index}`}
                className="document-outline-item"
                data-level={heading.level}
                data-active={activeHeadingIndex === heading.index}
                type="button"
                title={heading.text}
                onClick={() => onHeadingSelect(heading)}
              >
                <span className="document-outline-marker">H{heading.level}</span>
                <span className="document-outline-text">{heading.text}</span>
              </button>
            ))
          ) : (
            <span className="document-outline-empty">无标题</span>
          )}
        </nav>
      ) : null}
    </aside>
  )
}
