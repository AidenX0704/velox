import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { environment } from './environment'
import { registerSecurityGuards } from './security'
import { getDatabase } from '../database/database'
import { DocumentSessionRepository } from '../database/repositories/document-session-repository'
import { PreferencesRepository } from '../database/repositories/preferences-repository'
import { RecentRepository } from '../database/repositories/recent-repository'
import { WorkspaceStateRepository } from '../database/repositories/workspace-state-repository'
import { registerIpc } from '../ipc'
import { AppService } from '../services/app-service'
import { DocumentSessionService } from '../services/document-session-service'
import { DocumentService } from '../services/document-service'
import { ExportService } from '../services/export-service'
import { logger, registerProcessLogging } from '../services/log-service'
import { MenuService } from '../services/menu-service'
import { PreferencesService } from '../services/preferences-service'
import { RecentService } from '../services/recent-service'
import { SettingsService } from '../services/settings-service'
import { ShellService } from '../services/shell-service'
import { UpdaterService } from '../services/updater-service'
import { WorkspaceStateService } from '../services/workspace-state-service'
import { WorkspaceService } from '../services/workspace-service'
import { WindowManager } from '../windows/window-manager'

export async function createApp(): Promise<void> {
  registerProcessLogging()

  const hasSingleInstanceLock = app.requestSingleInstanceLock()

  if (!hasSingleInstanceLock) {
    app.quit()
    return
  }

  const windowManager = new WindowManager()

  app.on('second-instance', () => {
    const mainWindow = windowManager.ensureMainWindow()

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
  })

  await app.whenReady()

  electronApp.setAppUserModelId(environment.appUserModelId)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerSecurityGuards()

  const database = getDatabase()
  const settingsService = new SettingsService()
  const recentService = new RecentService(new RecentRepository(database))
  const updaterService = new UpdaterService()
  const services = {
    appService: new AppService(),
    documentService: new DocumentService(settingsService, recentService),
    exportService: new ExportService(),
    settingsService,
    preferencesService: new PreferencesService(new PreferencesRepository(database)),
    recentService,
    workspaceStateService: new WorkspaceStateService(new WorkspaceStateRepository(database)),
    documentSessionService: new DocumentSessionService(new DocumentSessionRepository(database)),
    shellService: new ShellService(),
    updaterService,
    workspaceService: new WorkspaceService(settingsService, recentService)
  }

  registerIpc(services)

  new MenuService(windowManager).install()

  updaterService.install()

  windowManager.createMainWindow()
  void updaterService.checkForUpdates()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow()
    }
  })

  logger.info('Velox main process started')
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
