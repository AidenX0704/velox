import MarkdownIt from 'markdown-it'
import multimdTable from 'markdown-it-multimd-table'

const multimdTableRenderer = new MarkdownIt('commonmark', {
  html: false,
  breaks: false
})
  .enable('table')
  .use(multimdTable, {
    rowspan: true,
    multiline: false,
    headerless: false,
    multibody: true
  })

const fencePattern = /^\s*(`{3,}|~{3,})/

export function renderMultimdTableBlocks(markdown: string): string {
  const lines = markdown.split('\n')
  const output: string[] = []
  let fence: { marker: string; length: number } | null = null

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const fenceMatch = fencePattern.exec(line)

    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      const length = fenceMatch[1].length

      if (!fence) {
        fence = { marker, length }
      } else if (fence.marker === marker && length >= fence.length) {
        fence = null
      }

      output.push(line)
      continue
    }

    if (!fence && isTableStart(lines, index)) {
      let end = index + 2

      while (end < lines.length && isTableRow(lines[end])) {
        end += 1
      }

      const tableSource = lines.slice(index, end).join('\n')

      if (hasMergedCellSyntax(tableSource)) {
        const rendered = normalizeRenderedTable(multimdTableRenderer.render(tableSource).trim())

        if (rendered.startsWith('<table>')) {
          output.push(rendered)
          index = end - 1
          continue
        }
      }
    }

    output.push(line)
  }

  return output.join('\n')
}

function isTableStart(lines: string[], index: number): boolean {
  return isTableRow(lines[index]) && isTableDelimiter(lines[index + 1] ?? '')
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim()

  return trimmed.length > 0 && trimmed.includes('|')
}

function isTableDelimiter(line: string): boolean {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const columns = trimmed.split('|').map((column) => column.trim())

  return columns.length >= 2 && columns.every((column) => /^:?-{3,}:?$/.test(column))
}

function hasMergedCellSyntax(source: string): boolean {
  return /(^|[^\\])\|\|/.test(source) || /(^|\|)\s*\^\^\s*(?=\|)/m.test(source)
}

function normalizeRenderedTable(html: string): string {
  return html.replace(
    /\sstyle="text-align:\s*(left|center|right);?"/gi,
    (_, alignment: string) => ` align="${alignment.toLowerCase()}"`
  )
}
