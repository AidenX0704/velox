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
  | 'workspace:open-folder'

export interface VeloxAPI {
  app: {
    getInfo: () => Promise<Result<AppInfo>>
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
      patch: Partial<import('./preferences').EditorPreferences>
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
  }
  workspace: {
    openFolder: () => Promise<Result<string | null>>
    getTree: (rootPath: string) => Promise<Result<WorkspaceEntry[]>>
    getState: (rootPath: string) => Promise<Result<WorkspaceStateRecord | null>>
    updateState: (input: UpdateWorkspaceStateInput) => Promise<Result<WorkspaceStateRecord>>
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
  menu: {
    onCommand: (callback: (command: MenuCommand) => void) => () => void
  }
}
