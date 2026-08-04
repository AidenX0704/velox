import { ipcChannels } from './channels'
import { schemas } from './contracts'
import { registerIpcHandler } from './router'
import { BrowserWindow } from 'electron'
import { AppService } from '../services/app-service'
import { BackupService } from '../services/backup-service'
import { resolveDocumentImage } from '../services/document-image'
import { DocumentService } from '../services/document-service'
import { DocumentSessionService } from '../services/document-session-service'
import { ExportService } from '../services/export-service'
import { HistoryService } from '../services/history-service'
import { PreferencesService } from '../services/preferences-service'
import { RecentService } from '../services/recent-service'
import { SettingsService } from '../services/settings-service'
import { ShellService } from '../services/shell-service'
import { UpdaterService } from '../services/updater-service'
import { WorkspaceService } from '../services/workspace-service'
import { WorkspaceStateService } from '../services/workspace-state-service'
import { getPendingOpenFile } from '../bootstrap/create-app'

export interface MainServices {
  appService: AppService
  backupService: BackupService
  documentService: DocumentService
  exportService: ExportService
  historyService: HistoryService
  settingsService: SettingsService
  preferencesService: PreferencesService
  recentService: RecentService
  workspaceStateService: WorkspaceStateService
  documentSessionService: DocumentSessionService
  shellService: ShellService
  updaterService: UpdaterService
  workspaceService: WorkspaceService
}

