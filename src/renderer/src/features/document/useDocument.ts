import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, Toast } from '@douyinfe/semi-ui'
import type {
  DocumentData,
  MenuCommand,
  RecentFileRecord,
  RecentWorkspaceRecord,
  WorkspaceEntry
} from '../../../../shared/types'
import type { EditorMode } from '../../modules/editor/model/types'

const welcomeContent = `# Welcome to Velox

Velox 是一个正在构建中的类 Typora Markdown 编辑器。

- 支持源码模式
- 支持源码 / 预览分栏
- 支持基础预览模式

从左上角打开 Markdown 文件，或直接开始编写。
`

interface DocumentState {
  path?: string
  title: string
  content: string
  dirty: boolean
  updatedAt?: string
}

function createInitialDocument(content = ''): DocumentState {
  return {
    title: 'Untitled.md',
    content,
    dirty: false
  }
}

function toDocumentState(document: DocumentData): DocumentState {
  return {
    path: document.path,
    title: document.title,
    content: document.content,
    dirty: document.dirty,
    updatedAt: document.updatedAt
  }
}

export function useDocument(): {
  document: DocumentState
  editorMode: EditorMode
  workspaceRoot: string | null
  workspaceTree: WorkspaceEntry[]
  recentFiles: RecentFileRecord[]
  recentWorkspaces: RecentWorkspaceRecord[]
  pendingAnchor: string | null
  wordCount: number
  setEditorMode: (mode: EditorMode) => void
  setContent: (content: string) => void
  createDocument: () => Promise<void>
  openDocument: () => Promise<void>
  openPath: (path: string) => Promise<boolean>
  openPathFromLink: (path: string, anchor?: string) => Promise<boolean>
  clearPendingAnchor: () => void
  saveDocument: () => Promise<void>
  saveDocumentAs: () => Promise<void>
  openWorkspace: () => Promise<void>
  refreshWorkspace: () => Promise<void>
  createWorkspaceEntry: (parentPath: string, name: string, type: 'file' | 'directory') => Promise<string | null>
  renameWorkspaceEntry: (path: string, newName: string) => Promise<string | null>
  deleteWorkspaceEntry: (path: string) => Promise<boolean>
} {
  const [document, setDocument] = useState<DocumentState>(() => createInitialDocument())
  const [editorMode, setEditorMode] = useState<EditorMode>('split')
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceEntry[]>([])
  const [recentFiles, setRecentFiles] = useState<RecentFileRecord[]>([])
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspaceRecord[]>([])
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null)

  const wordCount = useMemo(() => {
    const text = document.content.trim()

    if (!text) {
      return 0
    }

    return text.split(/\s+/).length
  }, [document.content])

  const setContent = useCallback((content: string) => {
    setDocument((current) => ({
      ...current,
      content,
      dirty: current.content !== content ? true : current.dirty
    }))
  }, [])

  const createDocument = useCallback(async () => {
    const result = await window.api.document.createUntitled()

    if (result.ok) {
      setDocument(toDocumentState(result.data))
    } else {
      Toast.error(result.error.message)
    }
  }, [])

  const refreshRecent = useCallback(async () => {
    const [filesResult, workspacesResult] = await Promise.all([
      window.api.recent.listFiles(),
      window.api.recent.listWorkspaces()
    ])

    if (filesResult.ok) {
      setRecentFiles(filesResult.data)
    }

    if (workspacesResult.ok) {
      setRecentWorkspaces(workspacesResult.data)
    }
  }, [])

  const loadWorkspace = useCallback(async (path: string) => {
    setWorkspaceRoot(path)

    const treeResult = await window.api.workspace.getTree(path)

    if (treeResult.ok) {
      setWorkspaceTree(treeResult.data)
    } else {
      Toast.error(treeResult.error.message)
    }
  }, [])

  const refreshWorkspace = useCallback(async () => {
    if (workspaceRoot) {
      const treeResult = await window.api.workspace.getTree(workspaceRoot)
      if (treeResult.ok) {
        setWorkspaceTree(treeResult.data)
      }
    }
  }, [workspaceRoot])

  useEffect(() => {
    return window.api.workspace.onDidChange(() => {
      void refreshWorkspace()
    })
  }, [refreshWorkspace])

  const createWorkspaceEntry = useCallback(
    async (parentPath: string, name: string, type: 'file' | 'directory'): Promise<string | null> => {
      const result = await window.api.workspace.createEntry({ parentPath, name, type })
      if (result.ok) {
        return result.data
      }
      Toast.error(result.error.message)
      return null
    },
    []
  )

  const renameWorkspaceEntry = useCallback(
    async (path: string, newName: string): Promise<string | null> => {
      const result = await window.api.workspace.renameEntry({ path, newName })
      if (result.ok) {
        if (document.path === path) {
           setDocument(prev => ({...prev, path: result.data}))
        }
        return result.data
      }
      Toast.error(result.error.message)
      return null
    },
    [document.path]
  )

  const deleteWorkspaceEntry = useCallback(
    async (path: string): Promise<boolean> => {
      const result = await window.api.workspace.deleteEntry({ path })
      if (result.ok) {
         if (document.path === path) {
             setDocument(createInitialDocument())
         }
         return true
      }
      Toast.error(result.error.message)
      return false
    },
    [document.path]
  )

  const openPath = useCallback(
    async (path: string): Promise<boolean> => {
      const result = await window.api.document.openPath(path)

      if (result.ok) {
        setDocument(toDocumentState(result.data))
        void refreshRecent()
        return true
      }

      Toast.error(result.error.message)
      return false
    },
    [refreshRecent]
  )

  const restoreLastDocument = useCallback(async (): Promise<void> => {
    const lastSessionResult = await window.api.session.getLastDocument()

    if (!lastSessionResult.ok) {
      Toast.error(lastSessionResult.error.message)
      return
    }

    const lastSession = lastSessionResult.data

    if (!lastSession) {
      return
    }

    const opened = await openPath(lastSession.path)

    if (opened) {
      setEditorMode(lastSession.mode)
    }
  }, [openPath])

  const confirmDiscardChanges = useCallback(async (): Promise<boolean> => {
    if (!document.dirty) {
      return true
    }

    return new Promise((resolve) => {
      Modal.confirm({
        title: '当前文档尚未保存',
        content: '跳转到其他文档会丢失未保存的修改，是否继续？',
        okText: '继续跳转',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
  }, [document.dirty])

  const openPathFromLink = useCallback(
    async (path: string, anchor?: string): Promise<boolean> => {
      if (path !== document.path) {
        const confirmed = await confirmDiscardChanges()

        if (!confirmed) {
          return false
        }
      }

      const opened = path === document.path ? true : await openPath(path)

      if (opened) {
        setPendingAnchor(anchor ?? null)
      }

      return opened
    },
    [confirmDiscardChanges, document.path, openPath]
  )

  const clearPendingAnchor = useCallback(() => {
    setPendingAnchor(null)
  }, [])

  const openDocument = useCallback(async () => {
    const result = await window.api.document.open()

    if (result.ok && result.data) {
      setDocument(toDocumentState(result.data))
      void refreshRecent()
    } else if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [refreshRecent])

  const saveDocument = useCallback(async () => {
    const result = document.path
      ? await window.api.document.save({ path: document.path, content: document.content })
      : await window.api.document.saveAs({ content: document.content })

    if (result.ok && result.data) {
      setDocument(toDocumentState(result.data))
      Toast.success('已保存')
      void refreshRecent()
    } else if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [document.content, document.path, refreshRecent])

  const saveDocumentAs = useCallback(async () => {
    const result = await window.api.document.saveAs({
      defaultPath: document.path,
      content: document.content
    })

    if (result.ok && result.data) {
      setDocument(toDocumentState(result.data))
      Toast.success('已另存为')
      void refreshRecent()
    } else if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [document.content, document.path, refreshRecent])

  const openWorkspace = useCallback(async () => {
    const result = await window.api.workspace.openFolder()

    if (!result.ok) {
      Toast.error(result.error.message)
      return
    }

    if (!result.data) {
      return
    }

    await loadWorkspace(result.data)
    void refreshRecent()
  }, [loadWorkspace, refreshRecent])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshRecent()

      window.api.preferences.getEditor().then((result) => {
        if (!result.ok) {
          Toast.error(result.error.message)
          return
        }

        if (!result.data.hasSeenWelcome) {
          setDocument(createInitialDocument(welcomeContent))
          void window.api.preferences.updateEditor({ hasSeenWelcome: true })
          return
        }

        void restoreLastDocument()
      })

      window.api.recent.listWorkspaces().then((result) => {
        if (result.ok && result.data[0]) {
          void loadWorkspace(result.data[0].path)
        }
      })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadWorkspace, refreshRecent, restoreLastDocument])

  useEffect(() => {
    return window.api.menu.onCommand((command: MenuCommand) => {
      if (command === 'document:new') {
        void createDocument()
      }

      if (command === 'document:open') {
        void openDocument()
      }

      if (command === 'document:save') {
        void saveDocument()
      }

      if (command === 'workspace:open-folder') {
        void openWorkspace()
      }
    })
  }, [createDocument, openDocument, openWorkspace, saveDocument])

  return {
    document,
    editorMode,
    workspaceRoot,
    workspaceTree,
    recentFiles,
    recentWorkspaces,
    pendingAnchor,
    wordCount,
    setEditorMode,
    setContent,
    createDocument,
    openDocument,
    openPath,
    openPathFromLink,
    clearPendingAnchor,
    saveDocument,
    saveDocumentAs,
    openWorkspace,
    refreshWorkspace,
    createWorkspaceEntry,
    renameWorkspaceEntry,
    deleteWorkspaceEntry
  }
}
