import { app, BrowserWindow } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import { ipcChannels } from '../../shared/channels'
import type { UpdaterStatus } from '../../shared/types'
import { logger } from './log-service'

const updateFeedUrl = process.env['VELOX_UPDATE_URL']

export class UpdaterService {
  private status: UpdaterStatus = createUpdaterStatus(
    'idle',
    app.isPackaged ? '准备检查更新' : '开发模式下不会自动检查更新'
  )

  install(): void {
    autoUpdater.logger = logger
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    if (process.env['VELOX_ALLOW_PRERELEASE_UPDATES'] === 'true') {
      autoUpdater.allowPrerelease = true
    }

    if (updateFeedUrl) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: updateFeedUrl
      })
    }

    autoUpdater.on('checking-for-update', () => {
      this.setStatus(createUpdaterStatus('checking', '正在检查更新'))
    })

    autoUpdater.on('update-available', (info) => {
      this.setStatus(createUpdateInfoStatus('available', info, `发现新版本 ${info.version}`))
    })

    autoUpdater.on('update-not-available', (info) => {
      this.setStatus(createUpdateInfoStatus('not-available', info, '当前已是最新版本'))
    })

    autoUpdater.on('download-progress', (progress) => {
      this.setStatus(createDownloadStatus(progress))
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.setStatus(createUpdateInfoStatus('downloaded', info, `版本 ${info.version} 已下载`))
    })

    autoUpdater.on('error', (error) => {
      logger.error('Auto updater failed', error)
      this.setStatus(createUpdaterStatus('error', '更新检查失败', { error: error.message }))
    })
  }

  getStatus(): UpdaterStatus {
    return this.status
  }

  async checkForUpdates(): Promise<UpdaterStatus> {
    if (!app.isPackaged) {
      const status = createUpdaterStatus('not-available', '开发模式下不会检查线上更新')
      this.setStatus(status)
      return status
    }

    this.setStatus(createUpdaterStatus('checking', '正在检查更新'))

    try {
      await autoUpdater.checkForUpdates()
      return this.status
    } catch (error) {
      const status = createUpdaterStatus('error', '更新检查失败', {
        error: getErrorMessage(error)
      })
      this.setStatus(status)
      return status
    }
  }

  async downloadUpdate(): Promise<UpdaterStatus> {
    if (!app.isPackaged) {
      const status = createUpdaterStatus('not-available', '开发模式下不会下载线上更新')
      this.setStatus(status)
      return status
    }

    if (this.status.state !== 'available') {
      return this.status
    }

    this.setStatus({
      ...this.status,
      state: 'downloading',
      message: '正在下载更新',
      percent: 0,
      updatedAt: new Date().toISOString()
    })

    try {
      await autoUpdater.downloadUpdate()
      return this.status
    } catch (error) {
      const status = createUpdaterStatus('error', '更新下载失败', {
        error: getErrorMessage(error)
      })
      this.setStatus(status)
      return status
    }
  }

  quitAndInstall(): void {
    if (this.status.state !== 'downloaded') {
      return
    }

    autoUpdater.quitAndInstall(false, true)
  }

  private setStatus(status: UpdaterStatus): void {
    this.status = status

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(ipcChannels.updater.statusChanged, status)
    }
  }
}

function createUpdaterStatus(
  state: UpdaterStatus['state'],
  message: string,
  extra: Partial<UpdaterStatus> = {}
): UpdaterStatus {
  return {
    state,
    message,
    updatedAt: new Date().toISOString(),
    ...extra
  }
}

function createUpdateInfoStatus(
  state: UpdaterStatus['state'],
  info: UpdateInfo,
  message: string
): UpdaterStatus {
  return createUpdaterStatus(state, message, {
    version: info.version,
    releaseName: info.releaseName ?? undefined,
    releaseDate: info.releaseDate,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
  })
}

function createDownloadStatus(progress: ProgressInfo): UpdaterStatus {
  return createUpdaterStatus('downloading', `正在下载更新 ${Math.round(progress.percent)}%`, {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond
  })
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
