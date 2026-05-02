import type Store from 'electron-store'
import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { getElectronStoreConstructor } from '../shared/electron-store'

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
}

const defaultWindowState: WindowState = {
  width: 1100,
  height: 760,
  isMaximized: false
}

type WindowStateStore = Store<{ mainWindow: WindowState }>

let windowStateStore: WindowStateStore | undefined

function getStore(): WindowStateStore {
  const Store = getElectronStoreConstructor()

  windowStateStore ??= new Store({
    name: 'window-state',
    defaults: {
      mainWindow: defaultWindowState
    }
  }) as unknown as WindowStateStore

  return windowStateStore
}

export function getMainWindowBounds(): BrowserWindowConstructorOptions {
  const state = getStore().get('mainWindow', defaultWindowState)

  return {
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y
  }
}

export function saveMainWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) {
    return
  }

  const bounds = window.getBounds()

  getStore().set('mainWindow', {
    ...bounds,
    isMaximized: window.isMaximized()
  })
}

export function shouldMaximizeMainWindow(): boolean {
  return getStore().get('mainWindow', defaultWindowState).isMaximized
}
