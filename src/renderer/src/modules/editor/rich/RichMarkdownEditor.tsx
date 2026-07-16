import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  baseKeymap,
  chainCommands,
  createParagraphNear,
  liftEmptyBlock,
  newlineInCode,
  setBlockType,
  splitBlock,
  toggleMark,
  wrapIn
} from 'prosemirror-commands'
import { history, redo, undo } from 'prosemirror-history'
import { inputRules } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { type Node as ProseMirrorNode } from 'prosemirror-model'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import { EditorState, Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { columnResizing, goToNextCell, tableEditing } from 'prosemirror-tables'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { openEditorLink, scrollToEditorAnchor } from '../services/linkNavigation'
import type { EditorLinkNavigationOptions } from '../services/linkNavigation'
import {
  findTextSearchMatches,
  normalizeSearchQuery,
  type TextSearchMatch
} from '../services/documentSearch'
import { getCodeBlockActionButton, handleCodeBlockAction } from '../rendering/blockActions'
import { collectHeadingAnchors, type HeadingAnchor } from '../rendering/headingAnchors'
import { DocumentOutline } from '../outline/DocumentOutline'
import { createCodeBlockNodeView } from './nodeViews/codeBlockNodeView'
import { createTaskListItemNodeView } from './nodeViews/taskListItemNodeView'
import { FormatToolbar } from './FormatToolbar'
import { RICH_EDITOR_STATE_EVENT } from './editorEvents'
import type { CursorPosition, MarkdownEditorPreferences } from '../model/types'
import {
  createMarkdownInputRules,
  parseRichMarkdown,
  richMarkdownSchema as schema,
  serializeRichMarkdown
} from './markdownModel'

interface RichMarkdownEditorProps {
  dirty: boolean
  content: string
  settings: MarkdownEditorPreferences
  currentPath?: string
  workspaceRoot?: string | null
  anchorTarget?: string | null
  searchPanel?: ReactNode
  searchQuery?: string
  activeSearchMatchIndex?: number
  initialScrollTop?: number
  onSearchMatchCountChange?: (count: number) => void
  onChange: (content: string) => void
  onCursorChange: (position: CursorPosition) => void
  onScrollTopChange?: (scrollTop: number) => void
  onOpenDocumentLink?: (path: string, anchor?: string) => boolean | void | Promise<boolean | void>
  onLinkError?: (message: string) => void
}

export function RichMarkdownEditor({
  dirty,
  content,
  settings,
  currentPath,
  workspaceRoot,
  anchorTarget,
  searchPanel,
  searchQuery = '',
  activeSearchMatchIndex = 0,
  initialScrollTop = 0,
  onSearchMatchCountChange,
  onChange,
  onCursorChange,
  onScrollTopChange,
  onOpenDocumentLink,
  onLinkError
}: RichMarkdownEditorProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contentRef = useRef(content)
  const initialContentRef = useRef(content)
  const initialScrollTopRef = useRef(initialScrollTop)
  const onChangeRef = useRef(onChange)
  const onCursorChangeRef = useRef(onCursorChange)
  const onScrollTopChangeRef = useRef(onScrollTopChange)
  const onSearchMatchCountChangeRef = useRef(onSearchMatchCountChange)
  const searchQueryRef = useRef(searchQuery)
  const activeSearchMatchIndexRef = useRef(activeSearchMatchIndex)
  const linkNavigationRef = useRef<EditorLinkNavigationOptions>({})
  const headingAnchors = useMemo(() => collectHeadingAnchors(content), [content])
  const [fontSize, setFontSize] = useState(settings.previewFontSize)
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [activeHeadingIndex, setActiveHeadingIndex] = useState<number | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange
  }, [onCursorChange])

  useEffect(() => {
    onScrollTopChangeRef.current = onScrollTopChange
  }, [onScrollTopChange])

  useEffect(() => {
    onSearchMatchCountChangeRef.current = onSearchMatchCountChange
  }, [onSearchMatchCountChange])

  useEffect(() => {
    linkNavigationRef.current = {
      currentPath,
      workspaceRoot,
      onOpenDocument: onOpenDocumentLink,
      onError: onLinkError
    }
  }, [currentPath, onLinkError, onOpenDocumentLink, workspaceRoot])

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const hostElement = hostRef.current
    const view = new EditorView(hostElement, {
      state: createEditorState(
        initialContentRef.current,
        searchQueryRef.current,
        activeSearchMatchIndexRef.current
      ),
      attributes: {
        spellcheck: 'false',
        autocorrect: 'off',
        autocomplete: 'off',
        autocapitalize: 'off',
        translate: 'no'
      },
      nodeViews: {
        code_block: (node, view, getPos) =>
          createCodeBlockNodeView(node, view, getPos as () => number | undefined),
        list_item: (node, view, getPos) =>
          createTaskListItemNodeView(node, view, getPos as () => number | undefined)
      },
      dispatchTransaction(transaction) {
        const nextState = view.state.apply(transaction)
        view.updateState(nextState)
        view.dom.dispatchEvent(new CustomEvent(RICH_EDITOR_STATE_EVENT))

        if (transaction.docChanged) {
          const markdown = serializeRichMarkdown(nextState.doc)
          contentRef.current = markdown
          onChangeRef.current(markdown)
        }

        const searchState = richSearchPluginKey.getState(nextState)
        onSearchMatchCountChangeRef.current?.(searchState?.matches.length ?? 0)

        if (transaction.selectionSet || transaction.docChanged) {
          onCursorChangeRef.current(getCursorPosition(nextState.doc, nextState.selection.from))
        }
      }
    })

    viewRef.current = view
    setEditorView(view)
    contentRef.current = initialContentRef.current
    onSearchMatchCountChangeRef.current?.(
      richSearchPluginKey.getState(view.state)?.matches.length ?? 0
    )
    onCursorChangeRef.current(getCursorPosition(view.state.doc, view.state.selection.from))

    const handleMouseDown = (event: MouseEvent): void => {
      handleRichEditorMouseDown(hostElement, event)
    }
    const handleClick = (event: MouseEvent): void => {
      handleRichEditorClick(hostElement, event, linkNavigationRef.current)
    }
    const scrollContainer = hostElement.closest<HTMLElement>('.editor-host')
    const handleScroll = (): void => {
      if (scrollContainer) {
        onScrollTopChangeRef.current?.(scrollContainer.scrollTop)
      }
    }
    const restoreScrollFrame = window.requestAnimationFrame(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = initialScrollTopRef.current
      }
    })

    hostElement.addEventListener('mousedown', handleMouseDown, true)
    hostElement.addEventListener('click', handleClick, true)
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.cancelAnimationFrame(restoreScrollFrame)
      hostElement.removeEventListener('mousedown', handleMouseDown, true)
      hostElement.removeEventListener('click', handleClick, true)
      scrollContainer?.removeEventListener('scroll', handleScroll)
      view.destroy()
      viewRef.current = null
      setEditorView(null)
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current

    if (!view || content === contentRef.current) {
      return
    }

    view.updateState(
      createEditorState(content, searchQueryRef.current, activeSearchMatchIndexRef.current)
    )
    contentRef.current = content
    onSearchMatchCountChangeRef.current?.(
      richSearchPluginKey.getState(view.state)?.matches.length ?? 0
    )
    onCursorChangeRef.current(getCursorPosition(view.state.doc, view.state.selection.from))
  }, [content])

  useEffect(() => {
    const view = viewRef.current
    searchQueryRef.current = searchQuery
    activeSearchMatchIndexRef.current = activeSearchMatchIndex

    if (!view) {
      return
    }

    view.dispatch(
      view.state.tr.setMeta(richSearchPluginKey, {
        query: searchQuery,
        activeIndex: activeSearchMatchIndex
      } satisfies RichSearchMeta)
    )

    const searchState = richSearchPluginKey.getState(view.state)
    onSearchMatchCountChangeRef.current?.(searchState?.matches.length ?? 0)
    scrollToRichSearchMatch(view, searchState?.matches ?? [], activeSearchMatchIndex)
  }, [activeSearchMatchIndex, searchQuery])

  useEffect(() => {
    if (!anchorTarget || !hostRef.current) {
      return
    }

    window.requestAnimationFrame(() => {
      if (hostRef.current) {
        scrollToEditorAnchor(anchorTarget, hostRef.current)
      }
    })
  }, [anchorTarget, content])

  useEffect(() => {
    const root = hostRef.current

    if (!root || headingAnchors.length === 0) {
      setActiveHeadingIndex(null)
      return
    }

    let frameId = 0

    const updateActiveHeading = (): void => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        const headings = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
        let currentIndex = 0

        headings.forEach((heading, index) => {
          if (heading.getBoundingClientRect().top <= 140) {
            currentIndex = index
          }
        })

        setActiveHeadingIndex(Math.min(currentIndex, headingAnchors.length - 1))
      })
    }

    updateActiveHeading()
    window.addEventListener('scroll', updateActiveHeading, true)
    window.addEventListener('resize', updateActiveHeading)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', updateActiveHeading, true)
      window.removeEventListener('resize', updateActiveHeading)
    }
  }, [headingAnchors])

  const scrollToHeading = (heading: HeadingAnchor): void => {
    const root = hostRef.current

    if (!root) {
      return
    }

    const headingElements = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'))
    const target = headingElements[heading.index]

    target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  return (
    <div
      className="preview-edit-shell"
      style={
        {
          '--preview-max-width': `${settings.previewMaxWidth}px`,
          '--preview-font-size': `${fontSize}px`,
          '--preview-line-height': String(settings.previewLineHeight)
        } as React.CSSProperties
      }
      data-preview-centered={settings.previewCentered}
      data-width-mode={settings.previewEditWidthMode}
    >
      {settings.customPreviewCss ? <style>{settings.customPreviewCss}</style> : null}
      {searchPanel}
      <DocumentOutline
        headings={headingAnchors}
        dirty={dirty}
        activeHeadingIndex={activeHeadingIndex}
        onHeadingSelect={scrollToHeading}
      />
      <FormatToolbar view={editorView} fontSize={fontSize} onFontSizeChange={setFontSize} />
      <div ref={hostRef} className="preview-edit-prosemirror" />
    </div>
  )
}

