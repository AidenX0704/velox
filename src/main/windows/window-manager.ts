import { BrowserWindow } from 'electron'
import { createMainWindow } from './main-window'

export class WindowManager {
  private mainWindow?: BrowserWindow

  createMainWindow(): BrowserWindow {
    this.mainWindow = createMainWindow()
    return this.mainWindow
  }

  getMainWindow(): BrowserWindow | undefined {
    return this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : undefined
  }

  ensureMainWindow(): BrowserWindow {
    return this.getMainWindow() ?? this.createMainWindow()
  }
}
