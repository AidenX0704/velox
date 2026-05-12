import { dialog, shell, BrowserWindow } from 'electron'
import fg from 'fast-glob'
import { join, dirname, extname } from 'node:path'
import { mkdir, writeFile, rename } from 'node:fs/promises'
import chokidar, { type FSWatcher } from 'chokidar'
import type { WorkspaceEntry } from '../../shared/types'
import { RecentService } from './recent-service'
import { SettingsService } from './settings-service'
import { ipcChannels } from '../../shared/channels'
import { logger } from './log-service'

const workspaceIgnore = ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/out/**']

export class WorkspaceService {
  private watcher: FSWatcher | null = null
  private currentWorkspacePath: string | null = null

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

  async getTree(rootPath: string): Promise<WorkspaceEntry[]> {
    // If getting tree for a new path, start watching it
    if (this.currentWorkspacePath !== rootPath) {
      await this.watchWorkspace(rootPath)
    }

    const relativePaths = await fg('**/*', {
      cwd: rootPath,
      deep: 5,
      dot: false,
      ignore: workspaceIgnore,
      markDirectories: true,
      onlyFiles: false,
      unique: true
    })

    const roots: WorkspaceEntry[] = []

    for (const relativePath of relativePaths) {
      this.insertEntry(roots, rootPath, relativePath)
    }

    return this.sortEntries(roots)
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

  private async watchWorkspace(rootPath: string): Promise<void> {
    await this.unwatchWorkspace()

    this.currentWorkspacePath = rootPath
    this.watcher = chokidar.watch(rootPath, {
      ignored: [/(^|[\/\\])\../, ...workspaceIgnore], // ignore dotfiles and ignore list
      persistent: true,
      ignoreInitial: true,
      depth: 5
    })

    const notifyChange = (): void => {
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send(ipcChannels.workspace.didChange)
      })
    }

    this.watcher
      .on('add', notifyChange)
      .on('change', notifyChange)
      .on('unlink', notifyChange)
      .on('addDir', notifyChange)
      .on('unlinkDir', notifyChange)
      .on('error', (error) => logger.error(`Watcher error: ${error}`))
  }

  private async unwatchWorkspace(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.currentWorkspacePath = null
  }

  private insertEntry(roots: WorkspaceEntry[], rootPath: string, relativePath: string): void {
    const isDirectory = relativePath.endsWith('/')
    const parts = relativePath.replace(/\/$/, '').split('/')
    let entries = roots

    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1
      const type = isLeaf && !isDirectory ? 'file' : 'directory'
      let entry = entries.find((item) => item.name === part)

      if (!entry) {
        entry = {
          path: join(rootPath, ...parts.slice(0, index + 1)),
          name: part,
          type,
          ...(type === 'directory' ? { children: [] } : {})
        }
        entries.push(entry)
      }

      if (entry.type === 'directory') {
        entries = entry.children ?? []
      }
    })
  }

  private sortEntries(entries: WorkspaceEntry[]): WorkspaceEntry[] {
    return entries
      .map((entry) => ({
        ...entry,
        children: entry.children ? this.sortEntries(entry.children) : undefined
      }))
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'directory' ? -1 : 1
        }

        return left.name.localeCompare(right.name)
      })
  }
}
