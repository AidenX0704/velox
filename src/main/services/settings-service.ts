import type Store from 'electron-store'
import type { AppSettings, AppSettingsPatch } from '../../shared/types'
import { getElectronStoreConstructor } from '../shared/electron-store'

export const defaultSettings: AppSettings = {
  editor: {
    fontSize: 16,
    autosaveInterval: 3000,
    wordWrap: true
  },
  appearance: {
    theme: 'system'
  },
  workspace: {
    recentFiles: [],
    recentFolders: []
  }
}

type SettingsStore = Store<AppSettings>

let settingsStore: SettingsStore | undefined

function getStore(): SettingsStore {
  const Store = getElectronStoreConstructor()

  settingsStore ??= new Store({
    name: 'settings',
    defaults: defaultSettings
  }) as unknown as SettingsStore

  return settingsStore
}

function uniqueRecent(items: string[], nextItem: string, limit = 20): string[] {
  return [nextItem, ...items.filter((item) => item !== nextItem)].slice(0, limit)
}

export class SettingsService {
  get(): AppSettings {
    return getStore().store
  }

  update(patch: AppSettingsPatch): AppSettings {
    const current = this.get()
    const next: AppSettings = {
      ...current,
      ...patch,
      editor: {
        ...current.editor,
        ...patch.editor
      },
      appearance: {
        ...current.appearance,
        ...patch.appearance
      },
      workspace: {
        ...current.workspace,
        ...patch.workspace
      }
    }

    getStore().store = next
    return next
  }

  addRecentFile(filePath: string): AppSettings {
    const current = this.get()

    return this.update({
      workspace: {
        ...current.workspace,
        recentFiles: uniqueRecent(current.workspace.recentFiles, filePath)
      }
    })
  }

  addRecentFolder(folderPath: string): AppSettings {
    const current = this.get()

    return this.update({
      workspace: {
        ...current.workspace,
        lastOpenedFolder: folderPath,
        recentFolders: uniqueRecent(current.workspace.recentFolders, folderPath)
      }
    })
  }
}
