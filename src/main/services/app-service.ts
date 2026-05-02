import { app } from 'electron'
import type { AppInfo } from '../../shared/types'

export class AppService {
  getInfo(): AppInfo {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
      paths: {
        userData: app.getPath('userData'),
        logs: app.getPath('logs')
      }
    }
  }
}