export function registerIpc(services: MainServices): void {
  registerIpcHandler(ipcChannels.app.getInfo, schemas.empty, () => services.appService.getInfo())
  registerIpcHandler(ipcChannels.app.getPendingOpenFile, schemas.empty, () => getPendingOpenFile())

  registerIpcHandler(ipcChannels.window.getIsMaximized, schemas.empty, (_input, event) => {
    return Boolean(BrowserWindow.fromWebContents(event.sender)?.isMaximized())
  })
  registerIpcHandler(ipcChannels.window.minimize, schemas.empty, (_input, event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  registerIpcHandler(ipcChannels.window.toggleMaximize, schemas.empty, (_input, event) => {
    const window = BrowserWindow.fromWebContents(event.sender)

    if (!window) {
      return
    }

    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })
  registerIpcHandler(ipcChannels.window.close, schemas.empty, (_input, event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  registerIpcHandler(ipcChannels.settings.get, schemas.empty, () => services.settingsService.get())
  registerIpcHandler(ipcChannels.settings.update, schemas.settingsPatch, (input) =>
    services.settingsService.update(input)
  )

  registerIpcHandler(ipcChannels.preferences.getEditor, schemas.empty, () =>
    services.preferencesService.getEditorPreferences()
  )
  registerIpcHandler(
    ipcChannels.preferences.updateEditor,
    schemas.editorPreferencesPatch,
    (input) => services.preferencesService.updateEditorPreferences(input)
  )
  registerIpcHandler(ipcChannels.preferences.resetEditor, schemas.empty, () =>
    services.preferencesService.resetEditorPreferences()
  )

  registerIpcHandler(ipcChannels.backup.getLastRun, schemas.empty, () =>
    services.backupService.getLastRun()
  )
  registerIpcHandler(ipcChannels.backup.run, schemas.backupRun, (input, event) =>
    services.backupService.run(input.sourcePath, (status) => {
      event.sender.send(ipcChannels.backup.progress, status)
    })
  )

  registerIpcHandler(ipcChannels.recent.listFiles, schemas.empty, () =>
    services.recentService.listFiles()
  )
  registerIpcHandler(ipcChannels.recent.listWorkspaces, schemas.empty, () =>
    services.recentService.listWorkspaces()
  )
  registerIpcHandler(ipcChannels.recent.clear, schemas.empty, () => {
    services.recentService.clear()
  })

  registerIpcHandler(ipcChannels.history.listTimeline, schemas.optionalPath, (path) =>
    services.historyService.listTimeline(path)
  )
  registerIpcHandler(ipcChannels.history.listBranches, schemas.optionalPath, (path) =>
    services.historyService.listBranches(path)
  )
  registerIpcHandler(ipcChannels.history.getDocumentActivity, schemas.path, (path) =>
    services.historyService.getDocumentActivity(path)
  )

  registerIpcHandler(ipcChannels.document.createUntitled, schemas.empty, () =>
    services.documentService.createUntitled()
  )
  registerIpcHandler(ipcChannels.document.open, schemas.empty, () =>
    services.documentService.open()
  )
  registerIpcHandler(ipcChannels.document.openPath, schemas.path, (path) =>
    services.documentService.openPath(path)
  )
  registerIpcHandler(ipcChannels.document.resolveLink, schemas.resolveDocumentLink, (input) =>
    services.documentService.resolveLink(input)
  )
  registerIpcHandler(ipcChannels.document.previewLink, schemas.resolveDocumentLink, (input) =>
    services.documentService.previewLink(input)
  )
  registerIpcHandler(ipcChannels.document.resolveImage, schemas.resolveDocumentImage, (input) =>
    resolveDocumentImage(input)
  )
  registerIpcHandler(ipcChannels.document.save, schemas.saveDocument, (input) =>
    services.documentService.save(input)
  )
  registerIpcHandler(ipcChannels.document.saveAs, schemas.saveDocumentAs, (input) =>
    services.documentService.saveAs(input)
  )
  registerIpcHandler(ipcChannels.document.export, schemas.exportDocument, (input, event) =>
    services.exportService.exportDocument(input, (progress) => {
      event.sender.send(ipcChannels.document.exportProgress, progress)
    })
  )

  registerIpcHandler(ipcChannels.workspace.openFolder, schemas.empty, () =>
    services.workspaceService.openFolder()
  )
  registerIpcHandler(ipcChannels.workspace.getTree, schemas.workspaceTree, (input) =>
    services.workspaceService.getTree(input.rootPath, input.expandedPaths)
  )
  registerIpcHandler(ipcChannels.workspace.createEntry, schemas.createWorkspaceEntry, (input) =>
    services.workspaceService.createEntry(input.parentPath, input.name, input.type)
  )
  registerIpcHandler(ipcChannels.workspace.renameEntry, schemas.renameWorkspaceEntry, (input) =>
    services.workspaceService.renameEntry(input.path, input.newName)
  )
  registerIpcHandler(ipcChannels.workspace.deleteEntry, schemas.deleteWorkspaceEntry, (input) =>
    services.workspaceService.deleteEntry(input.path)
  )
  registerIpcHandler(ipcChannels.workspace.search, schemas.workspaceSearch, (input) =>
    services.workspaceService.search(input)
  )
  registerIpcHandler(ipcChannels.workspace.replaceAll, schemas.workspaceReplaceAll, (input) =>
    services.workspaceService.replaceAll(input)
  )
  registerIpcHandler(ipcChannels.workspace.getState, schemas.path, (path) =>
    services.workspaceStateService.get(path)
  )
  registerIpcHandler(ipcChannels.workspace.updateState, schemas.workspaceState, (input) =>
    services.workspaceStateService.update(input)
  )

  registerIpcHandler(ipcChannels.session.getDocument, schemas.path, (path) =>
    services.documentSessionService.get(path)
  )
  registerIpcHandler(ipcChannels.session.getLastDocument, schemas.empty, () =>
    services.documentSessionService.getLast()
  )
  registerIpcHandler(ipcChannels.session.updateDocument, schemas.documentSession, (input) =>
    services.documentSessionService.update(input)
  )

  registerIpcHandler(ipcChannels.shell.openExternal, schemas.url, (url) =>
    services.shellService.openExternal(url)
  )
  registerIpcHandler(ipcChannels.shell.showItemInFolder, schemas.path, (path) => {
    services.shellService.showItemInFolder(path)
  })

  registerIpcHandler(ipcChannels.updater.getStatus, schemas.empty, () =>
    services.updaterService.getStatus()
  )
  registerIpcHandler(ipcChannels.updater.checkForUpdates, schemas.empty, () =>
    services.updaterService.checkForUpdates()
  )
  registerIpcHandler(ipcChannels.updater.downloadUpdate, schemas.empty, () =>
    services.updaterService.downloadUpdate()
  )
  registerIpcHandler(ipcChannels.updater.quitAndInstall, schemas.empty, () => {
    services.updaterService.quitAndInstall()
  })
}
