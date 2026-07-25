import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { ipcChannels } from '../shared/channels'
import type {
  AppInfo,
  AppSettings,
  DocumentLinkPreview,
  DocumentSessionRecord,
  DocumentData,
  HistoryBranchRecord,
  HistoryDocumentActivity,
  HistoryTimelineEntry,
  MenuCommand,
  RecentFileRecord,
  RecentWorkspaceRecord,
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

function invoke<T>(channel: string, payload?: unknown): Promise<Result<T>> {
  return ipcRenderer.invoke(channel, payload)
}

const api: VeloxAPI = {
  app: {
    getInfo: () => invoke<AppInfo>(ipcChannels.app.getInfo),
    getPendingOpenFile: () => invoke<string | null>(ipcChannels.app.getPendingOpenFile),
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
    getIsMaximized: () => invoke<boolean>(ipcChannels.window.getIsMaximized),
    minimize: () => invoke<void>(ipcChannels.window.minimize),
    toggleMaximize: () => invoke<void>(ipcChannels.window.toggleMaximize),
    close: () => invoke<void>(ipcChannels.window.close),
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
    get: () => invoke<AppSettings>(ipcChannels.settings.get),
    update: (patch) => invoke<AppSettings>(ipcChannels.settings.update, patch)
  },
  preferences: {
    getEditor: () => invoke<EditorPreferences>(ipcChannels.preferences.getEditor),
    updateEditor: (patch) => invoke<EditorPreferences>(ipcChannels.preferences.updateEditor, patch),
    resetEditor: () => invoke<EditorPreferences>(ipcChannels.preferences.resetEditor)
  },
  recent: {
    listFiles: () => invoke<RecentFileRecord[]>(ipcChannels.recent.listFiles),
    listWorkspaces: () => invoke<RecentWorkspaceRecord[]>(ipcChannels.recent.listWorkspaces),
    clear: () => invoke<void>(ipcChannels.recent.clear)
  },
  history: {
    listTimeline: (path?: string) =>
      invoke<HistoryTimelineEntry[]>(ipcChannels.history.listTimeline, path),
    listBranches: (path?: string) =>
      invoke<HistoryBranchRecord[]>(ipcChannels.history.listBranches, path),
    getDocumentActivity: (path: string) =>
      invoke<HistoryDocumentActivity>(ipcChannels.history.getDocumentActivity, path)
  },
  document: {
    createUntitled: () => invoke<DocumentData>(ipcChannels.document.createUntitled),
    open: () => invoke<DocumentData | null>(ipcChannels.document.open),
    openPath: (path: string) => invoke<DocumentData>(ipcChannels.document.openPath, path),
    resolveLink: (input: ResolveDocumentLinkInput) =>
      invoke<ResolvedDocumentLink | null>(ipcChannels.document.resolveLink, input),
    previewLink: (input: ResolveDocumentLinkInput) =>
      invoke<DocumentLinkPreview | null>(ipcChannels.document.previewLink, input),
    save: (input: SaveDocumentInput) => invoke<DocumentData>(ipcChannels.document.save, input),
    saveAs: (input: SaveDocumentAsInput) =>
      invoke<DocumentData | null>(ipcChannels.document.saveAs, input),
    export: (input: ExportDocumentInput) =>
      invoke<ExportDocumentResult | null>(ipcChannels.document.export, input),
    onExportProgress: (callback) => {
      const listener = (_event: IpcRendererEvent, progress: ExportProgress): void => {
        callback(progress)
      }

      ipcRenderer.on(ipcChannels.document.exportProgress, listener)

      return () => {
        ipcRenderer.removeListener(ipcChannels.document.exportProgress, listener)
      }
    }
  },
  workspace: {
    openFolder: () => invoke<string | null>(ipcChannels.workspace.openFolder),
    getTree: (rootPath: string) =>
      invoke<WorkspaceEntry[]>(ipcChannels.workspace.getTree, rootPath),
    getState: (rootPath: string) =>
      invoke<WorkspaceStateRecord | null>(ipcChannels.workspace.getState, rootPath),
    updateState: (input: UpdateWorkspaceStateInput) =>
      invoke<WorkspaceStateRecord>(ipcChannels.workspace.updateState, input),
    createEntry: (input) => invoke<string>(ipcChannels.workspace.createEntry, input),
    renameEntry: (input) => invoke<string>(ipcChannels.workspace.renameEntry, input),
    deleteEntry: (input) => invoke<void>(ipcChannels.workspace.deleteEntry, input),
    search: (input: WorkspaceSearchInput) =>
      invoke<WorkspaceSearchResult>(ipcChannels.workspace.search, input),
    replaceAll: (input: WorkspaceReplaceInput) =>
      invoke<WorkspaceReplaceResult>(ipcChannels.workspace.replaceAll, input),
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
      invoke<DocumentSessionRecord | null>(ipcChannels.session.getDocument, path),
    getLastDocument: () =>
      invoke<DocumentSessionRecord | null>(ipcChannels.session.getLastDocument),
    updateDocument: (input: UpdateDocumentSessionInput) =>
      invoke<DocumentSessionRecord>(ipcChannels.session.updateDocument, input)
  },
  shell: {
    openExternal: (url: string) => invoke<void>(ipcChannels.shell.openExternal, url),
    showItemInFolder: (path: string) => invoke<void>(ipcChannels.shell.showItemInFolder, path)
  },
  updater: {
    getStatus: () => invoke<UpdaterStatus>(ipcChannels.updater.getStatus),
    checkForUpdates: () => invoke<UpdaterStatus>(ipcChannels.updater.checkForUpdates),
    downloadUpdate: () => invoke<UpdaterStatus>(ipcChannels.updater.downloadUpdate),
    quitAndInstall: () => invoke<void>(ipcChannels.updater.quitAndInstall),
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
