import { useEffect, useMemo, useRef, useState } from 'react'
import './styles/editor.css'
import type { CursorPosition, EditorMode, MarkdownEditorPreferences } from './model/types'
import { MarkdownPreview } from './preview/MarkdownPreview'
import { RichMarkdownEditor } from './rich/RichMarkdownEditor'
import { DocumentOutline } from './outline/DocumentOutline'
import { collectHeadingAnchors, type HeadingAnchor } from './rendering/headingAnchors'
import type { EditorLinkNavigationOptions } from './services/linkNavigation'
import {
  SourceMarkdownEditor,
  type SourceMarkdownEditorHandle
} from './source/SourceMarkdownEditor'

interface MarkdownEditorProps {
  mode: EditorMode
  dirty: boolean
  content: string
  settings: MarkdownEditorPreferences
  currentPath?: string
  workspaceRoot?: string | null
  anchorTarget?: string | null
  onChange: (content: string) => void
  onCursorChange: (position: CursorPosition) => void
  onOpenDocumentLink?: (path: string, anchor?: string) => boolean | void | Promise<boolean | void>
  onLinkError?: (message: string) => void
}

const defaultSplitRatio = 50
const minSplitRatio = 24
const maxSplitRatio = 76
const scrollSyncTopOffset = 24
const scrollSyncReleaseDelay = 80

export function MarkdownEditor({
  mode,
  dirty,
  content,
  settings,
  currentPath,
  workspaceRoot,
  anchorTarget,
  onChange,
  onCursorChange,
  onOpenDocumentLink,
  onLinkError
}: MarkdownEditorProps): React.JSX.Element {
  const splitRef = useRef<HTMLDivElement | null>(null)
  const sourceEditorRef = useRef<SourceMarkdownEditorHandle | null>(null)
  const previewPaneRef = useRef<HTMLDivElement | null>(null)
  const scrollSyncSourceRef = useRef<'source' | 'preview' | null>(null)
  const [splitRatio, setSplitRatio] = useState(defaultSplitRatio)
  const [dragging, setDragging] = useState(false)
  const [sourceVisibleLine, setSourceVisibleLine] = useState(1)
  const headingAnchors = useMemo(() => collectHeadingAnchors(content), [content])
  const sourceActiveHeadingIndex = findHeadingIndexAtOrBeforeLine(headingAnchors, sourceVisibleLine)
  const linkNavigation = useMemo<EditorLinkNavigationOptions>(
    () => ({
      currentPath,
      workspaceRoot,
      onOpenDocument: onOpenDocumentLink,
      onError: onLinkError
    }),
    [currentPath, onLinkError, onOpenDocumentLink, workspaceRoot]
  )

  useEffect(() => {
    if (!dragging) {
      return
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const splitElement = splitRef.current

      if (!splitElement) {
        return
      }

      const rect = splitElement.getBoundingClientRect()
      const nextRatio = ((event.clientX - rect.left) / rect.width) * 100
      setSplitRatio(clampSplitRatio(nextRatio))
    }

    const handlePointerUp = (): void => {
      setDragging(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragging])

  useEffect(() => {
    if (!settings.splitScrollSync) {
      scrollSyncSourceRef.current = null
    }
  }, [settings.splitScrollSync])

  if (mode === 'source') {
    return (
      <div className="editor-with-outline" data-editor-view="source">
        <DocumentOutline
          headings={headingAnchors}
          dirty={dirty}
          activeHeadingIndex={sourceActiveHeadingIndex}
          onHeadingSelect={(heading) => sourceEditorRef.current?.scrollToLine(heading.line)}
        />
        <SourceMarkdownEditor
          ref={sourceEditorRef}
          value={content}
          wordWrap={settings.wordWrap}
          showLineNumbers={settings.showLineNumbers}
          fontSize={settings.editorFontSize}
          lineHeight={settings.editorLineHeight}
          onChange={onChange}
          onCursorChange={onCursorChange}
          onScrollRatioChange={() => {
            setSourceVisibleLine(sourceEditorRef.current?.getVisibleLine() ?? 1)
          }}
        />
      </div>
    )
  }

  if (mode === 'preview-edit') {
    return (
      <RichMarkdownEditor
        dirty={dirty}
        content={content}
        settings={settings}
        currentPath={currentPath}
        workspaceRoot={workspaceRoot}
        anchorTarget={anchorTarget}
        onOpenDocumentLink={onOpenDocumentLink}
        onLinkError={onLinkError}
        onChange={onChange}
        onCursorChange={onCursorChange}
      />
    )
  }

  return (
    <div className="editor-with-outline" data-editor-view="split">
      <div
        ref={splitRef}
        className="split-editor"
        style={
          {
            '--editor-source-pane-percent': `${splitRatio}%`,
            '--preview-max-width': `${settings.previewMaxWidth}px`,
            '--preview-font-size': `${settings.previewFontSize}px`,
            '--preview-line-height': String(settings.previewLineHeight)
          } as React.CSSProperties
        }
        data-preview-centered={settings.previewCentered}
        data-resizing={dragging}
      >
        <div className="split-pane source-pane">
          <SourceMarkdownEditor
            ref={sourceEditorRef}
            value={content}
            wordWrap={settings.wordWrap}
            showLineNumbers={settings.showLineNumbers}
            fontSize={settings.editorFontSize}
            lineHeight={settings.editorLineHeight}
            onChange={onChange}
            onCursorChange={onCursorChange}
            onScrollRatioChange={(ratio) => {
              setSourceVisibleLine(sourceEditorRef.current?.getVisibleLine() ?? 1)

              if (settings.splitScrollSync) {
                syncPreviewScroll({
                  previewElement: previewPaneRef.current,
                  sourceEditor: sourceEditorRef.current,
                  headingAnchors,
                  ratio,
                  sourceRef: scrollSyncSourceRef
                })
              }
            }}
          />
        </div>
        <div
          className="split-divider"
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={minSplitRatio}
          aria-valuemax={maxSplitRatio}
          aria-valuenow={Math.round(splitRatio)}
          tabIndex={0}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            setDragging(true)
          }}
          onDoubleClick={() => setSplitRatio(defaultSplitRatio)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              setSplitRatio((current) => clampSplitRatio(current - 2))
            }

            if (event.key === 'ArrowRight') {
              event.preventDefault()
              setSplitRatio((current) => clampSplitRatio(current + 2))
            }
          }}
        />
        <div
          ref={previewPaneRef}
          className="split-pane preview-pane"
          onScroll={(event) => {
            if (settings.splitScrollSync) {
              syncSourceScroll({
                previewElement: event.currentTarget,
                sourceEditor: sourceEditorRef.current,
                headingAnchors,
                sourceRef: scrollSyncSourceRef
              })
            }
          }}
        >
          <MarkdownPreview
            content={content}
            anchorTarget={anchorTarget}
            linkNavigation={linkNavigation}
            customCss={settings.customPreviewCss}
          />
        </div>
      </div>
    </div>
  )
}