const insertLinkCommand = (
  state: EditorState,
  dispatch?: (tr: import('prosemirror-state').Transaction) => void
): boolean => {
  const { selection } = state
  const mark = state.schema.marks.link
  const existingLink = state.doc.rangeHasMark(selection.from, selection.to, mark)

  if (existingLink) {
    if (dispatch) {
      dispatch(state.tr.removeMark(selection.from, selection.to, mark))
    }
    return true
  }

  const url = window.prompt('请输入链接地址:', 'https://')
  if (!url) return false

  if (dispatch) {
    if (selection.empty) {
      const text = window.prompt('请输入链接文本:', '')
      if (!text) return false
      const linkMark = mark.create({ href: url })
      const tr = state.tr.insertText(text, selection.from, selection.to)
      tr.addMark(selection.from, selection.from + text.length, linkMark)
      dispatch(tr)
    } else {
      dispatch(state.tr.addMark(selection.from, selection.to, mark.create({ href: url })))
    }
  }
  return true
}

interface RichSearchPluginState {
  query: string
  activeIndex: number
  matches: TextSearchMatch[]
  decorations: DecorationSet
}

interface RichSearchMeta {
  query: string
  activeIndex: number
}

const richSearchPluginKey = new PluginKey<RichSearchPluginState>('rich-search')

