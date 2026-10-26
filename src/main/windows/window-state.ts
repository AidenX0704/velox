import type Store from 'electron-store'
import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { getElectronStoreConstructor } from '../shared/electron-store'

export type StoredAppearance = 'system' | 'light' | 'dark'

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

const defaultAppearance: StoredAppearance = 'system'

type WindowStateStore = Store<{ mainWindow: WindowState; appearance: StoredAppearance }>

let windowStateStore: WindowStateStore | undefined

function getStore(): WindowStateStore {
  const Store = getElectronStoreConstructor()

  windowStateStore ??= new Store({
    name: 'window-state',
    defaults: {
      mainWindow: defaultWindowState,
      appearance: defaultAppearance
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

/**
 * Appearance is mirrored into a tiny electron-store file so the very first paint
 * can already use the right colors, long before the SQLite-backed preferences
 * are available. Kept in sync by the window:set-appearance IPC.
 */
export function getStoredAppearance(): StoredAppearance {
  const value = getStore().get('appearance', defaultAppearance)

  return value === 'light' || value === 'dark' || value === 'system' ? value : defaultAppearance
}

export function saveStoredAppearance(appearance: StoredAppearance): void {
  getStore().set('appearance', appearance)
}
