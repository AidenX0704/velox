export const ipcChannels = {
  app: {
    getInfo: 'app:get-info'
  },
  window: {
    minimize: 'window:minimize',
    toggleMaximize: 'window:toggle-maximize',
    close: 'window:close'
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
  document: {
    createUntitled: 'document:create-untitled',
    open: 'document:open',
    openPath: 'document:open-path',
    resolveLink: 'document:resolve-link',
    previewLink: 'document:preview-link',
    save: 'document:save',
    saveAs: 'document:save-as'
  },
  workspace: {
    openFolder: 'workspace:open-folder',
    getTree: 'workspace:get-tree',
    getState: 'workspace:get-state',
    updateState: 'workspace:update-state'
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
  menu: {
    command: 'menu:command'
  }
} as const
