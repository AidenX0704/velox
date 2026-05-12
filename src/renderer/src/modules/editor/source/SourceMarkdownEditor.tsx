import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { searchKeymap } from '@codemirror/search'
import { Compartment, EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from '@codemirror/view'
import type { CursorPosition } from '../model/types'

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

const markdownKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => wrapSelection(v, '**', '**') },
  { key: 'Mod-i', run: (v) => wrapSelection(v, '*', '*') },
  { key: 'Mod-d', run: (v) => wrapSelection(v, '~~', '~~') },
  { key: 'Mod-`', run: (v) => wrapSelection(v, '`', '`') },
  {
    key: 'Mod-k',
    run: (v) => {
      const { from, to } = v.state.selection.main
      const selected = v.state.sliceDoc(from, to)
      const url = window.prompt('请输入链接地址:', 'https://')
      if (!url) return false
      const text = selected || window.prompt('请输入链接文本:', '') || ''
      if (!text) return false
      const replacement = `[${text}](${url})`
      v.dispatch({
        changes: { from, to, insert: replacement },
        selection: { anchor: from + 1, head: from + 1 + text.length }
      })
      return true
    }
  },
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
  onChange: (value: string) => void
  onCursorChange: (position: CursorPosition) => void
  onScrollRatioChange?: (ratio: number) => void
}

export interface SourceMarkdownEditorHandle {
  scrollToRatio: (ratio: number) => void
  scrollToLine: (line: number) => void
  getVisibleLine: () => number
  getLineCount: () => number
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
    onChange,
    onCursorChange,
    onScrollRatioChange
  },
  ref
): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onCursorChangeRef = useRef(onCursorChange)
  const onScrollRatioChangeRef = useRef(onScrollRatioChange)
  const valueRef = useRef(value)
  const initialOptionsRef = useRef({ fontSize, lineHeight, showLineNumbers, wordWrap })
  const lineNumbersCompartmentRef = useRef(new Compartment())
  const wrappingCompartmentRef = useRef(new Compartment())
  const themeCompartmentRef = useRef(new Compartment())

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange
  }, [onCursorChange])

  useEffect(() => {
    onScrollRatioChangeRef.current = onScrollRatioChange
  }, [onScrollRatioChange])

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
        effects: EditorView.scrollIntoView(position, { y: 'start', yMargin: 24 })
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
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        markdownKeymap,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const nextValue = update.state.doc.toString()
            valueRef.current = nextValue
            onChangeRef.current(nextValue)
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
    }

    viewRef.current = view
    view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })
    onCursorChangeRef.current(getCursorPosition(view))

    return () => {
      view.scrollDOM.removeEventListener('scroll', handleScroll)
      view.destroy()
      viewRef.current = null
    }
  }, [])

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
