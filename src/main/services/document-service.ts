import { dialog } from 'electron'
import { readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import type {
  DocumentLinkPreview,
  DocumentData,
  ResolveDocumentLinkInput,
  ResolvedDocumentLink,
  SaveDocumentAsInput,
  SaveDocumentInput
} from '../../shared/types'
import { VeloxError } from '../shared/errors'
import { HistoryService } from './history-service'
import { RecentService } from './recent-service'
import { SettingsService } from './settings-service'

const markdownFilters = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
  { name: 'Text', extensions: ['txt'] },
  { name: 'All Files', extensions: ['*'] }
]
const documentExtensions = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt'])
const extensionlessCandidates = ['.md', '.markdown', '.txt']
const directoryIndexCandidates = ['README.md', 'readme.md', 'index.md']
const linkPreviewMaxLength = 1600

export class DocumentService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly recentService?: RecentService,
    private readonly historyService?: HistoryService
  ) {}

  createUntitled(): DocumentData {
    return {
      content: '',
      title: 'undefined.md',
      dirty: false,
      updatedAt: new Date().toISOString()
    }
  }

  async open(): Promise<DocumentData | null> {
    const result = await dialog.showOpenDialog({
      title: 'Open Markdown Document',
      properties: ['openFile'],
      filters: markdownFilters
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return this.openPath(result.filePaths[0])
  }

  async openPath(filePath: string): Promise<DocumentData> {
    const content = await readFile(filePath, 'utf8')
    this.settingsService.addRecentFile(filePath)
    this.recentService?.addFile(filePath)
    this.historyService?.recordOpen(filePath)
    this.historyService?.recordImport(filePath, content)

    return {
      path: filePath,
      content,
      title: basename(filePath),
      dirty: false,
      updatedAt: new Date().toISOString()
    }
  }

  async resolveLink(input: ResolveDocumentLinkInput): Promise<ResolvedDocumentLink | null> {
    const parsedHref = parseDocumentHref(input.href)

    if (!parsedHref || parsedHref.external) {
      return null
    }

    const basePath = input.currentPath ? dirname(input.currentPath) : input.workspaceRoot

    if (!basePath) {
      throw new VeloxError('DOCUMENT_LINK_NO_BASE_PATH', '请先保存当前文档后再跳转相对链接')
    }

    if (!parsedHref.targetPath) {
      if (!input.currentPath) {
        return null
      }

      return {
        path: input.currentPath,
        ...(parsedHref.anchor ? { anchor: parsedHref.anchor } : {})
      }
    }

    const targetPath = isAbsolute(parsedHref.targetPath)
      ? resolve(parsedHref.targetPath)
      : resolve(basePath, parsedHref.targetPath)
    const resolvedPath = await resolveDocumentCandidate(targetPath)

    if (!resolvedPath) {
      throw new VeloxError('DOCUMENT_LINK_NOT_FOUND', `未找到链接文档：${parsedHref.targetPath}`)
    }

    const shouldRestrictToWorkspace =
      !!input.workspaceRoot &&
      (!input.currentPath || isPathInside(resolve(input.currentPath), resolve(input.workspaceRoot)))

    if (input.workspaceRoot && shouldRestrictToWorkspace) {
      const [targetRealPath, workspaceRealPath] = await Promise.all([
        realpath(resolvedPath),
        realpath(input.workspaceRoot)
      ])

      if (!isPathInside(targetRealPath, workspaceRealPath)) {
        throw new VeloxError('DOCUMENT_LINK_OUTSIDE_WORKSPACE', '链接文档不在当前工作区内')
      }
    }

    return {
      path: resolvedPath,
      ...(parsedHref.anchor ? { anchor: parsedHref.anchor } : {})
    }
  }

  async previewLink(input: ResolveDocumentLinkInput): Promise<DocumentLinkPreview | null> {
    const resolvedLink = await this.resolveLink(input)

    if (!resolvedLink) {
      return null
    }

    const content = await readFile(resolvedLink.path, 'utf8')
    const excerptSource = resolvedLink.anchor
      ? getAnchoredPreviewContent(content, resolvedLink.anchor)
      : content
    const excerpt = createPreviewExcerpt(excerptSource)

    return {
      path: resolvedLink.path,
      title: basename(resolvedLink.path),
      ...(resolvedLink.anchor ? { anchor: resolvedLink.anchor } : {}),
      excerpt: excerpt.text,
      lineCount: content.split(/\r?\n/).length,
      truncated: excerpt.truncated
    }
  }

  async save(input: SaveDocumentInput): Promise<DocumentData> {
    await writeFile(input.path, input.content, 'utf8')
    this.settingsService.addRecentFile(input.path)
    this.recentService?.addFile(input.path)
    this.historyService?.recordSave(input.path, input.content)

    return {
      path: input.path,
      content: input.content,
      title: basename(input.path),
      dirty: false,
      updatedAt: new Date().toISOString()
    }
  }

  async saveAs(input: SaveDocumentAsInput): Promise<DocumentData | null> {
    const result = await dialog.showSaveDialog({
      title: 'Save Markdown Document',
      defaultPath: input.defaultPath,
      filters: markdownFilters
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    return this.save({
      path: result.filePath,
      content: input.content
    })
  }
}

interface ParsedDocumentHref {
  external: boolean
  targetPath: string
  anchor?: string
}

function parseDocumentHref(href: string): ParsedDocumentHref | null {
  const trimmedHref = href.trim()

  if (!trimmedHref) {
    return null
  }

  const protocolMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmedHref)

  if (protocolMatch) {
    return { external: true, targetPath: '' }
  }

  if (trimmedHref.startsWith('//')) {
    return { external: true, targetPath: '' }
  }

  const targetHref = trimmedHref

  const hashIndex = targetHref.indexOf('#')
  const hrefPath = hashIndex >= 0 ? targetHref.slice(0, hashIndex) : targetHref
  const queryIndex = hrefPath.indexOf('?')
  const targetPath = queryIndex >= 0 ? hrefPath.slice(0, queryIndex) : hrefPath
  const hash = hashIndex >= 0 ? targetHref.slice(hashIndex + 1) : ''

  return {
    external: false,
    targetPath: decodeURIComponent(targetPath),
    ...(hash ? { anchor: decodeURIComponent(hash) } : {})
  }
}

async function resolveDocumentCandidate(targetPath: string): Promise<string | null> {
  const direct = await getExistingDocumentPath(targetPath)

  if (direct) {
    return direct
  }

  if (!extname(targetPath)) {
    for (const extension of extensionlessCandidates) {
      const candidate = await getExistingDocumentPath(`${targetPath}${extension}`)

      if (candidate) {
        return candidate
      }
    }
  }

  if (await isDirectory(targetPath)) {
    for (const filename of directoryIndexCandidates) {
      const candidate = await getExistingDocumentPath(resolve(targetPath, filename))

      if (candidate) {
        return candidate
      }
    }
  }

  return null
}

async function getExistingDocumentPath(targetPath: string): Promise<string | null> {
  if (!documentExtensions.has(extname(targetPath).toLowerCase())) {
    return null
  }

  try {
    const fileStats = await stat(targetPath)
    return fileStats.isFile() ? targetPath : null
  } catch {
    return null
  }
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const fileStats = await stat(targetPath)
    return fileStats.isDirectory()
  } catch {
    return false
  }
}

function isPathInside(targetPath: string | undefined, rootPath: string): boolean {
  if (!targetPath) {
    return false
  }

  const relativePath = relative(rootPath, targetPath)

  return (
    relativePath === '' ||
    (!!relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath))
  )
}

