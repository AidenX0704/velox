import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import { ipcChannels } from '../../shared/channels'
import type { MenuCommand } from '../../shared/types'
import { WindowManager } from '../windows/window-manager'

export class MenuService {
  constructor(private readonly windowManager: WindowManager) {}

  install(): void {
    Menu.setApplicationMenu(Menu.buildFromTemplate(this.createTemplate()))
  }

  private createTemplate(): MenuItemConstructorOptions[] {
    return [
      ...(process.platform === 'darwin'
        ? [
            {
              label: app.name,
              submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }]
            } satisfies MenuItemConstructorOptions
          ]
        : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'New File',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.sendCommand('document:new')
          },
          {
            label: 'Open File...',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.sendCommand('document:open')
          },
          {
            label: 'Open Folder...',
            accelerator: 'CmdOrCtrl+Shift+O',
            click: () => this.sendCommand('workspace:open-folder')
          },
          { type: 'separator' },
          {
            label: 'Save',
            accelerator: 'CmdOrCtrl+S',
            click: () => this.sendCommand('document:save')
          },
          { type: 'separator' },
          process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'zoom' }]
      }
    ]
  }

  private sendCommand(command: MenuCommand): void {
    this.windowManager.ensureMainWindow().webContents.send(ipcChannels.menu.command, command)
  }
}
