import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

export const environment = {
  isDev: is.dev,
  isPackaged: app.isPackaged,
  rendererUrl: process.env['ELECTRON_RENDERER_URL'],
  appUserModelId: 'app.velox.desktop'
}
