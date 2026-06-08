import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { ipcChannels } from '../../shared/channels'
import { environment } from '../bootstrap/environment'
import { getMainWindowBounds, saveMainWindowState, shouldMaximizeMainWindow } from './window-state'
import icon from '../../../resources/icon.png?asset'

export function createMainWindow(): BrowserWindow {
  let hasShown = false
  const showMainWindow = (): void => {
    if (hasShown || mainWindow.isDestroyed()) {
      return
    }

    hasShown = true

    if (shouldMaximizeMainWindow()) {
      mainWindow.maximize()
    }

    mainWindow.show()
  }

  const mainWindow = new BrowserWindow({
    ...getMainWindowBounds(),
    minWidth: 760,
    minHeight: 520,
    show: false,
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: { x: 2, y: 2 }
        }
      : { frame: false }),
    autoHideMenuBar: true,
    title: 'Velox',
    ...(process.platform === 'darwin' ? {} : { icon }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', showMainWindow)
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(showMainWindow, 120)
  })

  mainWindow.on('close', () => {
    saveMainWindowState(mainWindow)
  })

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send(ipcChannels.window.maximizedChanged, true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send(ipcChannels.window.maximizedChanged, false)
  })

  if (environment.isDev && environment.rendererUrl) {
    mainWindow.loadURL(environment.rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
