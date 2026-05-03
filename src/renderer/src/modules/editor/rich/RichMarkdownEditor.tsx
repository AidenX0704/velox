import { useEffect, useRef, useState } from 'react'
import katex from 'katex'
import MarkdownIt from 'markdown-it'
import texmath from 'markdown-it-texmath'
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
import {
  type InputRule,
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule
} from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownParser,
  MarkdownSerializer,
  schema as markdownSchema
} from 'prosemirror-markdown'
import { type Mark, type Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import { EditorState } from 'prosemirror-state'
import { columnResizing, goToNextCell, tableEditing, tableNodes } from 'prosemirror-tables'
import { EditorView } from 'prosemirror-view'
import { openEditorLink, scrollToEditorAnchor } from '../services/linkNavigation'
import type { EditorLinkNavigationOptions } from '../services/linkNavigation'
import { getCodeBlockActionButton, handleCodeBlockAction } from '../rendering/blockActions'
import { createCodeBlockNodeView } from './nodeViews/codeBlockNodeView'
import { FormatToolbar } from './FormatToolbar'
import type { CursorPosition, MarkdownEditorPreferences } from '../model/types'

interface RichMarkdownEditorProps {
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

const schema = createMarkdownSchema()
const markdownParser = createMarkdownParser()
const markdownSerializer = createMarkdownSerializer()

export function RichMarkdownEditor({
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
  const [fontSize, setFontSize] = useState(settings.previewFontSize)
  const [editorView, setEditorView] = useState<EditorView | null>(null)

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
        code_block: (node) => createCodeBlockNodeView(node)
      },
      dispatchTransaction(transaction) {
        const nextState = view.state.apply(transaction)
        view.updateState(nextState)

        if (transaction.docChanged) {
          const markdown = markdownSerializer.serialize(nextState.doc)
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
      <FormatToolbar view={editorView} fontSize={fontSize} onFontSizeChange={setFontSize} />
      <div ref={hostRef} className="preview-edit-prosemirror" />
    </div>
  )
}

function createMarkdownSchema(): Schema {
  return new Schema({
    nodes: markdownSchema.spec.nodes
      .append({
        math_block: {
          content: 'text*',
          group: 'block',
          code: true,
          defining: true,
          marks: '',
          parseDOM: [{ tag: 'pre[data-math-block]' }],
          toDOM: () => [
            'pre',
            { class: 'velox-math-block', 'data-math-block': 'true' },
            ['code', 0]
          ]
        }
      })
      .append(
        tableNodes({
          tableGroup: 'block',
          cellContent: 'inline*',
          cellAttributes: {}
        })
      ),
    marks: markdownSchema.spec.marks.append({
      strikethrough: {
        parseDOM: [
          { tag: 's' },
          { tag: 'del' },
          { tag: 'strike' },
          { style: 'text-decoration=line-through' }
        ],
        toDOM: () => ['del']
      },
      math_inline: {
        inclusive: false,
        code: true,
        parseDOM: [{ tag: 'span[data-math-inline]' }],
        toDOM: () => ['span', { class: 'velox-inline-math', 'data-math-inline': 'true' }, 0]
      }
    })
  })
}

function createMarkdownParser(): MarkdownParser {
  const tokenizer = new MarkdownIt('commonmark', {
    html: false,
    breaks: false
  })
    .enable('table')
    .use(texmath, {
      engine: katex,
      delimiters: ['dollars', 'brackets', 'beg_end', 'gitlab'],
      katexOptions: {
        throwOnError: false,
        strict: false,
        trust: false
      }
    })

  tokenizer.inline.ruler.push('strikethrough', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x7e || state.src.charCodeAt(state.pos + 1) !== 0x7e) return false
    const start = state.pos + 2
    let end = start
    while (end < state.posMax) {
      if (state.src.charCodeAt(end) === 0x7e && state.src.charCodeAt(end + 1) === 0x7e) break
      end++
    }
    if (end >= state.posMax) return false
    if (!silent) {
      const token = state.push('s_open', 's', 1)
      token.markup = '~~'
      const token2 = state.push('text', '', 0)
      token2.content = state.src.slice(start, end)
      const token3 = state.push('s_close', 's', -1)
      token3.markup = '~~'
    }
    state.pos = end + 2
    return true
  })

  tokenizer.core.ruler.push('velox_normalize_math', (state) => {
    for (const token of state.tokens) {
      if (token.type === 'math_block') {
        token.content = token.content.trim()
      }
    }
  })

  return new MarkdownParser(schema, tokenizer, {
    ...defaultMarkdownParser.tokens,
    table: { block: 'table' },
    tr: { block: 'table_row' },
    th: { block: 'table_header' },
    td: { block: 'table_cell' },
    thead: { ignore: true },
    tbody: { ignore: true },
    s: { mark: 'strikethrough' },
    math_block: { block: 'math_block', noCloseToken: true },
    math_inline: { mark: 'math_inline', noCloseToken: true }
  })
}

function createMarkdownSerializer(): MarkdownSerializer {
  return new MarkdownSerializer(
    {
      ...defaultMarkdownSerializer.nodes,
      table(state, node) {
        writeMarkdownTable(state, node)
      },
      math_block(state, node) {
        state.ensureNewLine()
        state.write('$$\n')
        state.text(node.textContent.trim(), false)
        state.ensureNewLine()
        state.write('$$')
        state.closeBlock(node)
      }
    },
    {
      ...defaultMarkdownSerializer.marks,
      strikethrough: {
        open: '~~',
        close: '~~',
        escape: false
      },
      math_inline: {
        open: '$',
        close: '$',
        escape: false
      }
    }
  )
}

const insertLinkCommand = (state: EditorState, dispatch?: (tr: import('prosemirror-state').Transaction) => void): boolean => {
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
  try {
    return markdownParser.parse(markdown || '')
  } catch {
    return markdownParser.parse('')
  }
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

function createMarkdownInputRules(): InputRule[] {
  return [
    wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, (match) => ({
      order: Number(match[1])
    })),
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, (match) => ({
      level: match[1].length
    })),
    textblockTypeInputRule(/^```$/, schema.nodes.code_block)
  ]
}

function writeMarkdownTable(
  state: Parameters<MarkdownSerializer['nodes']['table']>[0],
  tableNode: ProseMirrorNode
): void {
  const rows: string[][] = []

  tableNode.forEach((rowNode) => {
    const row: string[] = []

    rowNode.forEach((cellNode) => {
      row.push(serializeTableCell(cellNode))
    })

    if (row.length > 0) {
      rows.push(row)
    }
  })

  if (rows.length === 0) {
    return
  }

  const columnCount = Math.max(...rows.map((row) => row.length))
  const normalizedRows = rows.map((row) => normalizeTableRow(row, columnCount))

  state.ensureNewLine()
  state.write(formatTableRow(normalizedRows[0]))
  state.write('\n')
  state.write(formatTableRow(Array.from({ length: columnCount }, () => '---')))

  for (const row of normalizedRows.slice(1)) {
    state.write('\n')
    state.write(formatTableRow(row))
  }

  state.closeBlock(tableNode)
}

function normalizeTableRow(row: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => row[index] ?? '')
}

function formatTableRow(row: string[]): string {
  return `| ${row.map((cell) => cell.trim() || ' ').join(' | ')} |`
}

function serializeTableCell(cellNode: ProseMirrorNode): string {
  const parts: string[] = []

  cellNode.forEach((childNode) => {
    if (childNode.isText) {
      parts.push(serializeMarkedText(childNode.text ?? '', childNode.marks))
      return
    }

    if (childNode.type.name === 'hard_break') {
      parts.push('<br>')
      return
    }

    parts.push(escapeTableCell(childNode.textContent))
  })

  return parts.join('')
}

function serializeMarkedText(text: string, marks: readonly Mark[]): string {
  let output = escapeTableCell(text)

  for (const mark of [...marks].reverse()) {
    if (mark.type.name === 'strong') {
      output = `**${output}**`
    } else if (mark.type.name === 'em') {
      output = `*${output}*`
    } else if (mark.type.name === 'code') {
      output = `\`${output.replace(/`/g, '\\`')}\``
    } else if (mark.type.name === 'link') {
      const href = String(mark.attrs.href ?? '')
      const title = mark.attrs.title ? ` "${String(mark.attrs.title).replace(/"/g, '\\"')}"` : ''
      output = `[${output}](${href}${title})`
    } else if (mark.type.name === 'math_inline') {
      output = `$${output}$`
    }
  }

  return output
}

function escapeTableCell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function getCursorPosition(doc: ProseMirrorNode, position: number): CursorPosition {
  const textBeforeCursor = doc.textBetween(0, position, '\n', '\n')
  const lines = textBeforeCursor.split('\n')

  return {
    line: Math.max(lines.length, 1),
    column: (lines.at(-1)?.length ?? 0) + 1
  }
}
