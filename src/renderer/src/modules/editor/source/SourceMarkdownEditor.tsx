import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState, StateField } from '@codemirror/state'
import type { Extension, Text } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'
import type { CursorPosition } from '../model/types'
import { findTextSearchMatches } from '../services/documentSearch'

function wrapSelection(view: EditorView, before: string, after: string): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const replacement = `${before}${selected || '文本'}${after}`
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from + before.length, head: from + before.length + (selected.length || 2) }
  })
  return true
}

export type SourceMarkdownFormatAction =
  | 'paragraph'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inline-code'
  | 'bullet-list'
  | 'ordered-list'
  | 'task-list'
  | 'blockquote'
  | 'code-block'
  | 'horizontal-rule'
  | 'link'

function insertAtLineStart(view: EditorView, prefix: string): boolean {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const currentText = view.state.sliceDoc(line.from, line.to)

  if (currentText.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' }
    })
  } else {
    view.dispatch({
      changes: { from: line.from, insert: prefix }
    })
  }
  return true
}

function replaceLinePrefix(view: EditorView, prefix: string): boolean {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const match = /^(\s*)(#{1,6}\s+|>\s+|[-+*]\s(?:\[(?: |x|X)\]\s)?|\d+\.\s+)/.exec(line.text)
  const indent = match?.[1] ?? ''
  const prefixFrom = line.from + indent.length
  const prefixTo = match ? line.from + match[0].length : prefixFrom

  view.dispatch({
    changes: { from: prefixFrom, to: prefixTo, insert: prefix }
  })
  view.focus()
  return true
}

function insertMarkdownBlock(view: EditorView, markdown: string): boolean {
  const { from, to } = view.state.selection.main
  const before = from > 0 && view.state.sliceDoc(from - 1, from) !== '\n' ? '\n' : ''
  const after = to < view.state.doc.length && view.state.sliceDoc(to, to + 1) !== '\n' ? '\n' : ''
  const insert = `${before}${markdown}${after}`

  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + before.length + markdown.length }
  })
  view.focus()
  return true
}

function insertLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const url = window.prompt('请输入链接地址:', 'https://')

  if (!url) {
    return false
  }

  const text = selected || window.prompt('请输入链接文本:', '') || ''

  if (!text) {
    return false
  }

  const replacement = `[${text}](${url})`
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from + 1, head: from + 1 + text.length }
  })
  view.focus()
  return true
}

function applyMarkdownFormat(view: EditorView, action: SourceMarkdownFormatAction): boolean {
  switch (action) {
    case 'paragraph':
      return replaceLinePrefix(view, '')
    case 'heading-1':
      return replaceLinePrefix(view, '# ')
    case 'heading-2':
      return replaceLinePrefix(view, '## ')
    case 'heading-3':
      return replaceLinePrefix(view, '### ')
    case 'heading-4':
      return replaceLinePrefix(view, '#### ')
    case 'heading-5':
      return replaceLinePrefix(view, '##### ')
    case 'heading-6':
      return replaceLinePrefix(view, '###### ')
    case 'bold':
      return wrapSelection(view, '**', '**')
    case 'italic':
      return wrapSelection(view, '*', '*')
    case 'strikethrough':
      return wrapSelection(view, '~~', '~~')
    case 'inline-code':
      return wrapSelection(view, '`', '`')
    case 'bullet-list':
      return replaceLinePrefix(view, '- ')
    case 'ordered-list':
      return replaceLinePrefix(view, '1. ')
    case 'task-list':
      return replaceLinePrefix(view, '- [ ] ')
    case 'blockquote':
      return replaceLinePrefix(view, '> ')
    case 'code-block':
      return wrapSelection(view, '```\n', '\n```')
    case 'horizontal-rule':
      return insertMarkdownBlock(view, '\n---\n')
    case 'link':
      return insertLink(view)
  }
}

const markdownKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => applyMarkdownFormat(v, 'bold') },
  { key: 'Mod-i', run: (v) => applyMarkdownFormat(v, 'italic') },
  { key: 'Mod-d', run: (v) => applyMarkdownFormat(v, 'strikethrough') },
  { key: 'Mod-`', run: (v) => applyMarkdownFormat(v, 'inline-code') },
  { key: 'Mod-k', run: (v) => applyMarkdownFormat(v, 'link') },
  { key: 'Mod-Shift-1', run: (v) => insertAtLineStart(v, '# ') },
  { key: 'Mod-Shift-2', run: (v) => insertAtLineStart(v, '## ') },
  { key: 'Mod-Shift-3', run: (v) => insertAtLineStart(v, '### ') },
  { key: 'Mod-Shift-4', run: (v) => insertAtLineStart(v, '#### ') },
  { key: 'Mod-Shift-5', run: (v) => insertAtLineStart(v, '##### ') },
  { key: 'Mod-Shift-9', run: (v) => insertAtLineStart(v, '> ') },
  { key: 'Mod-Shift-8', run: (v) => insertAtLineStart(v, '- ') },
  { key: 'Mod-Shift-7', run: (v) => insertAtLineStart(v, '1. ') }
])

