import { BrowserWindow, app, nativeTheme } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ipcChannels } from '../../shared/channels'
import { environment } from '../bootstrap/environment'
import { logger } from '../services/log-service'
import {
  getMainWindowBounds,
  getStoredAppearance,
  saveMainWindowState,
  shouldMaximizeMainWindow
} from './window-state'
import icon from '../../../resources/icon.png?asset'

/** First-paint background must match the active theme, otherwise a dark theme user
 *  sees a white flash before the renderer styles arrive. */
const windowBackground = {
  light: '#f5f5f3',
  dark: '#0b0b0a'
} as const

function readArgument(name: string): string | undefined {
  const prefix = `--${name}=`

  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

/** `--window-size=1280x800` gives visual-regression runs a fixed canvas. */
function readWindowSize(): { width: number; height: number } | null {
  const raw = readArgument('window-size')
  const match = raw ? /^(\d{3,4})x(\d{3,4})$/.exec(raw) : null

  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}

/** `--appearance=dark` pins the theme without touching the stored preference. */
function readAppearanceOverride(): 'light' | 'dark' | null {
  const raw = readArgument('appearance')

  return raw === 'light' || raw === 'dark' ? raw : null
}

/**
 * Screen capture for the visual-regression baseline. After the renderer reports
 * its first frame we freeze animations, grab the page and quit.
 */
function installCapture(mainWindow: BrowserWindow): void {
  const target = readArgument('capture')

  if (!target) {
    return
  }

  const settleMs = Number(readArgument('capture-delay') ?? 1200)

  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        try {
          await mainWindow.webContents.insertCSS(
            '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'
          )
          // One extra frame so the frozen styles are actually composited.
          await new Promise((resolve) => setTimeout(resolve, 120))

          // A window that has not been composited yet returns an empty image;
          // retry briefly instead of writing a 0-byte baseline.
          let image = await mainWindow.webContents.capturePage()

          for (let attempt = 0; attempt < 8 && image.isEmpty(); attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 250))
            image = await mainWindow.webContents.capturePage()
          }

          if (image.isEmpty()) {
            logger.error('Visual capture produced an empty image (window not composited?)')
            return
          }

          // Wait for a stable frame: two consecutive identical captures. Fixed
          // delays are not enough — lazy chunks and font swaps land at random.
          let previous = image.toPNG()

          for (let attempt = 0; attempt < 12; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 220))
            image = await mainWindow.webContents.capturePage()

            if (image.isEmpty()) {
              continue
            }

            const current = image.toPNG()

            if (current.equals(previous)) {
              await writeFile(target, current)
              const { width, height } = image.getSize()
              logger.info(
                `Visual capture written: ${target} (${width}x${height}, stable after ${attempt + 1} frames)`
              )
              return
            }

            previous = current
          }

          // Never stabilised; keep the last frame so the diff shows something.
          await writeFile(target, previous)
          logger.warn('Visual capture never stabilised; wrote the last frame')
        } catch (error) {
          logger.error('Visual capture failed', error)
        } finally {
          app.quit()
        }
      })()
    }, settleMs)
  })
}

export function createMainWindow(): BrowserWindow {
  // Applied before the window exists so Chromium resolves `prefers-color-scheme`
  // correctly for the very first paint (the static skeleton relies on it).
  nativeTheme.themeSource = readAppearanceOverride() ?? getStoredAppearance()
  logger.info(
    `Window theme: source=${nativeTheme.themeSource} dark=${nativeTheme.shouldUseDarkColors} argvAppearance=${readArgument('appearance') ?? 'none'}`
  )

  const sizeOverride = readWindowSize()
  const bounds = sizeOverride
    ? { ...getMainWindowBounds(), ...sizeOverride }
    : getMainWindowBounds()

  const mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 760,
    minHeight: 520,
    show: true,
    backgroundColor: nativeTheme.shouldUseDarkColors
      ? windowBackground.dark
      : windowBackground.light,
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hidden' as const,
          trafficLightPosition: { x: 14, y: 17 }
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

  if (!sizeOverride && shouldMaximizeMainWindow()) {
    mainWindow.maximize()
  }

  // A blank window with no error message is the worst possible failure mode in
  // a frameless app. Surface every renderer-side failure into the log.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error(`Renderer process gone: ${details.reason} (exit ${details.exitCode})`)
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    logger.error(`Renderer failed to load ${url}: ${description} (${code})`)
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    logger.error(`Preload failed (${preloadPath})`, error)
  })

  mainWindow.on('unresponsive', () => {
    logger.warn('Window became unresponsive')
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

  installCapture(mainWindow)

  if (environment.isDev && environment.rendererUrl) {
    mainWindow.loadURL(environment.rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
