import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { ipcChannels } from '../shared/channels'
import type {
  AppInfo,
  BackupFileStatus,
  BackupRunResult,
  AppSettings,
  DocumentLinkPreview,
  DocumentSessionRecord,
  DocumentData,
  ExternalDocumentChange,
  ExternalDocumentRemoval,
  HistoryBranchRecord,
  HistoryDocumentActivity,
  LaunchOptions,
  HistoryTimelineEntry,
  MenuCommand,
  RecentFileRecord,
  RecentWorkspaceRecord,
  ResolveDocumentImageInput,
  ResolveDocumentLinkInput,
  ResolvedDocumentLink,
  Result,
  SaveDocumentAsInput,
  SaveDocumentInput,
  UpdateDocumentSessionInput,
  UpdateWorkspaceStateInput,
  UpdaterStatus,
  VeloxAPI,
  WorkspaceEntry,
  WorkspaceReplaceInput,
  WorkspaceReplaceResult,
  WorkspaceSearchInput,
  WorkspaceSearchResult,
  WorkspaceStateRecord
} from '../shared/types'
import type { ExportDocumentInput, ExportDocumentResult, ExportProgress } from '../shared/export'
import type { EditorPreferences } from '../shared/preferences'

/**
 * The main process registers IPC handlers on the tick after the window is
 * created (see bootstrap/create-app.ts). The renderer normally loses that race
 * anyway, but this retry keeps the handshake deterministic on slow disks and in
 * dev mode where the bundle can be served from cache.
 */
async function invokeWhenReady<T>(channel: string, payload?: unknown): Promise<Result<T>> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await ipcRenderer.invoke(channel, payload)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (attempt >= 40 || !message.includes('No handler registered')) {
        throw error
      }

      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
}

