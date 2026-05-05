import katex from 'katex'
import MarkdownIt from 'markdown-it'
import texmath from 'markdown-it-texmath'
import {
  InputRule,
  textblockTypeInputRule,
  wrappingInputRule
} from 'prosemirror-inputrules'
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownParser,
  MarkdownSerializer,
  schema as markdownSchema
} from 'prosemirror-markdown'
import { type Mark, type Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { tableNodes } from 'prosemirror-tables'

export const richMarkdownSchema = createMarkdownSchema()
const markdownParser = createMarkdownParser()
const markdownSerializer = createMarkdownSerializer()

export function parseRichMarkdown(markdown: string): ProseMirrorNode {
  try {
    return markdownParser.parse(markdown || '')
  } catch {
    return markdownParser.parse('')
  }
}

export function serializeRichMarkdown(doc: ProseMirrorNode): string {
  return markdownSerializer.serialize(doc)
}

export function normalizeRichMarkdown(markdown: string): string {
  return serializeRichMarkdown(parseRichMarkdown(markdown))
}

export function createMarkdownInputRules(): InputRule[] {
  return [
    wrappingInputRule(/^\s*>\s$/, richMarkdownSchema.nodes.blockquote),
    taskListItemInputRule(/^\s*[-+*]\s\[( |x|X)\]\s$/),
    wrappingInputRule(/^\s*([-+*])\s$/, richMarkdownSchema.nodes.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, richMarkdownSchema.nodes.ordered_list, (match) => ({
      order: Number(match[1])
    })),
    textblockTypeInputRule(/^(#{1,6})\s$/, richMarkdownSchema.nodes.heading, (match) => ({
      level: match[1].length
    })),
    textblockTypeInputRule(/^```$/, richMarkdownSchema.nodes.code_block),
    horizontalRuleInputRule(/^(---|\*\*\*)\s$/),
    horizontalRuleInputRule(/^(--|\*\*)[-*]$/)
  ]
}

function taskListItemInputRule(regexp: RegExp): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const $start = state.doc.resolve(start)
    const blockStart = $start.before()
    const blockEnd = $start.after()
    const paragraph = richMarkdownSchema.nodes.paragraph.create()
    const item = richMarkdownSchema.nodes.list_item.create(
      { checked: match[1].toLowerCase() === 'x' },
      paragraph
    )
    const list = richMarkdownSchema.nodes.bullet_list.create(null, item)
    const tr = state.tr.delete(start, end).replaceWith(blockStart, blockEnd, list)

    return tr.setSelection(TextSelection.create(tr.doc, blockStart + 3))
  })
}

function horizontalRuleInputRule(regexp: RegExp): InputRule {
  return new InputRule(regexp, (state, _match, start, end) => {
    const $start = state.doc.resolve(start)
    const blockStart = $start.before()
    const blockEnd = $start.after()
    const index = $start.index($start.depth - 1)
    const parent = $start.node($start.depth - 1)

    if (!parent.canReplaceWith(index, index + 1, richMarkdownSchema.nodes.horizontal_rule)) {
      return null
    }

    return state.tr
      .delete(start, end)
      .replaceWith(blockStart, blockEnd, richMarkdownSchema.nodes.horizontal_rule.create())
  })
}

function createMarkdownSchema(): Schema {
  return new Schema({
    nodes: markdownSchema.spec.nodes
      .update('list_item', {
        content: 'block+',
        defining: true,
        attrs: { checked: { default: null } },
        parseDOM: [
          {
            tag: 'li',
            getAttrs(dom) {
              if (!(dom instanceof HTMLElement) || !dom.hasAttribute('data-task-checked')) {
                return { checked: null }
              }

              return { checked: dom.getAttribute('data-task-checked') === 'true' }
            }
          }
        ],
        toDOM(node) {
          return [
            'li',
            node.attrs.checked === null
              ? {}
              : {
                  class: 'task-list-item',
                  'data-task-checked': String(Boolean(node.attrs.checked))
                },
            0
          ]
        }
      })
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
    if (state.src.charCodeAt(state.pos) !== 0x7e || state.src.charCodeAt(state.pos + 1) !== 0x7e)
      return false
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

  tokenizer.core.ruler.after('inline', 'velox_task_list_items', (state) => {
    for (let index = 2; index < state.tokens.length; index++) {
      const inlineToken = state.tokens[index]
      const paragraphToken = state.tokens[index - 1]
      const listItemToken = state.tokens[index - 2]

      if (
        inlineToken.type !== 'inline' ||
        paragraphToken.type !== 'paragraph_open' ||
        listItemToken.type !== 'list_item_open'
      ) {
        continue
      }

      const match = /^\[( |x|X)\]\s/.exec(inlineToken.content)

      if (!match) {
        continue
      }

      setTokenAttr(listItemToken, 'data-task-checked', String(match[1].toLowerCase() === 'x'))
      inlineToken.content = inlineToken.content.slice(match[0].length)

      const firstChild = inlineToken.children?.[0]

      if (firstChild?.type === 'text') {
        firstChild.content = firstChild.content.slice(match[0].length)
      }
    }
  })

  tokenizer.core.ruler.push('velox_normalize_math', (state) => {
    for (const token of state.tokens) {
      if (token.type === 'math_block') {
        token.content = token.content.trim()
      }
    }
  })

  return new MarkdownParser(richMarkdownSchema, tokenizer, {
    ...defaultMarkdownParser.tokens,
    list_item: {
      block: 'list_item',
      getAttrs: (token) => {
        const checked = getTokenAttr(token, 'data-task-checked')
        return { checked: checked === null ? null : checked === 'true' }
      }
    },
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
      bullet_list(state, node) {
        renderBulletList(state, node)
      },
      list_item(state, node) {
        state.renderContent(node)
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

function setTokenAttr(token: { attrs: [string, string][] | null }, name: string, value: string): void {
  const attrs = token.attrs ?? []
  const index = attrs.findIndex((attr) => attr[0] === name)

  if (index >= 0) {
    attrs[index] = [name, value]
  } else {
    attrs.push([name, value])
  }

  token.attrs = attrs
}

function getTokenAttr(token: { attrs: [string, string][] | null }, name: string): string | null {
  return token.attrs?.find((attr) => attr[0] === name)?.[1] ?? null
}

function renderBulletList(
  state: Parameters<MarkdownSerializer['nodes']['bullet_list']>[0],
  node: ProseMirrorNode
): void {
  state.renderList(node, '  ', (index: number) => {
    const child = node.child(index)

    if (child.attrs.checked === true) {
      return '- [x] '
    }

    if (child.attrs.checked === false) {
      return '- [ ] '
    }

    return `${node.attrs.bullet || '*'} `
  })
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
