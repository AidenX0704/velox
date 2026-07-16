import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'
import 'markdown-it-texmath/css/texmath.css'
import 'prosemirror-view/style/prosemirror.css'
import { IconChevronDown, IconChevronUp, IconClose, IconSearchStroked } from '@douyinfe/semi-icons'
import './styles/editor.css'
import type { CursorPosition, EditorMode, MarkdownEditorPreferences } from './model/types'
import { FormatToolbar } from './rich/FormatToolbar'
import { RichMarkdownEditor } from './rich/RichMarkdownEditor'
import { DocumentOutline } from './outline/DocumentOutline'
import { collectHeadingAnchors, type HeadingAnchor } from './rendering/headingAnchors'
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
  searchRequestId?: number
  initialScrollTop?: number
  onChange: (content: string) => void
  onCursorChange: (position: CursorPosition) => void
  onScrollTopChange?: (scrollTop: number) => void
  onOpenDocumentLink?: (path: string, anchor?: string) => boolean | void | Promise<boolean | void>
  onLinkError?: (message: string) => void
}

export function MarkdownEditor({
  mode,
  dirty,
  content,
  settings,
  currentPath,
  workspaceRoot,
  anchorTarget,
  searchRequestId = 0,
  initialScrollTop = 0,
  onChange,
  onCursorChange,
  onScrollTopChange,
  onOpenDocumentLink,
  onLinkError
}: MarkdownEditorProps): React.JSX.Element {
  const sourceEditorRef = useRef<SourceMarkdownEditorHandle | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const previousSearchRequestIdRef = useRef(searchRequestId)
  const [sourceVisibleLine, setSourceVisibleLine] = useState(1)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchCount, setSearchMatchCount] = useState(0)
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0)
  const headingAnchors = useMemo(() => collectHeadingAnchors(content), [content])
  const sourceActiveHeadingIndex = findHeadingIndexAtOrBeforeLine(headingAnchors, sourceVisibleLine)
  const activeSearchOrdinal =
    searchMatchCount > 0 ? Math.min(activeSearchMatchIndex, searchMatchCount - 1) + 1 : 0

  const focusSearchInput = useCallback((): void => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
  }, [])

  const openSearch = useCallback((): void => {
    setSearchOpen(true)
    focusSearchInput()
  }, [focusSearchInput])

  const closeSearch = useCallback((): void => {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchMatchCount(0)
    setActiveSearchMatchIndex(0)
  }, [])

  const goToSearchMatch = useCallback(
    (direction: 1 | -1): void => {
      if (searchMatchCount === 0) {
        focusSearchInput()
        return
      }

      setActiveSearchMatchIndex(
        (current) => (current + direction + searchMatchCount) % searchMatchCount
      )
    },
    [focusSearchInput, searchMatchCount]
  )

  const handleSearchMatchCountChange = useCallback((count: number): void => {
    setSearchMatchCount(count)
    setActiveSearchMatchIndex((current) => (count === 0 ? 0 : Math.min(current, count - 1)))
  }, [])

  useEffect(() => {
    if (previousSearchRequestIdRef.current === searchRequestId) {
      return
    }

    previousSearchRequestIdRef.current = searchRequestId
    openSearch()
  }, [openSearch, searchRequestId])

  const searchPanel = searchOpen ? (
    <div className="document-search-panel" role="search" aria-label="文档内搜索">
      <IconSearchStroked className="document-search-icon" />
      <input
        ref={searchInputRef}
        className="document-search-input"
        type="search"
        value={searchQuery}
        placeholder="搜索文档"
        aria-label="搜索文档"
        onChange={(event) => {
          setSearchQuery(event.target.value)
          setSearchMatchCount(0)
          setActiveSearchMatchIndex(0)
        }}
        onKeyDown={(event) => {
          event.stopPropagation()

          if (event.key === 'Enter') {
            event.preventDefault()
            goToSearchMatch(event.shiftKey ? -1 : 1)
            return
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            closeSearch()
          }
        }}
      />
      <span className="document-search-count" aria-live="polite">
        {activeSearchOrdinal}/{searchMatchCount}
      </span>
      <button
        className="document-search-button"
        type="button"
        title="上一个"
        aria-label="上一个搜索结果"
        disabled={searchMatchCount === 0}
        onClick={() => goToSearchMatch(-1)}
      >
        <IconChevronUp />
      </button>
      <button
        className="document-search-button"
        type="button"
        title="下一个"
        aria-label="下一个搜索结果"
        disabled={searchMatchCount === 0}
        onClick={() => goToSearchMatch(1)}
      >
        <IconChevronDown />
      </button>
      <button
        className="document-search-button"
        type="button"
        title="关闭"
        aria-label="关闭文档搜索"
        onClick={closeSearch}
      >
        <IconClose />
      </button>
    </div>
  ) : null
  const activeSearchQuery = searchOpen ? searchQuery : ''

  if (mode === 'source') {
    return (
      <div className="editor-mode-shell" data-editor-view="source">
        {searchPanel}
        <FormatToolbar
          onMarkdownFormat={(action) => sourceEditorRef.current?.applyFormat(action)}
        />
        <div className="editor-with-outline">
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
            initialScrollTop={initialScrollTop}
            onScrollTopChange={onScrollTopChange}
            searchQuery={activeSearchQuery}
            activeSearchMatchIndex={activeSearchMatchIndex}
            onSearchMatchCountChange={handleSearchMatchCountChange}
          />
        </div>
      </div>
    )
  }

  return (
    <RichMarkdownEditor
      dirty={dirty}
      content={content}
      settings={settings}
      currentPath={currentPath}
      workspaceRoot={workspaceRoot}
      anchorTarget={anchorTarget}
      searchPanel={searchPanel}
      searchQuery={activeSearchQuery}
      activeSearchMatchIndex={activeSearchMatchIndex}
      initialScrollTop={initialScrollTop}
      onSearchMatchCountChange={handleSearchMatchCountChange}
      onChange={onChange}
      onCursorChange={onCursorChange}
      onScrollTopChange={onScrollTopChange}
      onOpenDocumentLink={onOpenDocumentLink}
      onLinkError={onLinkError}
    />
  )
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
