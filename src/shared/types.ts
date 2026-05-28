export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

export interface AppError {
  code: string
  message: string
  details?: unknown
}

export interface AppInfo {
  name: string
  version: string
  platform: NodePlatform
  isPackaged: boolean
  paths: {
    userData: string
    logs: string
  }
}

export type NodePlatform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd'

export interface AppSettings {
  editor: {
    fontSize: number
    autosaveInterval: number
    wordWrap: boolean
  }
  appearance: {
    theme: 'system' | 'light' | 'dark'
  }
  workspace: {
    recentFiles: string[]
    recentFolders: string[]
    lastOpenedFolder?: string
  }
}

export interface AppSettingsPatch {
  editor?: Partial<AppSettings['editor']>
  appearance?: Partial<AppSettings['appearance']>
  workspace?: Partial<AppSettings['workspace']>
}

export interface DocumentData {
  path?: string
  content: string
  title: string
  dirty: boolean
  updatedAt: string
}

export interface SaveDocumentInput {
  path: string
  content: string
}

export interface SaveDocumentAsInput {
  defaultPath?: string
  content: string
}

export interface ResolveDocumentLinkInput {
  href: string
  currentPath?: string
  workspaceRoot?: string
}

export interface ResolvedDocumentLink {
  path: string
  anchor?: string
}

export interface DocumentLinkPreview {
  path: string
  title: string
  anchor?: string
  excerpt: string
  lineCount: number
  truncated: boolean
}

export interface WorkspaceEntry {
  path: string
  name: string
  type: 'file' | 'directory'
  children?: WorkspaceEntry[]
}

export interface RecentFileRecord {
  path: string
  title: string
  lastOpenedAt: string
  pinned: boolean
  existsCache: boolean
}

export interface RecentWorkspaceRecord {
  path: string
  name: string
  lastOpenedAt: string
  pinned: boolean
}

export interface WorkspaceStateRecord {
  workspacePath: string
  expandedPaths: string[]
  selectedPath?: string
  sidebarVisible: boolean
  updatedAt: string
}

export type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdaterStatus {
  state: UpdaterState
  message: string
  version?: string
  releaseName?: string
  releaseDate?: string
  releaseNotes?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  error?: string
  updatedAt: string
}

export interface UpdateWorkspaceStateInput {
  workspacePath: string
  expandedPaths?: string[]
  selectedPath?: string
  sidebarVisible?: boolean
}

export interface DocumentSessionRecord {
  path: string
  mode: import('./preferences').EditorMode
  cursorLine: number
  cursorColumn: number
  scrollTop: number
  updatedAt: string
}

export interface UpdateDocumentSessionInput {
  path: string
  mode?: import('./preferences').EditorMode
  cursorLine?: number
  cursorColumn?: number
  scrollTop?: number
}

export type MenuCommand =
  | 'document:new'
  | 'document:open'
  | 'document:save'
  | 'document:export-default'
  | 'document:export-html'
  | 'document:export-pdf'
  | 'document:export-png'
  | 'document:export-docx'
  | 'updater:check'
  | 'workspace:open-folder'

export interface VeloxAPI {
  app: {
    getInfo: () => Promise<Result<AppInfo>>
    getPendingOpenFile: () => Promise<Result<string | null>>
    getPathForFile: (file: File) => string
    onOpenFile: (callback: (filePath: string) => void) => () => void
  }
  window: {
    getIsMaximized: () => Promise<Result<boolean>>
    minimize: () => Promise<Result<void>>
    toggleMaximize: () => Promise<Result<void>>
    close: () => Promise<Result<void>>
    onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
  }
  settings: {
    get: () => Promise<Result<AppSettings>>
    update: (patch: AppSettingsPatch) => Promise<Result<AppSettings>>
  }
  preferences: {
    getEditor: () => Promise<Result<import('./preferences').EditorPreferences>>
    updateEditor: (
      patch: import('./preferences').EditorPreferencesPatch
    ) => Promise<Result<import('./preferences').EditorPreferences>>
    resetEditor: () => Promise<Result<import('./preferences').EditorPreferences>>
  }
  recent: {
    listFiles: () => Promise<Result<RecentFileRecord[]>>
    listWorkspaces: () => Promise<Result<RecentWorkspaceRecord[]>>
    clear: () => Promise<Result<void>>
  }
  document: {
    createUntitled: () => Promise<Result<DocumentData>>
    open: () => Promise<Result<DocumentData | null>>
    openPath: (path: string) => Promise<Result<DocumentData>>
    resolveLink: (input: ResolveDocumentLinkInput) => Promise<Result<ResolvedDocumentLink | null>>
    previewLink: (input: ResolveDocumentLinkInput) => Promise<Result<DocumentLinkPreview | null>>
    save: (input: SaveDocumentInput) => Promise<Result<DocumentData>>
    saveAs: (input: SaveDocumentAsInput) => Promise<Result<DocumentData | null>>
    export: (
      input: import('./export').ExportDocumentInput
    ) => Promise<Result<import('./export').ExportDocumentResult | null>>
    onExportProgress: (
      callback: (progress: import('./export').ExportProgress) => void
    ) => () => void
  }
  workspace: {
    openFolder: () => Promise<Result<string | null>>
    getTree: (rootPath: string) => Promise<Result<WorkspaceEntry[]>>
    getState: (rootPath: string) => Promise<Result<WorkspaceStateRecord | null>>
    updateState: (input: UpdateWorkspaceStateInput) => Promise<Result<WorkspaceStateRecord>>
    createEntry: (input: {
      parentPath: string
      name: string
      type: 'file' | 'directory'
    }) => Promise<Result<string>>
    renameEntry: (input: { path: string; newName: string }) => Promise<Result<string>>
    deleteEntry: (input: { path: string }) => Promise<Result<void>>
    onDidChange: (callback: () => void) => () => void
  }
  session: {
    getDocument: (path: string) => Promise<Result<DocumentSessionRecord | null>>
    getLastDocument: () => Promise<Result<DocumentSessionRecord | null>>
    updateDocument: (input: UpdateDocumentSessionInput) => Promise<Result<DocumentSessionRecord>>
  }
  shell: {
    openExternal: (url: string) => Promise<Result<void>>
    showItemInFolder: (path: string) => Promise<Result<void>>
  }
  updater: {
    getStatus: () => Promise<Result<UpdaterStatus>>
    checkForUpdates: () => Promise<Result<UpdaterStatus>>
    downloadUpdate: () => Promise<Result<UpdaterStatus>>
    quitAndInstall: () => Promise<Result<void>>
    onStatusChange: (callback: (status: UpdaterStatus) => void) => () => void
  }
  menu: {
    onCommand: (callback: (command: MenuCommand) => void) => () => void
  }
}
