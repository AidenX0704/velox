import { app, BrowserWindow, dialog } from 'electron'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encode as encodeJpeg } from 'jpeg-js'
import { PNG } from 'pngjs'
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild
} from 'docx'
import katex from 'katex'
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import multimdTable from 'markdown-it-multimd-table'
import taskLists from 'markdown-it-task-lists'
import texmath from 'markdown-it-texmath'
import type {
  ExportDocumentInput,
  ExportDocumentResult,
  ExportFormat,
  ExportPdfPageSize,
  ExportProgress,
  ExportProgressStage
} from '../../shared/export'
import { VeloxError } from '../shared/errors'

const exportExtensions: Record<ExportFormat, string> = {
  html: 'html',
  pdf: 'pdf',
  png: 'png',
  jpeg: 'jpg',
  docx: 'docx'
}

const exportFilters: Record<ExportFormat, Electron.FileFilter[]> = {
  html: [
    { name: 'HTML', extensions: ['html', 'htm'] },
    { name: 'All Files', extensions: ['*'] }
  ],
  pdf: [
    { name: 'PDF', extensions: ['pdf'] },
    { name: 'All Files', extensions: ['*'] }
  ],
  png: [
    { name: 'PNG Image', extensions: ['png'] },
    { name: 'All Files', extensions: ['*'] }
  ],
  jpeg: [
    { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
    { name: 'All Files', extensions: ['*'] }
  ],
  docx: [
    { name: 'Word Document', extensions: ['docx'] },
    { name: 'All Files', extensions: ['*'] }
  ]
}

const exportViewportWidth = 980
const imageTileTargetPixelHeight = 1800
const imageTileOverlapCss = 32
const maxImagePixels = 240_000_000

type ExportProgressReporter = (progress: ExportProgress) => void

export class ExportService {
  async exportDocument(
    input: ExportDocumentInput,
    reportProgress?: ExportProgressReporter
  ): Promise<ExportDocumentResult | null> {
    reportExportProgress(reportProgress, 'resolving', 2, '选择导出位置')
    const filePath = await this.resolveSavePath(input)

    if (!filePath) {
      return null
    }

    if (input.format === 'docx') {
      reportExportProgress(reportProgress, 'preparing', 18, '解析 Markdown 内容')
      const buffer = await createDocxBuffer(input)
      reportExportProgress(reportProgress, 'writing', 92, '写入 Word 文件')
      await writeFile(filePath, buffer)
      reportExportProgress(reportProgress, 'done', 100, '导出完成')
      return { path: filePath, format: input.format }
    }

    reportExportProgress(reportProgress, 'preparing', 12, '生成导出页面')
    const html = await createExportHtml(input)

    if (input.format === 'html') {
      reportExportProgress(reportProgress, 'writing', 88, '写入 HTML 文件')
      await writeFile(filePath, html, 'utf8')
      reportExportProgress(reportProgress, 'done', 100, '导出完成')
      return { path: filePath, format: input.format }
    }

    if (input.format === 'pdf') {
      const buffer = await renderPdf(html, input.pdfPageSize ?? 'A4', reportProgress)
      reportExportProgress(reportProgress, 'writing', 92, '写入 PDF 文件')
      await writeFile(filePath, buffer)
      reportExportProgress(reportProgress, 'done', 100, '导出完成')
      return { path: filePath, format: input.format }
    }

    const imageBuffer = await renderImage(html, input.format, input.imageScale ?? 2, reportProgress)
    reportExportProgress(reportProgress, 'writing', 92, '写入图片文件')
    await writeFile(filePath, imageBuffer)
    reportExportProgress(reportProgress, 'done', 100, '导出完成')

    return { path: filePath, format: input.format }
  }

  private async resolveSavePath(input: ExportDocumentInput): Promise<string | null> {
    const result = await dialog.showSaveDialog({
      title: `Export ${input.format.toUpperCase()}`,
      defaultPath: createDefaultExportPath(input),
      filters: exportFilters[input.format]
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    return ensureExtension(result.filePath, exportExtensions[input.format])
  }
}

async function renderPdf(
  html: string,
  pageSize: ExportPdfPageSize,
  reportProgress?: ExportProgressReporter
): Promise<Buffer> {
  const window = createExportWindow(1200)

  try {
    reportExportProgress(reportProgress, 'rendering', 32, '加载 PDF 渲染页面')
    await loadExportHtml(window, html)
    reportExportProgress(reportProgress, 'rendering', 72, '生成 PDF 内容')

    return await window.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize,
      margins: {
        marginType: 'default'
      }
    })
  } finally {
    window.destroy()
  }
}

async function renderImage(
  html: string,
  format: Extract<ExportFormat, 'png' | 'jpeg'>,
  scale: number,
  reportProgress?: ExportProgressReporter
): Promise<Buffer> {
  const safeScale = Math.min(Math.max(scale, 1), 3)
  const tileViewportHeight = Math.max(640, Math.floor(imageTileTargetPixelHeight / safeScale))
  const window = createExportWindow(tileViewportHeight)

  try {
    reportExportProgress(reportProgress, 'rendering', 24, '加载图片渲染页面')
    await loadExportHtml(window, html)
    window.webContents.setZoomFactor(safeScale)

    const dimensions = await getDocumentDimensions(window)
    const finalWidthEstimate = Math.ceil(exportViewportWidth * safeScale)
    const finalHeightEstimate = Math.ceil(dimensions.height * safeScale)

    if (finalWidthEstimate * finalHeightEstimate > maxImagePixels) {
      throw new VeloxError(
        'EXPORT_IMAGE_TOO_LARGE',
        '当前图片导出尺寸过大，请降低图片倍率或导出 PDF。'
      )
    }

    window.setContentSize(exportViewportWidth, Math.min(tileViewportHeight, dimensions.height))
    await waitForExportPage(window)

    const positions = createImageTilePositions(dimensions.height, tileViewportHeight)
    const tiles: ImageTile[] = []
    let copiedCssBottom = 0

    for (let index = 0; index < positions.length; index += 1) {
      const y = positions[index]
      const captureHeightCss = Math.min(tileViewportHeight, Math.ceil(dimensions.height - y))

      await scrollExportWindow(window, y)

      const image = await window.webContents.capturePage({
        x: 0,
        y: 0,
        width: exportViewportWidth,
        height: captureHeightCss
      })
      const tile = PNG.sync.read(image.toPNG())
      const scaleRatio = tile.height / captureHeightCss
      const cropTopCss = Math.max(0, copiedCssBottom - y)
      const sourceY = Math.min(tile.height, Math.round(cropTopCss * scaleRatio))
      const copyHeight = tile.height - sourceY

      if (copyHeight > 0) {
        tiles.push({ png: tile, sourceY, copyHeight })
        copiedCssBottom = Math.max(copiedCssBottom, y + captureHeightCss)
      }

      const tilePercent = 28 + ((index + 1) / positions.length) * 48
      reportExportProgress(
        reportProgress,
        'rendering',
        tilePercent,
        `截取图片分片 ${index + 1}/${positions.length}`
      )
    }

    reportExportProgress(reportProgress, 'compositing', 82, '合成完整图片')
    return composeImageTiles(tiles, format)
  } finally {
    window.destroy()
  }
}

interface ImageTile {
  png: PNG
  sourceY: number
  copyHeight: number
}

function createImageTilePositions(totalHeight: number, tileHeight: number): number[] {
  if (totalHeight <= tileHeight) {
    return [0]
  }

  const positions: number[] = []
  const step = Math.max(1, tileHeight - imageTileOverlapCss)
  let y = 0

  while (y < totalHeight) {
    positions.push(y)

    if (y + tileHeight >= totalHeight) {
      break
    }

    const nextY = Math.min(y + step, Math.max(0, totalHeight - tileHeight))

    if (nextY === y) {
      break
    }

    y = nextY
  }

  return positions
}

async function scrollExportWindow(window: BrowserWindow, y: number): Promise<void> {
  await window.webContents.executeJavaScript(`
    window.scrollTo(0, ${Math.max(0, Math.floor(y))});
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  `)
}

function composeImageTiles(
  tiles: ImageTile[],
  format: Extract<ExportFormat, 'png' | 'jpeg'>
): Buffer {
  if (tiles.length === 0) {
    throw new VeloxError('EXPORT_IMAGE_EMPTY', '未生成任何图片内容。')
  }

  const width = Math.max(...tiles.map((tile) => tile.png.width))
  const height = tiles.reduce((sum, tile) => sum + tile.copyHeight, 0)
  const output = new PNG({ width, height, fill: true })
  let targetY = 0

  for (const tile of tiles) {
    PNG.bitblt(tile.png, output, 0, tile.sourceY, tile.png.width, tile.copyHeight, 0, targetY)
    targetY += tile.copyHeight
  }

  if (format === 'png') {
    return PNG.sync.write(output)
  }

  return encodeJpeg({ data: output.data, width: output.width, height: output.height }, 92).data
}

function createExportWindow(height: number): BrowserWindow {
  return new BrowserWindow({
    show: false,
    width: exportViewportWidth,
    height,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
}

function reportExportProgress(
  reporter: ExportProgressReporter | undefined,
  stage: ExportProgressStage,
  percent: number,
  message: string
): void {
  reporter?.({
    stage,
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    message
  })
}

async function loadExportHtml(window: BrowserWindow, html: string): Promise<void> {
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await waitForExportPage(window)
}

async function waitForExportPage(window: BrowserWindow): Promise<void> {
  await window.webContents.executeJavaScript(`
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      Promise.all(Array.from(document.images).map((image) => {
        if (image.complete) return Promise.resolve()
        return new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true })
          image.addEventListener('error', resolve, { once: true })
        })
      }))
    ]).then(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    }))
  `)
}

async function getDocumentDimensions(
  window: BrowserWindow
): Promise<{ width: number; height: number }> {
  return window.webContents.executeJavaScript(`
    ({
      width: Math.ceil(Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)),
      height: Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
    })
  `)
}

async function createExportHtml(input: ExportDocumentInput): Promise<string> {
  const renderedHtml = await renderMarkdownExportHtml(input.content, input.sourcePath)
  const customCss = input.includeCustomCss !== false ? input.customCss?.trim() : ''
  const pageSize = input.pdfPageSize ?? 'A4'

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: file: https: http:; style-src 'unsafe-inline'; font-src data: file:;">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)}</title>
  <style>${createExportCss(pageSize)}</style>
  ${customCss ? `<style>${customCss}</style>` : ''}
</head>
<body>
  <main class="markdown markdown-export">
    ${renderedHtml}
  </main>
</body>
</html>`
}

function createMarkdownRenderer(): MarkdownIt {
  const markdown = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight(code, language) {
      const languageClass = language ? ` class="language-${escapeHtml(language)}"` : ''

      return `<pre class="markdown-code-block"><code${languageClass}>${escapeHtml(code)}</code></pre>`
    }
  })

  markdown
    .use(taskLists, { enabled: true, label: true, labelAfter: true })
    .use(multimdTable, {
      multiline: true,
      rowspan: true,
      headerless: true,
      multibody: true,
      autolabel: true
    })
    .use(texmath, {
      engine: katex,
      delimiters: 'dollars',
      katexOptions: { throwOnError: false }
    })

  return markdown
}

async function renderMarkdownExportHtml(content: string, sourcePath?: string): Promise<string> {
  const html = createMarkdownRenderer().render(content)

  return replaceLocalImageSources(html, sourcePath)
}

async function replaceLocalImageSources(html: string, sourcePath?: string): Promise<string> {
  const imageSrcPattern = /(<img\b[^>]*\bsrc=")([^"]+)("[^>]*>)/gi
  let result = ''
  let lastIndex = 0

  for (const match of html.matchAll(imageSrcPattern)) {
    const index = match.index ?? 0
    const src = decodeHtmlAttribute(match[2])
    const replacement = await toLocalImageDataUrl(src, sourcePath)

    result += html.slice(lastIndex, index)
    result += `${match[1]}${replacement ?? match[2]}${match[3]}`
    lastIndex = index + match[0].length
  }

  return result + html.slice(lastIndex)
}

async function toLocalImageDataUrl(src: string, sourcePath?: string): Promise<string | null> {
  const imagePath = resolveLocalAssetPath(src, sourcePath)

  if (!imagePath) {
    return null
  }

  try {
    const fileStats = await stat(imagePath)

    if (!fileStats.isFile()) {
      return null
    }

    const buffer = await readFile(imagePath)
    return `data:${getMimeType(imagePath)};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

function resolveLocalAssetPath(src: string, sourcePath?: string): string | null {
  if (!src || src.startsWith('data:') || /^https?:\/\//i.test(src)) {
    return null
  }

  const withoutFragment = src.split('#')[0].split('?')[0]

  if (!withoutFragment) {
    return null
  }

  if (withoutFragment.startsWith('file://')) {
    return fileURLToPath(withoutFragment)
  }

  if (isAbsolute(withoutFragment)) {
    return withoutFragment
  }

  if (!sourcePath) {
    return null
  }

  return resolve(dirname(sourcePath), decodeURIComponent(withoutFragment))
}

function createDocxBuffer(input: ExportDocumentInput): Promise<Buffer> {
  const tokens = createMarkdownRenderer().parse(input.content, {})
  const children = createDocxChildren(tokens)
  const document = new DocxDocument({
    title: input.title,
    creator: 'Velox',
    numbering: {
      config: [
        {
          reference: 'ordered-list',
          levels: [0, 1, 2, 3, 4, 5].map((level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
            style: {
              paragraph: {
                indent: {
                  left: 720 + level * 360,
                  hanging: 260
                }
              }
            }
          }))
        }
      ]
    },
    sections: [
      {
        children: children.length > 0 ? children : [new Paragraph('')],
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        }
      }
    ]
  })

  return Packer.toBuffer(document)
}

function createDocxChildren(tokens: Token[]): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = []
  const listStack: Array<'bullet' | 'ordered'> = []
  let blockquoteLevel = 0

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token.type === 'bullet_list_open') {
      listStack.push('bullet')
      continue
    }

    if (token.type === 'ordered_list_open') {
      listStack.push('ordered')
      continue
    }

    if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
      listStack.pop()
      continue
    }

    if (token.type === 'blockquote_open') {
      blockquoteLevel += 1
      continue
    }

    if (token.type === 'blockquote_close') {
      blockquoteLevel = Math.max(0, blockquoteLevel - 1)
      continue
    }

    if (token.type === 'heading_open') {
      const inlineToken = tokens[index + 1]
      const level = Number(token.tag.slice(1))
      children.push(
        new Paragraph({
          heading: getDocxHeadingLevel(level),
          spacing: { before: level === 1 ? 0 : 260, after: 160 },
          children: createInlineRuns(inlineToken?.children ?? [])
        })
      )
      index = findClosingToken(tokens, index, `heading_close`)
      continue
    }

    if (token.type === 'paragraph_open') {
      const inlineToken = tokens[index + 1]
      const paragraphChildren = createInlineRuns(inlineToken?.children ?? [])
      const listKind = listStack[listStack.length - 1]
      const listLevel = Math.min(Math.max(listStack.length - 1, 0), 5)

      children.push(
        new Paragraph({
          children: paragraphChildren.length > 0 ? paragraphChildren : [new TextRun('')],
          spacing: { after: 160 },
          ...(listKind === 'bullet' ? { bullet: { level: listLevel } } : {}),
          ...(listKind === 'ordered'
            ? { numbering: { reference: 'ordered-list', level: listLevel } }
            : {}),
          ...(blockquoteLevel > 0
            ? {
                indent: { left: 360 * blockquoteLevel },
                border: {
                  left: {
                    color: 'CBD5E1',
                    space: 8,
                    style: BorderStyle.SINGLE,
                    size: 12
                  }
                }
              }
            : {})
        })
      )
      index = findClosingToken(tokens, index, `paragraph_close`)
      continue
    }

    if (token.type === 'fence' || token.type === 'code_block') {
      children.push(createCodeParagraph(token.content))
      continue
    }

    if (token.type === 'hr') {
      children.push(
        new Paragraph({
          border: {
            bottom: {
              color: 'CBD5E1',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 8
            }
          },
          spacing: { before: 120, after: 220 }
        })
      )
      continue
    }

    if (token.type === 'table_open') {
      const parsedTable = createDocxTable(tokens, index)

      if (parsedTable.table) {
        children.push(parsedTable.table)
      }

      index = parsedTable.nextIndex
    }
  }

  return children
}