function clampSplitRatio(value: number): number {
  return Math.min(maxSplitRatio, Math.max(minSplitRatio, value))
}

interface SyncPreviewScrollOptions {
  previewElement: HTMLElement | null
  sourceEditor: SourceMarkdownEditorHandle | null
  headingAnchors: HeadingAnchor[]
  ratio: number
  sourceRef: React.MutableRefObject<'source' | 'preview' | null>
}

interface SyncSourceScrollOptions {
  previewElement: HTMLElement
  sourceEditor: SourceMarkdownEditorHandle | null
  headingAnchors: HeadingAnchor[]
  sourceRef: React.MutableRefObject<'source' | 'preview' | null>
}

interface PreviewHeadingPosition {
  anchor: HeadingAnchor
  top: number
}

function syncPreviewScroll({
  previewElement,
  sourceEditor,
  headingAnchors,
  ratio,
  sourceRef
}: SyncPreviewScrollOptions): void {
  if (!previewElement || sourceRef.current === 'preview') {
    return
  }

  sourceRef.current = 'source'
  const synced = syncPreviewByHeading(previewElement, sourceEditor, headingAnchors)

  if (!synced) {
    const maxScrollTop = previewElement.scrollHeight - previewElement.clientHeight
    previewElement.scrollTop = Math.max(0, maxScrollTop) * ratio
  }

  releaseScrollSyncLock(sourceRef, 'source')
}

function syncSourceScroll({
  previewElement,
  sourceEditor,
  headingAnchors,
  sourceRef
}: SyncSourceScrollOptions): void {
  if (!sourceEditor || sourceRef.current === 'source') {
    return
  }

  sourceRef.current = 'preview'
  const synced = syncSourceByHeading(previewElement, sourceEditor, headingAnchors)

  if (!synced) {
    const maxScrollTop = previewElement.scrollHeight - previewElement.clientHeight
    const ratio = maxScrollTop <= 0 ? 0 : previewElement.scrollTop / maxScrollTop
    sourceEditor.scrollToRatio(ratio)
  }

  releaseScrollSyncLock(sourceRef, 'preview')
}

function syncPreviewByHeading(
  previewElement: HTMLElement,
  sourceEditor: SourceMarkdownEditorHandle | null,
  headingAnchors: HeadingAnchor[]
): boolean {
  if (!sourceEditor || headingAnchors.length === 0) {
    return false
  }

  const headingPositions = getPreviewHeadingPositions(previewElement, headingAnchors)

  if (headingPositions.length === 0) {
    return false
  }

  const visibleLine = sourceEditor.getVisibleLine()
  const lineCount = sourceEditor.getLineCount()
  const targetTop = mapLineToPreviewTop({
    line: visibleLine,
    lineCount,
    headingAnchors,
    headingPositions,
    maxScrollTop: getMaxScrollTop(previewElement)
  })

  if (targetTop === null) {
    return false
  }

  previewElement.scrollTop = Math.max(0, targetTop - scrollSyncTopOffset)
  return true
}

