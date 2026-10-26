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
import { registerIpc, type MainServices } from '../ipc'
import { AppService } from '../services/app-service'
import { BackupService } from '../services/backup-service'
import { DocumentSessionService } from '../services/document-session-service'
import { DocumentService } from '../services/document-service'
import { FileWatchService } from '../services/file-watch-service'
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

const supportedDocumentExtensions = /\.(md|markdown|mdown|mkd|txt)$/i
let windowManager: WindowManager | undefined
let pendingOpenFile: string | null = null
let fileWatchService: FileWatchService | undefined
let bootstrapMarks: Array<[string, number]> = []
let rendererReported = false
const bootStartedAt = performance.now()

function mark(name: string): void {
  bootstrapMarks.push([name, performance.now() - bootStartedAt])
}

function isSupportedDocumentPath(filePath: string): boolean {
  return supportedDocumentExtensions.test(filePath)
}

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
    if (isSupportedDocumentPath(filePath)) {
      return filePath
    }
  }

  return null
}

function openDocumentFromSystem(filePath: string): void {
  if (!isSupportedDocumentPath(filePath)) {
    return
  }

  if (!app.isReady()) {
    pendingOpenFile = filePath
    return
  }

  const mainWindow = windowManager?.ensureMainWindow()

  if (!mainWindow) {
    pendingOpenFile = filePath
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.focus()

  if (mainWindow.webContents.isLoading()) {
    pendingOpenFile = filePath
    return
  }

  mainWindow.webContents.send(ipcChannels.app.openFile, filePath)
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  openDocumentFromSystem(filePath)
})

export async function createApp(): Promise<void> {
  registerProcessLogging()

  const hasSingleInstanceLock = app.requestSingleInstanceLock()

  if (!hasSingleInstanceLock) {
    app.quit()
    return
  }

  const appWindowManager = new WindowManager()
  windowManager = appWindowManager

  // Check for file path in command line arguments at startup
  const startupFilePath = getOpenFilePathFromArgs(process.argv)
  if (startupFilePath) {
    pendingOpenFile = startupFilePath
    logger.info(`File path from startup args: ${startupFilePath}`)
  }

  app.on('second-instance', (_event, argv) => {
    // Get file path from second instance arguments
    const filePath = getOpenFilePathFromArgs(argv)
    if (filePath) {
      logger.info(`File path from second instance: ${filePath}`)
      openDocumentFromSystem(filePath)
      return
    }

    const mainWindow = windowManager?.ensureMainWindow()

    if (mainWindow?.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow?.focus()
  })

  await app.whenReady()
  mark('app-ready')

  electronApp.setAppUserModelId(environment.appUserModelId)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerSecurityGuards()

  // ── Startup order matters ────────────────────────────────────────────────
  // 1. Create the window immediately. It paints the themed background plus the
  //    static skeleton baked into index.html, so the user sees UI within a few
  //    hundred milliseconds instead of staring at nothing.
  // 2. Initialise SQLite, services and IPC on the next tick. The renderer still
  //    has to fetch and parse its bundle before it can send its first IPC call,
  //    so this always wins the race by a wide margin (and preload retries once).
  const mainWindow = appWindowManager.createMainWindow()
  mark('window-created')

  mainWindow.on('focus', () => {
    // Network shares and WSL mounts do not deliver inotify events reliably.
    void fileWatchService?.verifyWatchedDocuments()
  })

  setImmediate(() => {
    try {
      const services = createServices()
      registerIpc(services)
      new MenuService(appWindowManager).install()
      mark('services-ready')

      setTimeout(() => {
        void services.updaterService.checkForUpdates()
      }, 8000)
    } catch (error) {
      logger.error('Deferred bootstrap failed', error)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      appWindowManager.createMainWindow()
    }
  })

  app.on('before-quit', () => {
    fileWatchService?.dispose()
  })

  app.on('will-quit', () => {
    flushStartupMarks()
  })

  // If the renderer never reports, still record how far the main process got —
  // a missing "renderer-ready" mark is itself the diagnosis.
  setTimeout(() => {
    if (rendererReported) {
      return
    }

    mark('renderer-not-ready-10s')
    flushStartupMarks()
  }, 10_000)

  logger.info('Velox main process started')
}

function flushStartupMarks(): void {
  if (bootstrapMarks.length === 0) {
    return
  }

  const rows = bootstrapMarks.map(([name, at]) => `${name}=${at.toFixed(1)}ms`)
  logger.info(`Startup timeline: ${rows.join(' ')}`)
  bootstrapMarks = []
}

/** Called over IPC once the renderer has produced its first real frame. */
export function markRendererReady(): void {
  rendererReported = true
  mark('renderer-ready')
  flushStartupMarks()
}

function createServices(): MainServices {
  const database = getDatabase()
  const settingsService = new SettingsService()
  const recentService = new RecentService(new RecentRepository(database))
  const historyService = new HistoryService(new HistoryRepository(database))
  const updaterService = new UpdaterService()
  const preferencesService = new PreferencesService(new PreferencesRepository(database))
  const watcher = new FileWatchService()
  fileWatchService = watcher

  updaterService.install()

  return {
    appService: new AppService(),
    backupService: new BackupService(preferencesService),
    documentService: new DocumentService(settingsService, recentService, historyService, watcher),
    historyService,
    settingsService,
    preferencesService,
    recentService,
    workspaceStateService: new WorkspaceStateService(new WorkspaceStateRepository(database)),
    documentSessionService: new DocumentSessionService(new DocumentSessionRepository(database)),
    shellService: new ShellService(),
    updaterService,
    workspaceService: new WorkspaceService(settingsService, recentService),
    fileWatchService: watcher
  }
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