function createInlineRuns(tokens: Token[] | null): ParagraphChild[] {
  if (!tokens) {
    return []
  }

  return parseInlineRange(tokens, 0, undefined, {})
}

interface InlineRunStyle {
  bold?: boolean
  italics?: boolean
  strike?: boolean
}

function parseInlineRange(
  tokens: Token[],
  startIndex: number,
  stopType: string | undefined,
  style: InlineRunStyle
): ParagraphChild[] {
  const children: ParagraphChild[] = []

  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token.type === stopType) {
      return children
    }

    if (token.type === 'text') {
      children.push(new TextRun({ text: token.content, ...style }))
      continue
    }

    if (token.type === 'code_inline') {
      children.push(
        new TextRun({
          text: token.content,
          font: 'Menlo',
          color: '334155',
          shading: { type: ShadingType.CLEAR, color: 'E2E8F0' }
        })
      )
      continue
    }

    if (token.type === 'softbreak' || token.type === 'hardbreak') {
      children.push(new TextRun({ break: 1 }))
      continue
    }

    if (token.type === 'strong_open') {
      const closeIndex = findClosingToken(tokens, index, 'strong_close')
      children.push(
        ...parseInlineRange(tokens, index + 1, 'strong_close', { ...style, bold: true })
      )
      index = closeIndex
      continue
    }

    if (token.type === 'em_open') {
      const closeIndex = findClosingToken(tokens, index, 'em_close')
      children.push(...parseInlineRange(tokens, index + 1, 'em_close', { ...style, italics: true }))
      index = closeIndex
      continue
    }

    if (token.type === 's_open') {
      const closeIndex = findClosingToken(tokens, index, 's_close')
      children.push(...parseInlineRange(tokens, index + 1, 's_close', { ...style, strike: true }))
      index = closeIndex
      continue
    }

    if (token.type === 'link_open') {
      const closeIndex = findClosingToken(tokens, index, 'link_close')
      const href = token.attrGet('href') ?? ''
      const linkChildren = parseInlineRange(tokens, index + 1, 'link_close', style)

      if (/^https?:\/\//i.test(href)) {
        children.push(
          new ExternalHyperlink({
            link: href,
            children:
              linkChildren.length > 0
                ? linkChildren
                : [new TextRun({ text: href, color: '2563EB', underline: {} })]
          })
        )
      } else {
        children.push(...linkChildren)
      }

      index = closeIndex
      continue
    }

    if (token.type === 'image') {
      const altText = token.content || token.attrGet('alt') || 'image'
      children.push(new TextRun({ text: `[${altText}]`, italics: true, color: '64748B' }))
    }
  }

  return children
}