function createRichSearchPlugin(query: string, activeIndex: number): Plugin<RichSearchPluginState> {
  return new Plugin<RichSearchPluginState>({
    key: richSearchPluginKey,
    state: {
      init(_, state) {
        return createRichSearchState(state.doc, query, activeIndex)
      },
      apply(transaction, previous, _, nextState) {
        const meta = transaction.getMeta(richSearchPluginKey) as RichSearchMeta | undefined

        if (!transaction.docChanged && !meta) {
          return previous
        }

        return createRichSearchState(
          nextState.doc,
          meta?.query ?? previous.query,
          meta?.activeIndex ?? previous.activeIndex
        )
      }
    },
    props: {
      decorations(state) {
        return richSearchPluginKey.getState(state)?.decorations ?? null
      }
    }
  })
}

function createRichSearchState(
  doc: ProseMirrorNode,
  query: string,
  activeIndex: number
): RichSearchPluginState {
  const normalizedQuery = normalizeSearchQuery(query)
  const matches = findRichSearchMatches(doc, normalizedQuery)
  const safeActiveIndex = matches.length > 0 ? Math.min(activeIndex, matches.length - 1) : 0
  const decorations = DecorationSet.create(
    doc,
    matches.map((match, index) =>
      Decoration.inline(match.from, match.to, {
        class:
          index === safeActiveIndex
            ? 'editor-search-match editor-search-match-active'
            : 'editor-search-match'
      })
    )
  )

  return {
    query: normalizedQuery,
    activeIndex: safeActiveIndex,
    matches,
    decorations
  }
}

