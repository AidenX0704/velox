import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tooltip } from '@douyinfe/semi-ui'
import {
  IconMinusCircleStroked,
  IconPlusCircleStroked,
  IconRealSizeStroked,
  IconShrink
} from '@douyinfe/semi-icons'

interface WorkspaceImagePreviewProps {
  source: string
  title: string
}

interface ImageDimensions {
  width: number
  height: number
}

const minZoom = 0.1
const maxZoom = 8
const zoomFactor = 1.25
const previewPadding = 64

function clampZoom(value: number): number {
  return Math.min(maxZoom, Math.max(minZoom, value))
}

export function WorkspaceImagePreview({
  source,
  title
}: WorkspaceImagePreviewProps): React.JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null)
  const [viewportSize, setViewportSize] = useState<ImageDimensions>({ width: 0, height: 0 })
  const [manualZoom, setManualZoom] = useState<number | null>(null)

  useEffect(() => {
    const viewport = viewportRef.current

    if (!viewport) {
      return
    }

    const updateViewportSize = (): void => {
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    }

    updateViewportSize()
    const observer = new ResizeObserver(updateViewportSize)
    observer.observe(viewport)

    return () => observer.disconnect()
  }, [])

  const fitZoom = useMemo(() => {
    if (!dimensions || viewportSize.width === 0 || viewportSize.height === 0) {
      return 1
    }

    return Math.min(
      1,
      Math.max(minZoom, (viewportSize.width - previewPadding) / dimensions.width),
      Math.max(minZoom, (viewportSize.height - previewPadding) / dimensions.height)
    )
  }, [dimensions, viewportSize])

  const zoom = manualZoom ?? fitZoom
  const renderedWidth = dimensions ? Math.max(1, Math.round(dimensions.width * zoom)) : undefined
  const renderedHeight = dimensions ? Math.max(1, Math.round(dimensions.height * zoom)) : undefined

  const changeZoom = useCallback(
    (direction: 1 | -1): void => {
      setManualZoom(clampZoom(zoom * (direction > 0 ? zoomFactor : 1 / zoomFactor)))
    },
    [zoom]
  )

  return (
    <div className="workspace-image-preview" aria-label={`${title} 图片预览`}>
      <div ref={viewportRef} className="workspace-image-preview-viewport">
        <div className="workspace-image-preview-content">
          <img
            src={source}
            alt={title}
            draggable={false}
            width={renderedWidth}
            height={renderedHeight}
            data-ready={dimensions ? 'true' : undefined}
            onLoad={(event) => {
              setDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight
              })
            }}
          />
        </div>
      </div>

      <div className="workspace-image-preview-toolbar" aria-label="图片缩放">
        {dimensions ? (
          <span className="workspace-image-preview-dimensions">
            {dimensions.width} x {dimensions.height}
          </span>
        ) : null}
        <Tooltip content="缩小" position="top">
          <button type="button" aria-label="缩小" onClick={() => changeZoom(-1)}>
            <IconMinusCircleStroked />
          </button>
        </Tooltip>
        <span className="workspace-image-preview-zoom">{Math.round(zoom * 100)}%</span>
        <Tooltip content="放大" position="top">
          <button type="button" aria-label="放大" onClick={() => changeZoom(1)}>
            <IconPlusCircleStroked />
          </button>
        </Tooltip>
        <Tooltip content="原始尺寸" position="top">
          <button type="button" aria-label="原始尺寸" onClick={() => setManualZoom(1)}>
            <IconRealSizeStroked />
          </button>
        </Tooltip>
        <Tooltip content="适应窗口" position="top">
          <button type="button" aria-label="适应窗口" onClick={() => setManualZoom(null)}>
            <IconShrink />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
