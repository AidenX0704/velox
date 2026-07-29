import { useEffect, useState } from 'react'
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
  const [diagram, setDiagram] = useState<MermaidDiagramState>({
    renderKey: '',
    status: 'loading'
  })
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

  return (
    <figure
      className="markdown-diagram markdown-diagram-embedded"
      data-diagram-state={visibleDiagram.status}
    >
      <div className="markdown-diagram-viewport">
        {visibleDiagram.status === 'ready' && visibleDiagram.svg ? (
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
