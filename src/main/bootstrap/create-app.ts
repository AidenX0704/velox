import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { isAbsolute, resolve } from 'node:path'
import { environment } from './environment'
import { registerSecurityGuards } from './security'
import { getDatabase } from '../database/database'
import { DocumentSessionRepository } from '../database/repositories/document-session-repository'
import { HistoryRepository } from '../database/repositories/history-repository'
import { PreferencesRepository } from '../database/repositories/preferences-repository'
import { RecentRepository } from '../database/repositories/recent-repository'
import { WorkspaceStateRepository } from '../database/repositories/workspace-state-repository'
import { registerIpc } from '../ipc'
import { AppService } from '../services/app-service'
import { DocumentSessionService } from '../services/document-session-service'
import { DocumentService } from '../services/document-service'
import { ExportService } from '../services/export-service'
import { HistoryService } from '../services/history-service'
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
import { ipcChannels } from '../../shared/channels'

function getOpenFilePathFromArgs(argv: string[]): string | null {
  // On Windows/Linux, the file path is the last argument when opening a file
  // Skip arguments that are flags (start with --)
  const args = argv.slice(1) // Remove the first arg which is the app path

  for (const arg of args) {
    if (arg.startsWith('--') || arg.startsWith('-')) {
      continue
    }

    // Resolve to absolute path if needed
    const filePath = isAbsolute(arg) ? arg : resolve(arg)

    // Check if it's a markdown file
    if (/\.(md|markdown|mdown|mkd|txt)$/i.test(filePath)) {
      return filePath
    }
  }

  return null
}

let pendingOpenFile: string | null = null

export async function createApp(): Promise<void> {
  registerProcessLogging()

  const hasSingleInstanceLock = app.requestSingleInstanceLock()

  if (!hasSingleInstanceLock) {
    app.quit()
    return
  }

  const windowManager = new WindowManager()

  // Check for file path in command line arguments at startup
  const startupFilePath = getOpenFilePathFromArgs(process.argv)
  if (startupFilePath) {
    pendingOpenFile = startupFilePath
    logger.info(`File path from startup args: ${startupFilePath}`)
  }

  app.on('second-instance', (_event, argv) => {
    const mainWindow = windowManager.ensureMainWindow()

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()

    // Get file path from second instance arguments
    const filePath = getOpenFilePathFromArgs(argv)
    if (filePath) {
      logger.info(`File path from second instance: ${filePath}`)
      mainWindow.webContents.send(ipcChannels.app.openFile, filePath)
    }
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
  const historyService = new HistoryService(new HistoryRepository(database))
  const updaterService = new UpdaterService()
  const services = {
    appService: new AppService(),
    documentService: new DocumentService(settingsService, recentService, historyService),
    exportService: new ExportService(),
    historyService,
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

  setTimeout(() => {
    void updaterService.checkForUpdates()
  }, 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow()
    }
  })

  logger.info('Velox main process started')
}

export function getPendingOpenFile(): string | null {
  const filePath = pendingOpenFile
  pendingOpenFile = null
  return filePath
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
