import { useEffect, useMemo, useRef, useState } from 'react'
import { renderMarkdownReact } from '../markdown/renderMarkdownReact'
import {
  isLocalDocumentHref,
  openEditorLink,
  previewDocumentLink,
  scrollToEditorAnchor
} from '../services/linkNavigation'
import type { EditorLinkNavigationOptions } from '../services/linkNavigation'
import type { DocumentLinkPreview } from '../../../../../shared/types'

interface MarkdownPreviewProps {
  content: string
  currentPath?: string
  workspaceRoot?: string | null
  showCodeBlockLineNumbers?: boolean
  anchorTarget?: string | null
  linkNavigation?: EditorLinkNavigationOptions
  customCss?: string
}

interface LinkPreviewCardState {
  href: string
  x: number
  y: number
  loading: boolean
  data?: DocumentLinkPreview
}

export function MarkdownPreview({
  content,
  currentPath,
  workspaceRoot,
  showCodeBlockLineNumbers = false,
  anchorTarget,
  linkNavigation,
  customCss
}: MarkdownPreviewProps): React.JSX.Element {
  const rootRef = useRef<HTMLElement | null>(null)
  const previewRequestRef = useRef(0)
  const renderedContent = useMemo(
    () =>
      renderMarkdownReact(content, {
        currentPath,
        workspaceRoot,
        showCodeBlockLineNumbers
      }),
    [content, currentPath, showCodeBlockLineNumbers, workspaceRoot]
  )
  const [linkPreview, setLinkPreview] = useState<LinkPreviewCardState | null>(null)

  useEffect(() => {
    if (!anchorTarget || !rootRef.current) {
      return
    }

    window.requestAnimationFrame(() => {
      if (rootRef.current) {
        scrollToEditorAnchor(anchorTarget, rootRef.current)
      }
    })
  }, [anchorTarget, content])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null

      if (target?.closest('.document-link-preview-card')) {
        return
      }

      setLinkPreview(null)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setLinkPreview(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const openPreviewedDocument = async (): Promise<void> => {
    if (!linkPreview?.data || !linkNavigation?.onOpenDocument) {
      return
    }

    const opened = await linkNavigation.onOpenDocument(
      linkPreview.data.path,
      linkPreview.data.anchor
    )

    if (opened !== false) {
      setLinkPreview(null)
    }
  }

  return (
    <article
      ref={rootRef}
      className="markdown markdown-preview"
      onClick={(event) => {
        if ((event.target as HTMLElement | null)?.closest('.document-link-preview-card')) {
          return
        }

        const target = event.target instanceof HTMLElement ? event.target : null
        const link = target?.closest<HTMLAnchorElement>('a[href]')

        if (!link || !rootRef.current) {
          return
        }

        const href = link.getAttribute('href') ?? ''
        event.preventDefault()

        if (href.startsWith('#') || !isLocalDocumentHref(href)) {
          openEditorLink(href, rootRef.current, linkNavigation)
          return
        }

        const requestId = previewRequestRef.current + 1
        previewRequestRef.current = requestId
        const position = getCardPosition(event.clientX, event.clientY)

        setLinkPreview({
          href,
          x: position.x,
          y: position.y,
          loading: true
        })

        void previewDocumentLink(href, linkNavigation).then((preview) => {
          if (previewRequestRef.current !== requestId) {
            return
          }

          if (!preview) {
            setLinkPreview(null)
            return
          }

          setLinkPreview({
            href,
            x: position.x,
            y: position.y,
            loading: false,
            data: preview
          })
        })
      }}
      onDoubleClick={(event) => {
        const target = event.target instanceof HTMLElement ? event.target : null
        const link = target?.closest<HTMLAnchorElement>('a[href]')
        const href = link?.getAttribute('href') ?? ''

        if (!link || href.startsWith('#') || !isLocalDocumentHref(href) || !rootRef.current) {
          return
        }

        event.preventDefault()
        setLinkPreview(null)
        openEditorLink(href, rootRef.current, linkNavigation)
      }}
    >
      {customCss ? <style>{customCss}</style> : null}
      {renderedContent}
      {linkPreview ? (
        <aside
          className="document-link-preview-card"
          style={{ left: linkPreview.x, top: linkPreview.y }}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={() => void openPreviewedDocument()}
        >
          {linkPreview.loading ? (
            <div className="document-link-preview-loading">正在加载预览...</div>
          ) : linkPreview.data ? (
            <>
              <header className="document-link-preview-header">
                <div className="document-link-preview-title" title={linkPreview.data.path}>
                  {linkPreview.data.title}
                </div>
                <button
                  className="document-link-preview-close"
                  type="button"
                  aria-label="关闭预览"
                  onClick={() => setLinkPreview(null)}
                >
                  x
                </button>
              </header>
              <div className="document-link-preview-path" title={linkPreview.data.path}>
                {linkPreview.data.path}
                {linkPreview.data.anchor ? `#${linkPreview.data.anchor}` : ''}
              </div>
              <pre className="document-link-preview-excerpt">{linkPreview.data.excerpt}</pre>
              <footer className="document-link-preview-footer">
                <span>
                  {linkPreview.data.lineCount} 行{linkPreview.data.truncated ? ' · 已截断' : ''}
                </span>
                <button
                  className="document-link-preview-open"
                  type="button"
                  onClick={() => void openPreviewedDocument()}
                >
                  打开文档
                </button>
              </footer>
            </>
          ) : null}
        </aside>
      ) : null}
    </article>
  )
}

function getCardPosition(clientX: number, clientY: number): { x: number; y: number } {
  const cardWidth = 360
  const cardHeight = 320
  const margin = 12
  const x = Math.min(clientX + 12, window.innerWidth - cardWidth - margin)
  const y = Math.min(clientY + 12, window.innerHeight - cardHeight - margin)

  return {
    x: Math.max(margin, x),
    y: Math.max(margin, y)
  }
}
