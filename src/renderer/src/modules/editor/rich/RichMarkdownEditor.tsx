import { useEffect, useMemo, useRef, useState } from 'react'
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
import { EditorState } from 'prosemirror-state'
import { columnResizing, goToNextCell, tableEditing } from 'prosemirror-tables'
import { EditorView } from 'prosemirror-view'
import { IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons'
import { openEditorLink, scrollToEditorAnchor } from '../services/linkNavigation'
import type { EditorLinkNavigationOptions } from '../services/linkNavigation'
import { getCodeBlockActionButton, handleCodeBlockAction } from '../rendering/blockActions'
import { collectHeadingAnchors, type HeadingAnchor } from '../rendering/headingAnchors'
import { createCodeBlockNodeView } from './nodeViews/codeBlockNodeView'
import { createTaskListItemNodeView } from './nodeViews/taskListItemNodeView'
import { FormatToolbar } from './FormatToolbar'
import type { CursorPosition, MarkdownEditorPreferences } from '../model/types'
import {
  createMarkdownInputRules,
  parseRichMarkdown,
  richMarkdownSchema as schema,
  serializeRichMarkdown
} from './markdownModel'

interface RichMarkdownEditorProps {
  documentTitle: string
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

export function RichMarkdownEditor({
  documentTitle,
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
}: RichMarkdownEditorProps): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contentRef = useRef(content)
  const initialContentRef = useRef(content)
  const onChangeRef = useRef(onChange)
  const onCursorChangeRef = useRef(onCursorChange)
  const linkNavigationRef = useRef<EditorLinkNavigationOptions>({})
  const headingAnchors = useMemo(() => collectHeadingAnchors(content), [content])
  const [fontSize, setFontSize] = useState(settings.previewFontSize)
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const [navCollapsed, setNavCollapsed] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange
  }, [onCursorChange])

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
      state: createEditorState(initialContentRef.current),
      attributes: {
        spellcheck: 'false',
        autocorrect: 'off',
        autocomplete: 'off',
        autocapitalize: 'off',
        translate: 'no'
      },
      nodeViews: {
        code_block: (node) => createCodeBlockNodeView(node),
        list_item: (node, view, getPos) =>
          createTaskListItemNodeView(node, view, getPos as () => number | undefined)
      },
      dispatchTransaction(transaction) {
        const nextState = view.state.apply(transaction)
        view.updateState(nextState)

        if (transaction.docChanged) {
          const markdown = serializeRichMarkdown(nextState.doc)
          contentRef.current = markdown
          onChangeRef.current(markdown)
        }

        if (transaction.selectionSet || transaction.docChanged) {
          onCursorChangeRef.current(getCursorPosition(nextState.doc, nextState.selection.from))
        }
      }
    })

    viewRef.current = view
    setEditorView(view)
    contentRef.current = initialContentRef.current
    onCursorChangeRef.current(getCursorPosition(view.state.doc, view.state.selection.from))

    const handleMouseDown = (event: MouseEvent): void => {
      handleRichEditorMouseDown(hostElement, event)
    }
    const handleClick = (event: MouseEvent): void => {
      handleRichEditorClick(hostElement, event, linkNavigationRef.current)
    }

    hostElement.addEventListener('mousedown', handleMouseDown, true)
    hostElement.addEventListener('click', handleClick, true)

    return () => {
      hostElement.removeEventListener('mousedown', handleMouseDown, true)
      hostElement.removeEventListener('click', handleClick, true)
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

    view.updateState(createEditorState(content))
    contentRef.current = content
    onCursorChangeRef.current(getCursorPosition(view.state.doc, view.state.selection.from))
  }, [content])

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
      <aside
        className="preview-edit-nav-card"
        data-collapsed={navCollapsed}
        aria-label="文档标题导航"
      >
        <header className="preview-edit-nav-header">
          <span className="preview-edit-nav-title" title={documentTitle}>
            {documentTitle}
          </span>
          {dirty ? <span className="preview-edit-nav-dirty" aria-label="未保存" /> : null}
          <button
            className="preview-edit-nav-toggle"
            type="button"
            aria-label={navCollapsed ? '展开标题导航' : '收起标题导航'}
            aria-expanded={!navCollapsed}
            onClick={() => setNavCollapsed((current) => !current)}
          >
            {navCollapsed ? <IconChevronDown /> : <IconChevronUp />}
          </button>
        </header>
        {!navCollapsed ? (
          <nav className="preview-edit-heading-nav" aria-label="标题列表">
            {headingAnchors.length > 0 ? (
              headingAnchors.map((heading) => (
                <button
                  key={`${heading.slug}-${heading.index}`}
                  className="preview-edit-heading-nav-item"
                  data-level={heading.level}
                  type="button"
                  title={heading.text}
                  onClick={() => scrollToHeading(heading)}
                >
                  <span className="preview-edit-heading-nav-marker">H{heading.level}</span>
                  <span className="preview-edit-heading-nav-text">{heading.text}</span>
                </button>
              ))
            ) : (
              <span className="preview-edit-heading-nav-empty">无标题</span>
            )}
          </nav>
        ) : null}
      </aside>
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

function createEditorState(markdown: string): EditorState {
  return EditorState.create({
    doc: parseMarkdown(markdown),
    plugins: [
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