function createCodeParagraph(code: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 180 },
    shading: { type: ShadingType.CLEAR, color: 'F1F5F9' },
    children: code.split(/\r?\n/).flatMap((line, index) => [
      ...(index > 0 ? [new TextRun({ break: 1 })] : []),
      new TextRun({
        text: line || ' ',
        font: 'Menlo',
        size: 20,
        color: '334155'
      })
    ])
  })
}

function createDocxTable(
  tokens: Token[],
  startIndex: number
): { table: Table | null; nextIndex: number } {
  const rows: TableRow[] = []
  let cells: TableCell[] = []

  for (let index = startIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token.type === 'table_close') {
      return {
        table:
          rows.length > 0
            ? new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              })
            : null,
        nextIndex: index
      }
    }

    if (token.type === 'tr_open') {
      cells = []
      continue
    }

    if (token.type === 'tr_close') {
      rows.push(new TableRow({ children: cells }))
      continue
    }

    if (token.type === 'th_open' || token.type === 'td_open') {
      const inlineToken = findInlineTokenBefore(
        tokens,
        index,
        token.type === 'th_open' ? 'th_close' : 'td_close'
      )
      const isHeader = token.type === 'th_open'

      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              alignment: isHeader ? AlignmentType.CENTER : AlignmentType.START,
              children: createInlineRuns(inlineToken?.children ?? [])
            })
          ],
          shading: isHeader ? { type: ShadingType.CLEAR, color: 'F1F5F9' } : undefined
        })
      )

      index = findClosingToken(tokens, index, token.type === 'th_open' ? 'th_close' : 'td_close')
    }
  }

  return { table: null, nextIndex: startIndex }
}

