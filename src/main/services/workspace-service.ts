import { dialog, shell, BrowserWindow } from 'electron'
import fg from 'fast-glob'
import { basename, dirname, extname, isAbsolute, join, relative } from 'node:path'
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import chokidar, { type FSWatcher } from 'chokidar'
import type {
  WorkspaceEntry,
  WorkspaceReplaceInput,
  WorkspaceReplaceResult,
  WorkspaceSearchInput,
  WorkspaceSearchMatch,
  WorkspaceSearchResult
} from '../../shared/types'
import { RecentService } from './recent-service'
import { SettingsService } from './settings-service'
import { ipcChannels } from '../../shared/channels'
import { logger } from './log-service'

const workspaceIgnore = ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/out/**']
const workspaceIgnoredEntryNames = new Set(['node_modules', 'dist', 'out'])
const workspaceSearchMaxResults = 500
const workspaceSearchMaxFileSizeBytes = 2 * 1024 * 1024
const searchableTextExtensions = new Set([
  '.md',
  '.markdown',
  '.mdown',
  '.mkd',
  '.txt',
  '.text',
  '.json',
  '.jsonc',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.csv',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.xml'
])

interface TextSearchMatch {
  from: number
  to: number
}

export class WorkspaceService {
  private watcher: FSWatcher | null = null
  private currentWorkspacePath: string | null = null
  private workspaceChangeTimer: NodeJS.Timeout | undefined

  constructor(
    private readonly settingsService: SettingsService,
    private readonly recentService?: RecentService
  ) {}

  async openFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Open Workspace',
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const folderPath = result.filePaths[0]
    this.settingsService.addRecentFolder(folderPath)
    this.recentService?.addWorkspace(folderPath)

    await this.watchWorkspace(folderPath)

    return folderPath
  }

  async getTree(rootPath: string, expandedPaths: string[] = []): Promise<WorkspaceEntry[]> {
    const rootStat = await stat(rootPath)
    if (!rootStat.isDirectory()) {
      throw new Error(`Workspace path is not a directory: ${rootPath}`)
    }

    // If getting tree for a new path, start watching it
    if (this.currentWorkspacePath !== rootPath) {
      await this.watchWorkspace(rootPath)
    }

    const expandedPathSet = new Set(
      expandedPaths.filter((path) => isWorkspaceDescendantPath(rootPath, path))
    )

    return this.readDirectory(rootPath, expandedPathSet, true)
  }

  async createEntry(parentPath: string, name: string, type: 'file' | 'directory'): Promise<string> {
    let entryName = name
    if (type === 'file' && !extname(name)) {
      entryName = `${name}.md`
    }

    const targetPath = join(parentPath, entryName)

    if (type === 'directory') {
      await mkdir(targetPath, { recursive: true })
    } else {
      await writeFile(targetPath, '', 'utf8')
    }

    return targetPath
  }

  async renameEntry(path: string, newName: string): Promise<string> {
    const parentDir = dirname(path)
    let targetName = newName

    // Auto-append .md if renaming a file that looks like a markdown file but lost its extension
    if (extname(path) === '.md' && !extname(newName)) {
      targetName = `${newName}.md`
    }

    const targetPath = join(parentDir, targetName)
    await rename(path, targetPath)
    return targetPath
  }

  async deleteEntry(path: string): Promise<void> {
    // Use trash for safety instead of permanent deletion
    await shell.trashItem(path)
  }

  async search(input: WorkspaceSearchInput): Promise<WorkspaceSearchResult> {
    const query = normalizeSearchQuery(input.query)

    if (!query) {
      return { totalCount: 0, files: [], truncated: false }
    }

    const relativePaths = await this.listSearchableFiles(input.rootPath)
    const files: WorkspaceSearchResult['files'] = []
    let totalCount = 0
    let visibleCount = 0
    let truncated = false

    for (const relativePath of relativePaths) {
      const filePath = join(input.rootPath, relativePath)
      const content = await readWorkspaceTextFile(filePath)

      if (content === null) {
        continue
      }

      const matches = findTextSearchMatches(content, query, {
        caseSensitive: input.caseSensitive
      })

      if (matches.length === 0) {
        continue
      }

      totalCount += matches.length

      if (visibleCount >= workspaceSearchMaxResults) {
        truncated = true
        continue
      }

      const remaining = workspaceSearchMaxResults - visibleCount
      const visibleMatches = buildWorkspaceSearchMatches(content, matches.slice(0, remaining))
      visibleCount += visibleMatches.length
      truncated = truncated || matches.length > visibleMatches.length

      files.push({
        path: filePath,
        name: basename(filePath),
        relativePath,
        matchCount: matches.length,
        matches: visibleMatches
      })
    }

    return { totalCount, files, truncated }
  }

  async replaceAll(input: WorkspaceReplaceInput): Promise<WorkspaceReplaceResult> {
    const query = normalizeSearchQuery(input.query)

    if (!query) {
      return { changedFiles: 0, replacements: 0, files: [] }
    }

    const relativePaths = await this.listSearchableFiles(input.rootPath)
    const files: WorkspaceReplaceResult['files'] = []
    let replacements = 0

    for (const relativePath of relativePaths) {
      const filePath = join(input.rootPath, relativePath)
      const content = await readWorkspaceTextFile(filePath)

      if (content === null) {
        continue
      }

      const matches = findTextSearchMatches(content, query, {
        caseSensitive: input.caseSensitive
      })

      if (matches.length === 0) {
        continue
      }

      await writeFile(
        filePath,
        replaceTextSearchMatches(content, matches, input.replacement),
        'utf8'
      )
      replacements += matches.length
      files.push({
        path: filePath,
        relativePath,
        replacements: matches.length
      })
    }

    return {
      changedFiles: files.length,
      replacements,
      files
    }
  }

  private async watchWorkspace(rootPath: string): Promise<void> {
    await this.unwatchWorkspace()

    this.currentWorkspacePath = rootPath
    this.watcher = chokidar.watch(rootPath, {
      ignored: [/(^|[/\\])\../, ...workspaceIgnore], // ignore dotfiles and ignore list
      persistent: true,
      ignoreInitial: true,
      depth: 5
    })

    const notifyChange = (): void => this.scheduleWorkspaceChange()

    this.watcher
      .on('add', notifyChange)
      .on('unlink', notifyChange)
      .on('addDir', notifyChange)
      .on('unlinkDir', notifyChange)
      .on('error', (error) => logger.error(`Watcher error: ${error}`))
  }

  private async unwatchWorkspace(): Promise<void> {
    clearTimeout(this.workspaceChangeTimer)
    this.workspaceChangeTimer = undefined

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.currentWorkspacePath = null
  }

  private async listSearchableFiles(rootPath: string): Promise<string[]> {
    const relativePaths = await fg('**/*', {
      cwd: rootPath,
      deep: 8,
      dot: false,
      ignore: workspaceIgnore,
      onlyFiles: true,
      unique: true
    })

    return relativePaths.filter((relativePath) =>
      searchableTextExtensions.has(extname(relativePath).toLocaleLowerCase())
    )
  }

  private notifyWorkspaceChange(): void {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send(ipcChannels.workspace.didChange)
    })
  }

  private scheduleWorkspaceChange(): void {
    clearTimeout(this.workspaceChangeTimer)
    this.workspaceChangeTimer = setTimeout(() => {
      this.workspaceChangeTimer = undefined
      this.notifyWorkspaceChange()
    }, 120)
  }

  private async readDirectory(
    directoryPath: string,
    expandedPaths: Set<string>,
    isRoot = false
  ): Promise<WorkspaceEntry[]> {
    let directoryEntries

    try {
      directoryEntries = await readdir(directoryPath, { withFileTypes: true })
    } catch (error) {
      if (isRoot) {
        throw error
      }

      logger.warn(`Unable to read workspace directory: ${directoryPath}`, error)
      return []
    }

    const entries = await Promise.all(
      directoryEntries
        .filter(
          (entry) =>
            !entry.name.startsWith('.') && !workspaceIgnoredEntryNames.has(entry.name.toLowerCase())
        )
        .map(async (entry): Promise<WorkspaceEntry> => {
          const entryPath = join(directoryPath, entry.name)

          if (!entry.isDirectory()) {
            return {
              path: entryPath,
              name: entry.name,
              type: 'file'
            }
          }

          return {
            path: entryPath,
            name: entry.name,
            type: 'directory',
            ...(expandedPaths.has(entryPath)
              ? { children: await this.readDirectory(entryPath, expandedPaths) }
              : {})
          }
        })
    )

    return entries.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
  }
}