function findRichSearchMatches(doc: ProseMirrorNode, query: string): TextSearchMatch[] {
  if (!query) {
    return []
  }

  const matches: TextSearchMatch[] = []

  doc.descendants((node, position) => {
    if (!node.isText) {
      return true
    }

    for (const match of findTextSearchMatches(node.text ?? '', query)) {
      matches.push({
        from: position + match.from,
        to: position + match.to
      })
    }

    return true
  })

  return matches
}

function scrollToRichSearchMatch(
  view: EditorView,
  matches: TextSearchMatch[],
  activeIndex: number
): void {
  if (matches.length === 0) {
    return
  }

  const match = matches[Math.min(activeIndex, matches.length - 1)]
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, match.from, match.to))
      .scrollIntoView()
  )
}

function createEditorState(
  markdown: string,
  searchQuery = '',
  activeSearchMatchIndex = 0
): EditorState {
  return EditorState.create({
    doc: parseMarkdown(markdown),
    plugins: [
      createRichSearchPlugin(searchQuery, activeSearchMatchIndex),
      inputRules({ rules: createMarkdownInputRules() }),
      history(),
      columnResizing(),
      tableEditing(),
      keymap({
        'Mod-z': undo,
        'Shift-Mod-z': redo,
        'Mod-y': redo,
        'Mod-b': toggleMark(schema.marks.strong),
        'Mod-i': toggleMark(schema.marks.em),
        'Mod-`': toggleMark(schema.marks.code),
        'Mod-d': toggleMark(schema.marks.strikethrough),
        'Mod-k': insertLinkCommand,
        'Shift-Mod-7': wrapInList(schema.nodes.ordered_list),
        'Shift-Mod-8': wrapInList(schema.nodes.bullet_list),
        'Mod-[': liftListItem(schema.nodes.list_item),
        'Mod-]': sinkListItem(schema.nodes.list_item),
        'Mod-Shift-1': setBlockType(schema.nodes.heading, { level: 1 }),
        'Mod-Shift-2': setBlockType(schema.nodes.heading, { level: 2 }),
        'Mod-Shift-3': setBlockType(schema.nodes.heading, { level: 3 }),
        'Mod-Shift-4': setBlockType(schema.nodes.heading, { level: 4 }),
        'Mod-Shift-5': setBlockType(schema.nodes.heading, { level: 5 }),
        'Mod-Shift-9': wrapIn(schema.nodes.blockquote),
        Enter: chainCommands(
          splitListItem(schema.nodes.list_item),
          newlineInCode,
          createParagraphNear,
          liftEmptyBlock,
          splitBlock
        ),
        Tab: chainCommands(goToNextCell(1), sinkListItem(schema.nodes.list_item)),
        'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(schema.nodes.list_item))
      }),
      keymap(baseKeymap)
    ]
  })
}

function parseMarkdown(markdown: string): ProseMirrorNode {
  return parseRichMarkdown(markdown)
}

function handleRichEditorMouseDown(root: HTMLElement, event: MouseEvent): boolean {
  const target = event.target instanceof HTMLElement ? event.target : null

  if (!target || !root.contains(target)) {
    return false
  }

  if (target.closest('.markdown-code-toolbar')) {
    event.stopPropagation()
    return true
  }

  return false
}

function handleRichEditorClick(
  root: HTMLElement,
  event: MouseEvent,
  linkNavigation: EditorLinkNavigationOptions
): boolean {
  const target = event.target instanceof HTMLElement ? event.target : null

  if (!target || !root.contains(target)) {
    return false
  }

  const actionButton = getCodeBlockActionButton(target)

  if (actionButton) {
    event.preventDefault()
    event.stopPropagation()
    return handleCodeBlockAction(actionButton)
  }

  const link = target.closest<HTMLAnchorElement>('a[href]')

  if (link && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    event.stopPropagation()
    return openEditorLink(link.getAttribute('href') ?? '', root, linkNavigation)
  }

  return false
}

function getCursorPosition(doc: ProseMirrorNode, position: number): CursorPosition {
  const textBeforeCursor = doc.textBetween(0, position, '\n', '\n')
  const lines = textBeforeCursor.split('\n')

  return {
    line: Math.max(lines.length, 1),
    column: (lines.at(-1)?.length ?? 0) + 1
  }
}