function findInlineTokenBefore(
  tokens: Token[],
  startIndex: number,
  closeType: string
): Token | null {
  for (let index = startIndex + 1; index < tokens.length; index += 1) {
    if (tokens[index].type === closeType) {
      return null
    }

    if (tokens[index].type === 'inline') {
      return tokens[index]
    }
  }

  return null
}

function findClosingToken(tokens: Token[], startIndex: number, type: string): number {
  for (let index = startIndex + 1; index < tokens.length; index += 1) {
    if (tokens[index].type === type) {
      return index
    }
  }

  return startIndex
}

function getDocxHeadingLevel(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const levels = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6
  ]

  return levels[Math.min(Math.max(level, 1), 6) - 1]
}

function createDefaultExportPath(input: ExportDocumentInput): string {
  const sourceBase = input.sourcePath
    ? basename(input.sourcePath, extname(input.sourcePath))
    : input.title
  const filename = `${sanitizeFilename(sourceBase || 'Untitled')}.${exportExtensions[input.format]}`
  const folder = input.sourcePath ? dirname(input.sourcePath) : app.getPath('downloads')

  return join(folder, filename)
}

function ensureExtension(filePath: string, extension: string): string {
  return extname(filePath) ? filePath : `${filePath}.${extension}`
}

function sanitizeFilename(filename: string): string {
  const sanitized = Array.from(filename)
    .map((character) => {
      if (character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character)) {
        return '-'
      }

      return character
    })
    .join('')
    .trim()

  return sanitized || 'Untitled'
}

