import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { ipcChannels } from '../shared/channels'
import type {
  AppInfo,
  AppSettings,
  DocumentLinkPreview,
  DocumentSessionRecord,
  DocumentData,
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
  VeloxAPI,
  WorkspaceEntry,
  WorkspaceStateRecord
} from '../shared/types'
import type { EditorPreferences } from '../shared/preferences'

function invoke<T>(channel: string, payload?: unknown): Promise<Result<T>> {
  return ipcRenderer.invoke(channel, payload)
}

const api: VeloxAPI = {
  app: {
    getInfo: () => invoke<AppInfo>(ipcChannels.app.getInfo)
  },
  window: {
    minimize: () => invoke<void>(ipcChannels.window.minimize),
    toggleMaximize: () => invoke<void>(ipcChannels.window.toggleMaximize),
    close: () => invoke<void>(ipcChannels.window.close)
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
      invoke<DocumentData | null>(ipcChannels.document.saveAs, input)
  },
  workspace: {
    openFolder: () => invoke<string | null>(ipcChannels.workspace.openFolder),
    getTree: (rootPath: string) =>
      invoke<WorkspaceEntry[]>(ipcChannels.workspace.getTree, rootPath),
    getState: (rootPath: string) =>
      invoke<WorkspaceStateRecord | null>(ipcChannels.workspace.getState, rootPath),
    updateState: (input: UpdateWorkspaceStateInput) =>
      invoke<WorkspaceStateRecord>(ipcChannels.workspace.updateState, input)
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
