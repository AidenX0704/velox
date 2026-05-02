import { app, shell, session } from 'electron'
import { environment } from './environment'
import { logger } from '../services/log-service'

const allowedExternalProtocols = new Set(['https:', 'mailto:'])

export function registerSecurityGuards(): void {
  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      openExternalIfAllowed(url)
      return { action: 'deny' }
    })

    contents.on('will-navigate', (event, url) => {
      if (isTrustedAppNavigation(url)) {
        return
      }

      event.preventDefault()
      openExternalIfAllowed(url)
    })
  })

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [createContentSecurityPolicy()]
      }
    })
  })
}

function isTrustedAppNavigation(url: string): boolean {
  if (environment.isDev && environment.rendererUrl) {
    return url.startsWith(environment.rendererUrl)
  }

  return url.startsWith('file://')
}

function openExternalIfAllowed(url: string): void {
  try {
    const parsedUrl = new URL(url)

    if (!allowedExternalProtocols.has(parsedUrl.protocol)) {
      logger.warn('Blocked external navigation', url)
      return
    }

    shell.openExternal(url)
  } catch (error) {
    logger.warn('Invalid external navigation', { url, error })
  }
}

function createContentSecurityPolicy(): string {
  if (environment.isDev) {
    return [
      "default-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
    ].join('; ')
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'"
  ].join('; ')
}