const api: VeloxAPI = {
  app: {
    getInfo: () => invokeWhenReady<AppInfo>(ipcChannels.app.getInfo),
    getPendingOpenFile: () => invokeWhenReady<string | null>(ipcChannels.app.getPendingOpenFile),
    reportReady: () => invokeWhenReady<void>(ipcChannels.app.reportReady),
    // Parsed in the main process: a sandboxed preload cannot see the app argv.
    getLaunchOptions: () => invokeWhenReady<LaunchOptions>(ipcChannels.app.getLaunchOptions),
    getPathForFile: (file) => webUtils.getPathForFile(file),
    onOpenFile: (callback) => {
      const listener = (_event: IpcRendererEvent, filePath: string): void => {
        callback(filePath)
      }

      ipcRenderer.on(ipcChannels.app.openFile, listener)

      return () => {
        ipcRenderer.removeListener(ipcChannels.app.openFile, listener)
      }
    }
  },
  window: {
    getIsMaximized: () => invokeWhenReady<boolean>(ipcChannels.window.getIsMaximized),
    minimize: () => invokeWhenReady<void>(ipcChannels.window.minimize),
    toggleMaximize: () => invokeWhenReady<void>(ipcChannels.window.toggleMaximize),
    close: () => invokeWhenReady<void>(ipcChannels.window.close),
    setAppearance: (appearance) =>
      invokeWhenReady<void>(ipcChannels.window.setAppearance, appearance),
    onMaximizedChange: (callback) => {
      const listener = (_event: IpcRendererEvent, isMaximized: boolean): void => {
        callback(isMaximized)
      }

      ipcRenderer.on(ipcChannels.window.maximizedChanged, listener)

      return () => {
        ipcRenderer.removeListener(ipcChannels.window.maximizedChanged, listener)
      }
    }
  },
  settings: {
    get: () => invokeWhenReady<AppSettings>(ipcChannels.settings.get),
    update: (patch) => invokeWhenReady<AppSettings>(ipcChannels.settings.update, patch)
  },
  preferences: {
    getEditor: () => invokeWhenReady<EditorPreferences>(ipcChannels.preferences.getEditor),
    updateEditor: (patch) =>
      invokeWhenReady<EditorPreferences>(ipcChannels.preferences.updateEditor, patch),
    resetEditor: () => invokeWhenReady<EditorPreferences>(ipcChannels.preferences.resetEditor)
  },
  backup: {
    run: (sourcePath) => invokeWhenReady<BackupRunResult>(ipcChannels.backup.run, { sourcePath }),
    getLastRun: () => invokeWhenReady<BackupRunResult | null>(ipcChannels.backup.getLastRun),
    onProgress: (callback) => {
      const listener = (_event: IpcRendererEvent, status: BackupFileStatus): void =>
        callback(status)
      ipcRenderer.on(ipcChannels.backup.progress, listener)
      return () => ipcRenderer.removeListener(ipcChannels.backup.progress, listener)
    }
  },
  recent: {
    listFiles: () => invokeWhenReady<RecentFileRecord[]>(ipcChannels.recent.listFiles),
    listWorkspaces: () =>
      invokeWhenReady<RecentWorkspaceRecord[]>(ipcChannels.recent.listWorkspaces),
    clear: () => invokeWhenReady<void>(ipcChannels.recent.clear)
  },
  history: {
    listTimeline: (path?: string) =>
      invokeWhenReady<HistoryTimelineEntry[]>(ipcChannels.history.listTimeline, path),
    listBranches: (path?: string) =>
      invokeWhenReady<HistoryBranchRecord[]>(ipcChannels.history.listBranches, path),
    getDocumentActivity: (path: string) =>
      invokeWhenReady<HistoryDocumentActivity>(ipcChannels.history.getDocumentActivity, path)
  },
  document: {
    createUntitled: () => invokeWhenReady<DocumentData>(ipcChannels.document.createUntitled),
    open: () => invokeWhenReady<DocumentData | null>(ipcChannels.document.open),
    openPath: (path: string) => invokeWhenReady<DocumentData>(ipcChannels.document.openPath, path),
    resolveLink: (input: ResolveDocumentLinkInput) =>
      invokeWhenReady<ResolvedDocumentLink | null>(ipcChannels.document.resolveLink, input),
    previewLink: (input: ResolveDocumentLinkInput) =>
      invokeWhenReady<DocumentLinkPreview | null>(ipcChannels.document.previewLink, input),
    resolveImage: (input: ResolveDocumentImageInput) =>
      invokeWhenReady<string | null>(ipcChannels.document.resolveImage, input),
    save: (input: SaveDocumentInput) =>
      invokeWhenReady<DocumentData>(ipcChannels.document.save, input),
    saveAs: (input: SaveDocumentAsInput) =>
      invokeWhenReady<DocumentData | null>(ipcChannels.document.saveAs, input),
    export: (input: ExportDocumentInput) =>
      invokeWhenReady<ExportDocumentResult | null>(ipcChannels.document.export, input),
    onExportProgress: (callback) => {
      const listener = (_event: IpcRendererEvent, progress: ExportProgress): void => {
        callback(progress)
      }

      ipcRenderer.on(ipcChannels.document.exportProgress, listener)

      return () => {
        ipcRenderer.removeListener(ipcChannels.document.exportProgress, listener)
      }
    },
    unwatch: (path: string) => invokeWhenReady<void>(ipcChannels.document.unwatch, path),
    reloadFromDisk: (path: string) =>
      invokeWhenReady<string | null>(ipcChannels.document.reloadFromDisk, path),
    onExternalChange: (callback) => {
      const listener = (_event: IpcRendererEvent, change: ExternalDocumentChange): void => {
        callback(change)
      }

      ipcRenderer.on(ipcChannels.document.externalChange, listener)

      return () => {
        ipcRenderer.removeListener(ipcChannels.document.externalChange, listener)
      }
    },
    onExternalRemoval: (callback) => {
      const listener = (_event: IpcRendererEvent, change: ExternalDocumentRemoval): void => {
        callback(change)
      }

      ipcRenderer.on(ipcChannels.document.externalRemoved, listener)

      return () => {
        ipcRenderer.removeListener(ipcChannels.document.externalRemoved, listener)
      }
    }
  },
  workspace: {
    openFolder: () => invokeWhenReady<string | null>(ipcChannels.workspace.openFolder),
    getTree: (input) => invokeWhenReady<WorkspaceEntry[]>(ipcChannels.workspace.getTree, input),
    getState: (rootPath: string) =>
      invokeWhenReady<WorkspaceStateRecord | null>(ipcChannels.workspace.getState, rootPath),
    updateState: (input: UpdateWorkspaceStateInput) =>
      invokeWhenReady<WorkspaceStateRecord>(ipcChannels.workspace.updateState, input),
    createEntry: (input) => invokeWhenReady<string>(ipcChannels.workspace.createEntry, input),
    renameEntry: (input) => invokeWhenReady<string>(ipcChannels.workspace.renameEntry, input),
    deleteEntry: (input) => invokeWhenReady<void>(ipcChannels.workspace.deleteEntry, input),
    search: (input: WorkspaceSearchInput) =>
      invokeWhenReady<WorkspaceSearchResult>(ipcChannels.workspace.search, input),
    replaceAll: (input: WorkspaceReplaceInput) =>
      invokeWhenReady<WorkspaceReplaceResult>(ipcChannels.workspace.replaceAll, input),
    onDidChange: (callback) => {
      const listener = (): void => {
        callback()
      }

      ipcRenderer.on(ipcChannels.workspace.didChange, listener)

      return () => {
        ipcRenderer.removeListener(ipcChannels.workspace.didChange, listener)
      }
    }
  },
  session: {
    getDocument: (path: string) =>
      invokeWhenReady<DocumentSessionRecord | null>(ipcChannels.session.getDocument, path),
    getLastDocument: () =>
      invokeWhenReady<DocumentSessionRecord | null>(ipcChannels.session.getLastDocument),
    updateDocument: (input: UpdateDocumentSessionInput) =>
      invokeWhenReady<DocumentSessionRecord>(ipcChannels.session.updateDocument, input)
  },
  shell: {
    openExternal: (url: string) => invokeWhenReady<void>(ipcChannels.shell.openExternal, url),
    showItemInFolder: (path: string) =>
      invokeWhenReady<void>(ipcChannels.shell.showItemInFolder, path)
  },
  updater: {
    getStatus: () => invokeWhenReady<UpdaterStatus>(ipcChannels.updater.getStatus),
    checkForUpdates: () => invokeWhenReady<UpdaterStatus>(ipcChannels.updater.checkForUpdates),
    downloadUpdate: () => invokeWhenReady<UpdaterStatus>(ipcChannels.updater.downloadUpdate),
    quitAndInstall: () => invokeWhenReady<void>(ipcChannels.updater.quitAndInstall),
    onStatusChange: (callback) => {
      const listener = (_event: IpcRendererEvent, status: UpdaterStatus): void => {
        callback(status)
      }

      ipcRenderer.on(ipcChannels.updater.statusChanged, listener)

      return () => {
        ipcRenderer.removeListener(ipcChannels.updater.statusChanged, listener)
      }
    }
  },
  menu: {
    onCommand: (callback) => {
      const listener = (_event: IpcRendererEvent, command: MenuCommand): void => {
        callback(command)
      }

      ipcRenderer.on(ipcChannels.menu.command, listener)

      return () => {
        ipcRenderer.removeListener(ipcChannels.menu.command, listener)
      }
    }
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  globalThis.api = api
}
