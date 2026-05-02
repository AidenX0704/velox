import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { logger } from './log-service'

const updateFeedUrl = process.env['VELOX_UPDATE_URL']

export class UpdaterService {
  install(): void {
    autoUpdater.logger = logger

    if (updateFeedUrl) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: updateFeedUrl
      })
    }

    autoUpdater.on('error', (error) => {
      logger.error('Auto updater failed', error)
    })
  }

  checkForUpdates(): void {
    if (!app.isPackaged || !updateFeedUrl) {
      return
    }

    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      logger.error('Failed to check for updates', error)
    })
  }
}