interface SourceMarkdownEditorProps {
  value: string
  wordWrap: boolean
  showLineNumbers: boolean
  fontSize: number
  lineHeight: number
  searchQuery?: string
  activeSearchMatchIndex?: number
  initialScrollTop?: number
  onChange: (value: string) => void
  onCursorChange: (position: CursorPosition) => void
  onScrollRatioChange?: (ratio: number) => void
  onScrollTopChange?: (scrollTop: number) => void
  onSearchMatchCountChange?: (count: number) => void
}

export interface SourceMarkdownEditorHandle {
  scrollToRatio: (ratio: number) => void
  scrollToLine: (line: number) => void
  getVisibleLine: () => number
  getLineCount: () => number
  applyFormat: (action: SourceMarkdownFormatAction) => boolean
}

export const SourceMarkdownEditor = forwardRef<
  SourceMarkdownEditorHandle,
  SourceMarkdownEditorProps
>(function SourceMarkdownEditor(
  {
    value,
    wordWrap,
    showLineNumbers,
    fontSize,
    lineHeight,
    searchQuery = '',
    activeSearchMatchIndex = 0,
    initialScrollTop = 0,
    onChange,
    onCursorChange,
    onScrollRatioChange,
    onScrollTopChange,
    onSearchMatchCountChange
  },
  ref
): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onCursorChangeRef = useRef(onCursorChange)
  const onScrollRatioChangeRef = useRef(onScrollRatioChange)
  const onScrollTopChangeRef = useRef(onScrollTopChange)
  const onSearchMatchCountChangeRef = useRef(onSearchMatchCountChange)
  const valueRef = useRef(value)
  const initialScrollTopRef = useRef(initialScrollTop)
  const searchQueryRef = useRef(searchQuery)
  const activeSearchMatchIndexRef = useRef(activeSearchMatchIndex)
  const initialOptionsRef = useRef({ fontSize, lineHeight, showLineNumbers, wordWrap })
  const lineNumbersCompartmentRef = useRef(new Compartment())
  const wrappingCompartmentRef = useRef(new Compartment())
  const themeCompartmentRef = useRef(new Compartment())
  const searchCompartmentRef = useRef(new Compartment())

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange
  }, [onCursorChange])

  useEffect(() => {
    onScrollRatioChangeRef.current = onScrollRatioChange
  }, [onScrollRatioChange])

  useEffect(() => {
    onScrollTopChangeRef.current = onScrollTopChange
  }, [onScrollTopChange])

  useEffect(() => {
    onSearchMatchCountChangeRef.current = onSearchMatchCountChange
  }, [onSearchMatchCountChange])

  useImperativeHandle(ref, () => ({
    scrollToRatio(ratio: number) {
      const scrollElement = viewRef.current?.scrollDOM

      if (!scrollElement) {
        return
      }

      const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight
      scrollElement.scrollTop = Math.max(0, maxScrollTop) * ratio
    },
    scrollToLine(line: number) {
      const view = viewRef.current

      if (!view) {
        return
      }

      const safeLine = Math.min(Math.max(line, 1), view.state.doc.lines)
      const position = view.state.doc.line(safeLine).from
      view.dispatch({
        effects: EditorView.scrollIntoView(position, { y: 'start', yMargin: 0 })
      })
    },
    getVisibleLine() {
      const view = viewRef.current

      if (!view) {
        return 1
      }

      const position = view.posAtCoords({
        x: view.scrollDOM.getBoundingClientRect().left + 8,
        y: view.scrollDOM.getBoundingClientRect().top + 8
      })

      if (position === null) {
        return 1
      }

      return view.state.doc.lineAt(position).number
    },
    getLineCount() {
      return viewRef.current?.state.doc.lines ?? 1
    },
    applyFormat(action: SourceMarkdownFormatAction) {
      const view = viewRef.current

      return view ? applyMarkdownFormat(view, action) : false
    }
  }))

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        lineNumbersCompartmentRef.current.of(
          createLineNumberExtensions(initialOptionsRef.current.showLineNumbers)
        ),
        history(),
        bracketMatching(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdownKeymap,
        searchCompartmentRef.current.of(
          createSearchHighlightExtension(searchQueryRef.current, activeSearchMatchIndexRef.current)
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const nextValue = update.state.doc.toString()
            valueRef.current = nextValue
            onChangeRef.current(nextValue)
            onSearchMatchCountChangeRef.current?.(
              findTextSearchMatches(nextValue, searchQueryRef.current).length
            )
          }

          if (update.selectionSet || update.docChanged || update.focusChanged) {
            onCursorChangeRef.current(getCursorPosition(update.view))
          }
        }),
        themeCompartmentRef.current.of(
          createEditorTheme(
            initialOptionsRef.current.fontSize,
            initialOptionsRef.current.lineHeight
          )
        ),
        wrappingCompartmentRef.current.of(
          initialOptionsRef.current.wordWrap ? EditorView.lineWrapping : []
        )
      ]
    })

    const view = new EditorView({
      state,
      parent: containerRef.current
    })
    const handleScroll = (): void => {
      onScrollRatioChangeRef.current?.(getScrollRatio(view.scrollDOM))
      onScrollTopChangeRef.current?.(view.scrollDOM.scrollTop)
    }
    const restoreScrollFrame = window.requestAnimationFrame(() => {
      view.scrollDOM.scrollTop = initialScrollTopRef.current
    })

    viewRef.current = view
    view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })
    onCursorChangeRef.current(getCursorPosition(view))

    return () => {
      window.cancelAnimationFrame(restoreScrollFrame)
      view.scrollDOM.removeEventListener('scroll', handleScroll)
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    searchQueryRef.current = searchQuery
    activeSearchMatchIndexRef.current = activeSearchMatchIndex

    const matches = findTextSearchMatches(
      view?.state.doc.toString() ?? valueRef.current,
      searchQuery
    )
    onSearchMatchCountChangeRef.current?.(matches.length)

    if (!view) {
      return
    }

    view.dispatch({
      effects: searchCompartmentRef.current.reconfigure(
        createSearchHighlightExtension(searchQuery, activeSearchMatchIndex)
      )
    })
    scrollToSourceSearchMatch(view, matches, activeSearchMatchIndex)
  }, [activeSearchMatchIndex, searchQuery])

  useEffect(() => {
    const view = viewRef.current

    if (!view || valueRef.current === value) {
      return
    }

    valueRef.current = value
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value
      }
    })
  }, [value])

  useEffect(() => {
    const view = viewRef.current

    if (!view) {
      return
    }

    view.dispatch({
      effects: [
        lineNumbersCompartmentRef.current.reconfigure(createLineNumberExtensions(showLineNumbers)),
        wrappingCompartmentRef.current.reconfigure(wordWrap ? EditorView.lineWrapping : []),
        themeCompartmentRef.current.reconfigure(createEditorTheme(fontSize, lineHeight))
      ]
    })
  }, [fontSize, lineHeight, showLineNumbers, wordWrap])

  return <div ref={containerRef} className="source-editor" />
})