function isWorkspaceDescendantPath(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(rootPath, candidatePath)
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

async function readWorkspaceTextFile(filePath: string): Promise<string | null> {
  try {
    const fileStat = await stat(filePath)

    if (!fileStat.isFile() || fileStat.size > workspaceSearchMaxFileSizeBytes) {
      return null
    }

    const content = await readFile(filePath, 'utf8')

    if (content.includes('\0')) {
      return null
    }

    return content
  } catch (error) {
    logger.warn(`Unable to read workspace file: ${filePath}`, error)
    return null
  }
}

function normalizeSearchQuery(query?: string): string {
  return query?.trim() ?? ''
}

function findTextSearchMatches(
  text: string,
  query: string,
  options: { caseSensitive?: boolean } = {}
): TextSearchMatch[] {
  const normalizedQuery = normalizeSearchQuery(query)

  if (!normalizedQuery) {
    return []
  }

  const matches: TextSearchMatch[] = []
  const searchableText = options.caseSensitive ? text : text.toLocaleLowerCase()
  const searchableQuery = options.caseSensitive
    ? normalizedQuery
    : normalizedQuery.toLocaleLowerCase()
  let searchFrom = 0

  while (searchFrom <= searchableText.length - searchableQuery.length) {
    const from = searchableText.indexOf(searchableQuery, searchFrom)

    if (from === -1) {
      break
    }

    matches.push({ from, to: from + normalizedQuery.length })
    searchFrom = from + normalizedQuery.length
  }

  return matches
}

function buildWorkspaceSearchMatches(
  content: string,
  matches: TextSearchMatch[]
): WorkspaceSearchMatch[] {
  let currentLine = 1
  let scannedOffset = 0

  return matches.map((match, index) => {
    let newlineOffset = content.indexOf('\n', scannedOffset)
    while (newlineOffset !== -1 && newlineOffset < match.from) {
      currentLine += 1
      scannedOffset = newlineOffset + 1
      newlineOffset = content.indexOf('\n', scannedOffset)
    }

    const lineStart = content.lastIndexOf('\n', Math.max(0, match.from - 1)) + 1

    return {
      index,
      line: currentLine,
      column: match.from - lineStart + 1,
      ...buildSearchResultSnippet(content, match.from, match.to)
    }
  })
}

function compactSearchSnippetPart(value: string): string {
  return value.replace(/\s+/g, ' ')
}

function buildSearchResultSnippet(
  content: string,
  from: number,
  to: number
): Pick<WorkspaceSearchMatch, 'before' | 'match' | 'after'> {
  const lineStart = content.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  const nextLineBreak = content.indexOf('\n', to)
  const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak
  const beforeStart = Math.max(lineStart, from - 42)
  const afterEnd = Math.min(lineEnd, to + 58)

  return {
    before: `${beforeStart > lineStart ? '...' : ''}${compactSearchSnippetPart(
      content.slice(beforeStart, from)
    )}`,
    match: compactSearchSnippetPart(content.slice(from, to)),
    after: `${compactSearchSnippetPart(content.slice(to, afterEnd))}${
      afterEnd < lineEnd ? '...' : ''
    }`
  }
}

function replaceTextSearchMatches(
  text: string,
  matches: TextSearchMatch[],
  replacement: string
): string {
  let nextText = text

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    nextText = `${nextText.slice(0, match.from)}${replacement}${nextText.slice(match.to)}`
  }

  return nextText
}