function createPreviewExcerpt(content: string): { text: string; truncated: boolean } {
  const normalized = content.replace(/\r\n/g, '\n').trim()

  if (normalized.length <= linkPreviewMaxLength) {
    return { text: normalized || '空文档', truncated: false }
  }

  return {
    text: `${normalized.slice(0, linkPreviewMaxLength).trimEnd()}\n...`,
    truncated: true
  }
}

function getAnchoredPreviewContent(content: string, anchor: string): string {
  const lines = content.split(/\r?\n/)
  const normalizedAnchor = normalizeAnchor(anchor)
  let startIndex = -1
  let startLevel = 0

  for (let index = 0; index < lines.length; index += 1) {
    const headingMatch = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[index])

    if (!headingMatch) {
      continue
    }

    const text = headingMatch[2].trim()
    const headingSlug = slugifyHeading(text)

    if (headingSlug === normalizedAnchor) {
      startIndex = index
      startLevel = headingMatch[1].length
      break
    }
  }

  if (startIndex < 0) {
    return content
  }

  let endIndex = lines.length

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const headingMatch = /^(#{1,6})\s+/.exec(lines[index])

    if (headingMatch && headingMatch[1].length <= startLevel) {
      endIndex = index
      break
    }
  }

  return lines.slice(startIndex, endIndex).join('\n')
}

function normalizeAnchor(anchor: string): string {
  return slugifyHeading(anchor)
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~[\](){}<>\\]/g, '')
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