function syncSourceByHeading(
  previewElement: HTMLElement,
  sourceEditor: SourceMarkdownEditorHandle | null,
  headingAnchors: HeadingAnchor[]
): boolean {
  if (!sourceEditor || headingAnchors.length === 0) {
    return false
  }

  const headingPositions = getPreviewHeadingPositions(previewElement, headingAnchors)

  if (headingPositions.length === 0) {
    return false
  }

  const line = mapPreviewTopToLine({
    top: previewElement.scrollTop + scrollSyncTopOffset,
    lineCount: sourceEditor.getLineCount(),
    headingAnchors,
    headingPositions,
    maxScrollTop: getMaxScrollTop(previewElement)
  })

  if (line === null) {
    return false
  }

  sourceEditor.scrollToLine(line)
  return true
}

function getPreviewHeadingPositions(
  previewElement: HTMLElement,
  headingAnchors: HeadingAnchor[]
): PreviewHeadingPosition[] {
  return headingAnchors
    .map((anchor) => {
      const headingElement = previewElement.querySelector<HTMLElement>(
        `[data-heading-anchor="${cssEscape(anchor.slug)}"]`
      )

      if (!headingElement) {
        return null
      }

      return {
        anchor,
        top: getElementScrollTop(previewElement, headingElement)
      }
    })
    .filter((position): position is PreviewHeadingPosition => position !== null)
}

function mapLineToPreviewTop({
  line,
  lineCount,
  headingAnchors,
  headingPositions,
  maxScrollTop
}: {
  line: number
  lineCount: number
  headingAnchors: HeadingAnchor[]
  headingPositions: PreviewHeadingPosition[]
  maxScrollTop: number
}): number | null {
  const currentIndex = findHeadingIndexAtOrBeforeLine(headingAnchors, line)

  if (currentIndex < 0) {
    return maxScrollTop <= 0
      ? 0
      : Math.min(maxScrollTop, maxScrollTop * (line / Math.max(1, lineCount)))
  }

  const current = headingPositions.find((position) => position.anchor.index === currentIndex)

  if (!current) {
    return null
  }

  const nextAnchor = headingAnchors[currentIndex + 1]
  const next = nextAnchor
    ? headingPositions.find((position) => position.anchor.index === nextAnchor.index)
    : null
  const nextLine = nextAnchor?.line ?? lineCount
  const nextTop = next?.top ?? maxScrollTop
  const progress = getBoundedProgress(line, current.anchor.line, nextLine)

  return interpolate(current.top, nextTop, progress)
}

function mapPreviewTopToLine({
  top,
  lineCount,
  headingAnchors,
  headingPositions,
  maxScrollTop
}: {
  top: number
  lineCount: number
  headingAnchors: HeadingAnchor[]
  headingPositions: PreviewHeadingPosition[]
  maxScrollTop: number
}): number | null {
  const currentIndex = findHeadingPositionIndexAtOrBeforeTop(headingPositions, top)

  if (currentIndex < 0) {
    return Math.max(1, Math.round((top / Math.max(1, maxScrollTop)) * lineCount))
  }

  const current = headingPositions[currentIndex]
  const next = headingPositions[currentIndex + 1]
  const nextAnchor = next?.anchor ?? headingAnchors[current.anchor.index + 1]
  const nextLine = nextAnchor?.line ?? lineCount
  const nextTop = next?.top ?? maxScrollTop
  const progress = getBoundedProgress(top, current.top, nextTop)

  return Math.max(1, Math.round(interpolate(current.anchor.line, nextLine, progress)))
}

function findHeadingIndexAtOrBeforeLine(anchors: HeadingAnchor[], line: number): number {
  let currentIndex = -1

  for (let index = 0; index < anchors.length; index += 1) {
    if (anchors[index].line > line) {
      break
    }

    currentIndex = index
  }

  return currentIndex
}

function findHeadingPositionIndexAtOrBeforeTop(
  headingPositions: PreviewHeadingPosition[],
  top: number
): number {
  let currentIndex = -1

  for (let index = 0; index < headingPositions.length; index += 1) {
    if (headingPositions[index].top > top) {
      break
    }

    currentIndex = index
  }

  return currentIndex
}

function getElementScrollTop(container: HTMLElement, element: HTMLElement): number {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()

  return elementRect.top - containerRect.top + container.scrollTop
}

function getMaxScrollTop(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight)
}

function getBoundedProgress(value: number, start: number, end: number): number {
  if (end <= start) {
    return 0
  }

  return Math.min(1, Math.max(0, (value - start) / (end - start)))
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function releaseScrollSyncLock(
  sourceRef: React.MutableRefObject<'source' | 'preview' | null>,
  source: 'source' | 'preview'
): void {
  window.setTimeout(() => {
    if (sourceRef.current === source) {
      sourceRef.current = null
    }
  }, scrollSyncReleaseDelay)
}

function cssEscape(value: string): string {
  if (window.CSS?.escape) {
    return window.CSS.escape(value)
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}