function createLineNumberExtensions(showLineNumbers: boolean): Extension {
  return showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
}

function createSearchHighlightExtension(query: string, activeIndex: number): Extension {
  if (!query.trim()) {
    return []
  }

  return StateField.define<DecorationSet>({
    create(state) {
      return createSearchDecorations(state.doc, query, activeIndex)
    },
    update(decorations, transaction) {
      if (transaction.docChanged) {
        return createSearchDecorations(transaction.state.doc, query, activeIndex)
      }

      return decorations.map(transaction.changes)
    },
    provide: (field) => EditorView.decorations.from(field)
  })
}

function createSearchDecorations(doc: Text, query: string, activeIndex: number): DecorationSet {
  const matches = findTextSearchMatches(doc.toString(), query)
  const safeActiveIndex = matches.length > 0 ? Math.min(activeIndex, matches.length - 1) : -1

  return Decoration.set(
    matches.map((match, index) =>
      Decoration.mark({
        class:
          index === safeActiveIndex
            ? 'editor-search-match editor-search-match-active'
            : 'editor-search-match'
      }).range(match.from, match.to)
    ),
    true
  )
}

function scrollToSourceSearchMatch(
  view: EditorView,
  matches: ReturnType<typeof findTextSearchMatches>,
  activeIndex: number
): void {
  if (matches.length === 0) {
    return
  }

  const match = matches[Math.min(activeIndex, matches.length - 1)]

  view.dispatch({
    selection: { anchor: match.from, head: match.to },
    effects: EditorView.scrollIntoView(match.from, { y: 'center', yMargin: 96 })
  })
}

function createEditorTheme(fontSize: number, lineHeight: number): Extension {
  return EditorView.theme({
    '&': {
      height: '100%',
      backgroundColor: 'var(--surface-base)',
      color: 'var(--text-primary)',
      fontSize: `${fontSize}px`
    },
    '.cm-scroller': {
      fontFamily:
        'JetBrains Mono, ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace'
    },
    '.cm-content': {
      maxWidth: '720px',
      minHeight: '100%',
      margin: '0 auto',
      padding: '32px 12px 120px'
    },
    '.cm-line': {
      lineHeight: String(lineHeight)
    },
    '.cm-line span': {
      textDecoration: 'none !important',
      textDecorationLine: 'none !important',
      borderBottom: '0 !important'
    },
    '.cm-line .cm-header, .cm-line .cm-heading': {
      textDecoration: 'none !important',
      textDecorationLine: 'none !important',
      borderBottom: '0 !important'
    },
    '.cm-gutters': {
      backgroundColor: 'var(--surface-base)',
      borderRight: '1px solid var(--line-strong)',
      color: 'var(--text-tertiary)'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--brand-soft)',
      color: 'var(--brand-active)'
    }
  })
}

function getCursorPosition(view: EditorView): CursorPosition {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)

  return {
    line: line.number,
    column: head - line.from + 1
  }
}

function getScrollRatio(scrollElement: HTMLElement): number {
  const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight

  if (maxScrollTop <= 0) {
    return 0
  }

  return scrollElement.scrollTop / maxScrollTop
}
