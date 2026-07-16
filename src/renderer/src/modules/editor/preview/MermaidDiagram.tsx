import { useEffect, useRef, useState } from 'react'
import { writeClipboardText } from '../services/clipboard'
import {
  getMermaidColorMode,
  getMermaidErrorMessage,
  renderMermaidDiagram,
  type MermaidColorMode
} from '../services/mermaidRenderer'

interface MermaidDiagramProps {
  definition: string
}

interface MermaidDiagramState {
  renderKey: string
  status: 'loading' | 'ready' | 'error'
  svg?: string
  diagramType?: string
  error?: string
}

export function MermaidDiagram({ definition }: MermaidDiagramProps): React.JSX.Element {
  const [colorMode, setColorMode] = useState<MermaidColorMode>(getMermaidColorMode)
  const [themeRevision, setThemeRevision] = useState(0)
  const [view, setView] = useState<'preview' | 'source'>('preview')
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [diagram, setDiagram] = useState<MermaidDiagramState>({
    renderKey: '',
    status: 'loading'
  })
  const copyResetTimerRef = useRef<number | undefined>(undefined)
  const renderKey = `${themeRevision}:${colorMode}:${definition}`
  const visibleDiagram: MermaidDiagramState =
    diagram.renderKey === renderKey ? diagram : { renderKey, status: 'loading' }

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setColorMode(getMermaidColorMode())
      setThemeRevision((current) => current + 1)
    })

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-color-mode', 'style']
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    void renderMermaidDiagram(definition, colorMode).then(
      (result) => {
        if (!cancelled) {
          setDiagram({ renderKey, status: 'ready', ...result })
        }
      },
      (error) => {
        if (!cancelled) {
          setDiagram({
            renderKey,
            status: 'error',
            error: getMermaidErrorMessage(error)
          })
        }
      }
    )

    return () => {
      cancelled = true
    }
  }, [colorMode, definition, renderKey])

  useEffect(() => {
    return () => window.clearTimeout(copyResetTimerRef.current)
  }, [])

  const copySource = async (): Promise<void> => {
    try {
      await writeClipboardText(definition)
      setCopyState('copied')
      window.clearTimeout(copyResetTimerRef.current)
      copyResetTimerRef.current = window.setTimeout(() => setCopyState('idle'), 1600)
    } catch {
      setCopyState('idle')
    }
  }

  return (
    <figure
      className="markdown-diagram"
      data-diagram-state={visibleDiagram.status}
      data-diagram-view={view}
    >
      <figcaption className="markdown-diagram-toolbar">
        <span className="markdown-diagram-title">
          <span className="markdown-diagram-mark" aria-hidden="true" />
          <span>图表</span>
          {visibleDiagram.diagramType ? (
            <span className="markdown-diagram-type">{visibleDiagram.diagramType}</span>
          ) : null}
        </span>
        <span className="markdown-diagram-actions">
          <button
            className="markdown-diagram-switch"
            type="button"
            onClick={() => setView((current) => (current === 'preview' ? 'source' : 'preview'))}
          >
            {view === 'preview' ? '查看源码' : '查看图表'}
          </button>
          <button
            className="markdown-diagram-copy"
            type="button"
            data-copy-state={copyState}
            onClick={() => void copySource()}
          >
            {copyState === 'copied' ? '已复制' : '复制源码'}
          </button>
        </span>
      </figcaption>
      <div className="markdown-diagram-viewport">
        {view === 'source' ? (
          <pre className="markdown-diagram-source">
            <code>{definition}</code>
          </pre>
        ) : visibleDiagram.status === 'ready' && visibleDiagram.svg ? (
          <div
            className="markdown-diagram-canvas"
            role="img"
            aria-label="Mermaid 图表"
            dangerouslySetInnerHTML={{ __html: visibleDiagram.svg }}
          />
        ) : visibleDiagram.status === 'error' ? (
          <div className="markdown-diagram-error">
            <strong>图表渲染失败</strong>
            <span>{visibleDiagram.error}</span>
            <button type="button" onClick={() => setView('source')}>
              查看并修改源码
            </button>
          </div>
        ) : (
          <div className="markdown-diagram-loading" role="status">
            <span aria-hidden="true" />
            正在渲染图表…
          </div>
        )}
      </div>
    </figure>
  )
}