function getMimeType(filePath: string): string {
  const extension = extname(filePath).toLowerCase()

  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg'
  }

  if (extension === '.gif') {
    return 'image/gif'
  }

  if (extension === '.webp') {
    return 'image/webp'
  }

  if (extension === '.svg') {
    return 'image/svg+xml'
  }

  return 'image/png'
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function createExportCss(pageSize: ExportPdfPageSize): string {
  return `
    @page {
      size: ${pageSize};
      margin: 18mm 20mm;
    }

    :root {
      color: #172033;
      background: #ffffff;
      font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC",
        "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      font-size: 16px;
      line-height: 1.78;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      min-height: 100%;
      margin: 0;
      background: #ffffff;
    }

    html {
      scrollbar-width: none;
    }

    ::-webkit-scrollbar {
      display: none;
    }

    body {
      padding: 42px 30px;
    }

    .markdown-export {
      width: min(920px, 100%);
      margin: 0 auto;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 1.55em 0 0.6em;
      color: #0f172a;
      line-height: 1.28;
      break-after: avoid;
    }

    h1 {
      margin-top: 0;
      padding-bottom: 0.35em;
      border-bottom: 1px solid #e2e8f0;
      font-size: 2rem;
    }

    h2 {
      font-size: 1.55rem;
    }

    h3 {
      font-size: 1.25rem;
    }

    p,
    ul,
    ol,
    blockquote,
    table,
    pre {
      margin-top: 0;
      margin-bottom: 1em;
    }

    a {
      color: #2563eb;
      text-decoration: none;
    }

    blockquote {
      padding: 0.2em 0 0.2em 1em;
      border-left: 4px solid #cbd5e1;
      color: #475569;
    }

    img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 1.2em auto;
      border-radius: 6px;
    }

    code {
      padding: 0.12em 0.32em;
      border-radius: 4px;
      color: #334155;
      background: #f1f5f9;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.9em;
    }

    pre.markdown-code-block {
      overflow: auto;
      padding: 14px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      break-inside: avoid;
    }

    pre.markdown-code-block code {
      display: block;
      padding: 0;
      color: #1e293b;
      background: transparent;
      white-space: pre;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      break-inside: avoid;
    }

    th,
    td {
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f1f5f9;
      font-weight: 700;
    }

    input[type='checkbox'] {
      margin-right: 0.45em;
    }

    .katex-display {
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0.3em 0;
    }

    @media print {
      body {
        padding: 0;
      }

      .markdown-export {
        width: 100%;
      }
    }
  `
}
