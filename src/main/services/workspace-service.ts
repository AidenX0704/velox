import { dialog } from 'electron'
import fg from 'fast-glob'
import { join } from 'node:path'
import type { WorkspaceEntry } from '../../shared/types'
import { RecentService } from './recent-service'
import { SettingsService } from './settings-service'

const workspaceIgnore = ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/out/**']

export class WorkspaceService {
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

    return folderPath
  }

  async getTree(rootPath: string): Promise<WorkspaceEntry[]> {
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
