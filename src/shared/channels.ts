export const ipcChannels = {
  app: {
    getInfo: 'app:get-info',
    openFile: 'app:open-file',
    getPendingOpenFile: 'app:get-pending-open-file'
  },
  window: {
    getIsMaximized: 'window:get-is-maximized',
    minimize: 'window:minimize',
    toggleMaximize: 'window:toggle-maximize',
    close: 'window:close',
    maximizedChanged: 'window:maximized-changed'
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update'
  },
  preferences: {
    getEditor: 'preferences:get-editor',
    updateEditor: 'preferences:update-editor',
    resetEditor: 'preferences:reset-editor'
  },
  recent: {
    listFiles: 'recent:list-files',
    listWorkspaces: 'recent:list-workspaces',
    clear: 'recent:clear'
  },
  history: {
    listTimeline: 'history:list-timeline',
    listBranches: 'history:list-branches',
    getDocumentActivity: 'history:get-document-activity'
  },
  document: {
    createUntitled: 'document:create-untitled',
    open: 'document:open',
    openPath: 'document:open-path',
    resolveLink: 'document:resolve-link',
    previewLink: 'document:preview-link',
    resolveImage: 'document:resolve-image',
    save: 'document:save',
    saveAs: 'document:save-as',
    export: 'document:export',
    exportProgress: 'document:export-progress'
  },
  workspace: {
    openFolder: 'workspace:open-folder',
    getTree: 'workspace:get-tree',
    getState: 'workspace:get-state',
    updateState: 'workspace:update-state',
    createEntry: 'workspace:create-entry',
    renameEntry: 'workspace:rename-entry',
    deleteEntry: 'workspace:delete-entry',
    search: 'workspace:search',
    replaceAll: 'workspace:replace-all',
    didChange: 'workspace:did-change'
  },
  session: {
    getDocument: 'session:get-document',
    getLastDocument: 'session:get-last-document',
    updateDocument: 'session:update-document'
  },
  shell: {
    openExternal: 'shell:open-external',
    showItemInFolder: 'shell:show-item-in-folder'
  },
  updater: {
    getStatus: 'updater:get-status',
    checkForUpdates: 'updater:check-for-updates',
    downloadUpdate: 'updater:download-update',
    quitAndInstall: 'updater:quit-and-install',
    statusChanged: 'updater:status-changed'
  },
  menu: {
    command: 'menu:command'
  }
} as const
