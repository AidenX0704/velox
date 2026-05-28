import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Progress, Toast, Typography } from '@douyinfe/semi-ui'
import { exportFormatLabels, type ExportFormat, type ExportProgress } from '../../../shared/export'
import type { UpdaterStatus } from '../../../shared/types'
import { MarkdownEditor } from '../modules/editor/MarkdownEditor'
import type { CursorPosition, EditorMode } from '../modules/editor/model/types'
import { useTabs } from '../features/tabs/useTabs'
import { TabBar } from '../features/tabs/TabBar'
import { useEditorSettings } from '../features/settings/useEditorSettings'
import {
  applyThemeToDocument,
  resolveAppearanceMode,
  resolveThemeAccent,
  subscribeToSystemAppearance,
  type ResolvedAppearanceMode
} from '../features/theme/theme'
import { SettingsPage } from './SettingsPanel'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'

type AppView = 'editor' | 'settings'

const defaultSidebarPaneWidth = 236
const minSidebarPaneWidth = 180
const maxSidebarPaneWidth = 480
const sidebarPaneWidthStorageKey = 'velox:sidebar-pane-width'

function computeWordCount(content: string): number {
  const text = content.trim()
  if (!text) return 0
  return text.split(/\s+/).length
}

function getDroppedFilePath(file: File): string {
  return (file as File & { path?: string }).path || window.api.app.getPathForFile(file)
}

function hasExternalFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files')
}

function clampSidebarPaneWidth(width: number): number {
  return Math.min(maxSidebarPaneWidth, Math.max(minSidebarPaneWidth, Math.round(width)))
}

function getInitialSidebarPaneWidth(): number {
  const storedWidth = Number(window.localStorage.getItem(sidebarPaneWidthStorageKey))
  return Number.isFinite(storedWidth) ? clampSidebarPaneWidth(storedWidth) : defaultSidebarPaneWidth
}

export function MainLayout(): React.JSX.Element {
  const [activeView, setActiveView] = useState<AppView>('editor')
  const [platform, setPlatform] = useState<string>('')
  const [resolvedAppearanceMode, setResolvedAppearanceMode] =
    useState<ResolvedAppearanceMode>('light')
  const [expandedWorkspacePaths, setExpandedWorkspacePaths] = useState<string[]>([])
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [sidebarPaneWidth, setSidebarPaneWidth] = useState(getInitialSidebarPaneWidth)
  const [workspaceTree, setWorkspaceTree] = useState<
    import('../../../shared/types').WorkspaceEntry[]
  >([])
  const [recentFiles, setRecentFiles] = useState<
    import('../../../shared/types').RecentFileRecord[]
  >([])
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null)
  const workspacePersistTimerRef = useRef<number | undefined>(undefined)
  const sessionPersistTimerRef = useRef<number | undefined>(undefined)
  const exportProgressCloseTimerRef = useRef<number | undefined>(undefined)
  const updaterManualCheckRef = useRef(false)
  const updaterAvailablePromptRef = useRef<string | undefined>(undefined)
  const updaterInstallPromptRef = useRef<string | undefined>(undefined)
  const { settings: editorSettings, updateSettings, resetSettings } = useEditorSettings()

  const {
    tabs,
    activeTabId,
    activeTab,
    setActiveTabId,
    setEditorMode,
    setContent,
    setCursorPosition,
    addTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    closeSavedTabs,
    pinTab,
    unpinTab,
    reorderTabs,
    switchToNextTab,
    switchToPreviousTab,
    switchToTabByIndex,
    updateTabDocument,
    findTabByPath
  } = useTabs()

  // Refs for stable callback references
  const openPathRef = useRef<
    ((path: string, options?: { mode?: EditorMode }) => Promise<boolean>) | undefined
  >(undefined)
  const loadWorkspaceRef = useRef<((path: string) => Promise<void>) | undefined>(undefined)
  const refreshRecentRef = useRef<(() => Promise<void>) | undefined>(undefined)
  const hasInitializedRef = useRef(false)
  const sidebarResizeRef = useRef<{
    pointerId: number
    startX: number
    startWidth: number
  } | null>(null)

  const document = useMemo(
    () =>
      activeTab?.document ?? {
        title: 'Untitled.md',
        content: '',
        dirty: false,
        path: undefined
      },
    [activeTab?.document]
  )
  const editorMode = activeTab?.editorMode ?? 'split'
  const cursorPosition = useMemo<CursorPosition>(
    () => ({
      line: activeTab?.cursorLine ?? 1,
      column: activeTab?.cursorColumn ?? 1
    }),
    [activeTab?.cursorLine, activeTab?.cursorColumn]
  )
  const wordCount = useMemo(() => computeWordCount(document.content), [document.content])

  const refreshRecent = useCallback(async () => {
    const [filesResult] = await Promise.all([window.api.recent.listFiles()])
    if (filesResult.ok) {
      setRecentFiles(filesResult.data)
    }
  }, [])

  const saveDocument = useCallback(async (): Promise<void> => {
    if (!activeTab) return
    const result = activeTab.document.path
      ? await window.api.document.save({
          path: activeTab.document.path,
          content: activeTab.document.content
        })
      : await window.api.document.saveAs({ content: activeTab.document.content })

    if (result.ok && result.data) {
      updateTabDocument(activeTab.id, {
        path: result.data.path,
        title: result.data.title,
        content: result.data.content,
        dirty: false,
        updatedAt: result.data.updatedAt
      })
      Toast.success('已保存')
      void refreshRecent()
    } else if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [activeTab, updateTabDocument, refreshRecent])

  const openPath = useCallback(
    async (path: string, options?: { mode?: EditorMode }): Promise<boolean> => {
      const targetMode = options?.mode ?? activeTab?.editorMode ?? editorMode
      const existing = findTabByPath(path)
      if (existing) {
        setActiveTabId(existing.id)
        if (targetMode) {
          // setActiveTabId updates the hook ref synchronously; setEditorMode now targets that ref.
          setEditorMode(targetMode)
        }
        return true
      }

      const result = await window.api.document.openPath(path)
      if (result.ok) {
        addTab(
          {
            path: result.data.path,
            title: result.data.title,
            content: result.data.content,
            dirty: result.data.dirty,
            updatedAt: result.data.updatedAt
          },
          targetMode
        )
        void refreshRecent()
        return true
      }

      Toast.error(result.error.message)
      return false
    },
    [
      activeTab?.editorMode,
      editorMode,
      findTabByPath,
      setActiveTabId,
      setEditorMode,
      addTab,
      refreshRecent
    ]
  )

  const createDocument = useCallback(async (): Promise<void> => {
    const result = await window.api.document.createUntitled()
    if (result.ok) {
      addTab({
        path: result.data.path,
        title: result.data.title,
        content: result.data.content,
        dirty: result.data.dirty,
        updatedAt: result.data.updatedAt
      })
    } else {
      Toast.error(result.error.message)
    }
  }, [addTab])

  const openDocument = useCallback(async (): Promise<void> => {
    const result = await window.api.document.open()
    if (result.ok && result.data) {
      const existing = result.data.path ? findTabByPath(result.data.path) : undefined
      if (existing) {
        setActiveTabId(existing.id)
      } else {
        addTab({
          path: result.data.path,
          title: result.data.title,
          content: result.data.content,
          dirty: result.data.dirty,
          updatedAt: result.data.updatedAt
        })
      }
      void refreshRecent()
    } else if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [findTabByPath, setActiveTabId, addTab, refreshRecent])

  const loadWorkspace = useCallback(async (path: string) => {
    setWorkspaceRoot(path)
    const treeResult = await window.api.workspace.getTree(path)
    if (treeResult.ok) {
      setWorkspaceTree(treeResult.data)
    } else {
      Toast.error(treeResult.error.message)
    }
  }, [])

  // Update refs when callbacks change
  useEffect(() => {
    openPathRef.current = openPath
  }, [openPath])

  useEffect(() => {
    loadWorkspaceRef.current = loadWorkspace
  }, [loadWorkspace])

  useEffect(() => {
    refreshRecentRef.current = refreshRecent
  }, [refreshRecent])

  const openWorkspace = useCallback(async () => {
    const result = await window.api.workspace.openFolder()
    if (!result.ok) {
      Toast.error(result.error.message)
      return
    }
    if (!result.data) return
    await loadWorkspace(result.data)
    void refreshRecent()
  }, [loadWorkspace, refreshRecent])

  const confirmDiscardChanges = useCallback(async (): Promise<boolean> => {
    if (!document.dirty) return true

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
        if (!confirmed) return false
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

  const handleCloseTab = useCallback(
    async (tabId: string): Promise<void> => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return

      if (tab.document.dirty) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: '文档尚未保存',
            content: `"${tab.document.title}" 尚未保存，是否保存后再关闭？`,
            okText: '保存并关闭',
            cancelText: '直接关闭',
            onOk: () => resolve(true),
            onCancel: () => resolve(false)
          })
        })

        if (confirmed) {
          setActiveTabId(tabId)
          await new Promise((r) => setTimeout(r, 0))
          const result = tab.document.path
            ? await window.api.document.save({
                path: tab.document.path,
                content: tab.document.content
              })
            : await window.api.document.saveAs({ content: tab.document.content })
          if (result.ok) {
            updateTabDocument(tabId, { dirty: false })
          }
        }
      }

      closeTab(tabId, { force: true })
    },
    [tabs, setActiveTabId, updateTabDocument, closeTab]
  )

  const handleCloseOthers = useCallback(
    async (tabId: string): Promise<void> => {
      const unsavedOthers = tabs.filter((t) => t.id !== tabId && t.document.dirty)
      if (unsavedOthers.length > 0) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: '存在未保存的文档',
            content: `还有 ${unsavedOthers.length} 个文档未保存，是否全部关闭？`,
            okText: '全部关闭',
            cancelText: '取消',
            onOk: () => resolve(true),
            onCancel: () => resolve(false)
          })
        })
        if (!confirmed) return
      }
      closeOtherTabs(tabId, { force: true })
    },
    [tabs, closeOtherTabs]
  )

  const handleCloseAll = useCallback(async (): Promise<void> => {
    const unsaved = tabs.filter((t) => t.document.dirty)
    if (unsaved.length > 0) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '存在未保存的文档',
          content: `还有 ${unsaved.length} 个文档未保存，是否全部关闭？`,
          okText: '全部关闭',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false)
        })
      })
      if (!confirmed) return
    }
    closeAllTabs({ force: true })
  }, [tabs, closeAllTabs])

  const handleNewTab = useCallback((): void => {
    void createDocument()
  }, [createDocument])

  useEffect(() => {
    let cancelled = false

    window.api.app.getInfo().then((result) => {
      if (!cancelled && result.ok) {
        setPlatform(result.data.platform)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  // Set default editor mode only when creating a new untitled document
  useEffect(() => {
    if (activeTab && !activeTab.document.path && activeTab.editorMode === 'split') {
      setEditorMode(editorSettings.defaultMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]) // Only run when active tab ID changes

  useEffect(() => {
    const updateResolvedMode = (): void => {
      setResolvedAppearanceMode(resolveAppearanceMode(editorSettings.appearanceMode))
    }

    updateResolvedMode()

    if (editorSettings.appearanceMode !== 'system') {
      return
    }

    return subscribeToSystemAppearance(updateResolvedMode)
  }, [editorSettings.appearanceMode])

  useEffect(() => {
    applyThemeToDocument({
      accentColor: resolveThemeAccent(editorSettings),
      appearanceMode: editorSettings.appearanceMode,
      resolvedMode: resolvedAppearanceMode
    })
  }, [editorSettings, resolvedAppearanceMode])

  useEffect(() => {
    if (!workspaceRoot) return

    let cancelled = false

    window.api.workspace.getState(workspaceRoot).then((result) => {
      if (cancelled) return
      if (result.ok && result.data) {
        setExpandedWorkspacePaths(result.data.expandedPaths)
        updateSettings({ showSidebar: result.data.sidebarVisible })
      }
    })

    return () => {
      cancelled = true
    }
  }, [updateSettings, workspaceRoot])

  useEffect(() => {
    if (!document.path) return

    let cancelled = false

    window.api.session.getDocument(document.path).then((result) => {
      if (cancelled) return
      if (result.ok && result.data) {
        setEditorMode(result.data.mode)
        setCursorPosition(result.data.cursorLine, result.data.cursorColumn)
      }
    })

    return () => {
      cancelled = true
    }
  }, [document.path, setEditorMode, setCursorPosition])

  useEffect(() => {
    if (!workspaceRoot) return

    window.clearTimeout(workspacePersistTimerRef.current)
    workspacePersistTimerRef.current = window.setTimeout(() => {
      void window.api.workspace.updateState({
        workspacePath: workspaceRoot,
        expandedPaths: expandedWorkspacePaths,
        sidebarVisible: editorSettings.showSidebar
      })
    }, 250)
  }, [editorSettings.showSidebar, expandedWorkspacePaths, workspaceRoot])

  useEffect(() => {
    if (!document.path) return

    window.clearTimeout(sessionPersistTimerRef.current)
    sessionPersistTimerRef.current = window.setTimeout(() => {
      void window.api.session.updateDocument({
        path: document.path!,
        mode: editorMode,
        cursorLine: cursorPosition.line,
        cursorColumn: cursorPosition.column
      })
    }, 250)
  }, [cursorPosition.column, cursorPosition.line, document.path, editorMode])

  useEffect(() => {
    if (!pendingAnchor) return

    const timer = window.setTimeout(clearPendingAnchor, 500)

    return () => window.clearTimeout(timer)
  }, [clearPendingAnchor, pendingAnchor])

  useEffect(() => {
    return () => {
      window.clearTimeout(workspacePersistTimerRef.current)
      window.clearTimeout(sessionPersistTimerRef.current)
      window.clearTimeout(exportProgressCloseTimerRef.current)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(sidebarPaneWidthStorageKey, String(sidebarPaneWidth))
  }, [sidebarPaneWidth])

  const openEditorView = useCallback((): void => {
    setActiveView('editor')
  }, [])

  const openSettingsView = useCallback((): void => {
    setActiveView('settings')
  }, [])

  const handleSidebarResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      sidebarResizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: sidebarPaneWidth
      }
      setIsResizingSidebar(true)
    },
    [sidebarPaneWidth]
  )

  const resizeSidebarByKeyboard = useCallback((delta: number): void => {
    setSidebarPaneWidth((current) => clampSidebarPaneWidth(current + delta))
  }, [])

  useEffect(() => {
    if (!isResizingSidebar) {
      return
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const resizeState = sidebarResizeRef.current

      if (!resizeState || event.pointerId !== resizeState.pointerId) {
        return
      }

      setSidebarPaneWidth(
        clampSidebarPaneWidth(resizeState.startWidth + event.clientX - resizeState.startX)
      )
    }

    const handlePointerUp = (event: PointerEvent): void => {
      const resizeState = sidebarResizeRef.current

      if (resizeState && event.pointerId !== resizeState.pointerId) {
        return
      }

      sidebarResizeRef.current = null
      setIsResizingSidebar(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isResizingSidebar])

  const handleExport = useCallback(
    async (format: ExportFormat): Promise<void> => {
      window.clearTimeout(exportProgressCloseTimerRef.current)
      setExportProgress({
        stage: 'resolving',
        percent: 0,
        message: '准备导出'
      })

      const result = await window.api.document.export({
        title: document.title || 'Untitled',
        content: document.content,
        sourcePath: document.path,
        format,
        includeCustomCss: editorSettings.export.includeCustomCss,
        customCss: editorSettings.customPreviewCss,
        imageFormat: editorSettings.export.imageFormat,
        imageScale: editorSettings.export.imageScale,
        pdfPageSize: editorSettings.export.pdfPageSize
      })

      if (result.ok && result.data) {
        setExportProgress({
          stage: 'done',
          percent: 100,
          message: '导出完成'
        })
        exportProgressCloseTimerRef.current = window.setTimeout(() => {
          setExportProgress(null)
        }, 700)
        Toast.success(`已导出 ${exportFormatLabels[result.data.format]}`)
        return
      }

      setExportProgress(null)

      if (!result.ok) {
        Toast.error(result.error.message)
      }
    },
    [
      document.content,
      document.path,
      document.title,
      editorSettings.customPreviewCss,
      editorSettings.export.imageFormat,
      editorSettings.export.imageScale,
      editorSettings.export.includeCustomCss,
      editorSettings.export.pdfPageSize
    ]
  )

  const downloadUpdate = useCallback(async (): Promise<void> => {
    const result = await window.api.updater.downloadUpdate()

    if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [])

  const installUpdate = useCallback(async (): Promise<void> => {
    const result = await window.api.updater.quitAndInstall()

    if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [])

  const handleUpdaterStatus = useCallback(
    (status: UpdaterStatus): void => {
      setUpdaterStatus(status)

      if (status.state === 'available') {
        updaterManualCheckRef.current = false

        const version = status.version ?? status.updatedAt
        if (updaterAvailablePromptRef.current === version) {
          return
        }

        updaterAvailablePromptRef.current = version
        Modal.confirm({
          title: status.version ? `发现新版本 ${status.version}` : '发现新版本',
          content: status.releaseNotes || status.message,
          okText: '下载更新',
          cancelText: '稍后',
          onOk: () => {
            void downloadUpdate()
          }
        })
        return
      }

      if (status.state === 'downloaded') {
        const version = status.version ?? status.updatedAt
        if (updaterInstallPromptRef.current === version) {
          return
        }

        updaterInstallPromptRef.current = version
        Modal.confirm({
          title: '更新已准备就绪',
          content: status.version
            ? `版本 ${status.version} 已下载，重启后会完成安装。`
            : '更新已下载，重启后会完成安装。',
          okText: '重启安装',
          cancelText: '稍后',
          onOk: () => {
            void installUpdate()
          }
        })
        return
      }

      if (status.state === 'not-available' && updaterManualCheckRef.current) {
        updaterManualCheckRef.current = false
        Toast.success(status.message)
        return
      }

      if (status.state === 'error' && updaterManualCheckRef.current) {
        updaterManualCheckRef.current = false
        Toast.error(status.error || status.message)
      }
    },
    [downloadUpdate, installUpdate]
  )

  const checkForUpdates = useCallback(async (): Promise<void> => {
    updaterManualCheckRef.current = true
    Toast.info('正在检查更新')

    const result = await window.api.updater.checkForUpdates()

    if (!result.ok) {
      updaterManualCheckRef.current = false
      Toast.error(result.error.message)
    }
  }, [])

  useEffect(() => {
    return window.api.document.onExportProgress((progress) => {
      setExportProgress(progress)
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    window.api.updater.getStatus().then((result) => {
      if (!cancelled && result.ok) {
        handleUpdaterStatus(result.data)
      }
    })

    const unsubscribe = window.api.updater.onStatusChange(handleUpdaterStatus)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [handleUpdaterStatus])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      if (e.key === 's') {
        e.preventDefault()
        void saveDocument()
        return
      }
      if (e.key === 'o') {
        e.preventDefault()
        void openDocument()
        return
      }
      if (e.key === 'n') {
        e.preventDefault()
        openEditorView()
        void createDocument()
        return
      }
      if (e.key === 'w') {
        e.preventDefault()
        if (activeTab) {
          void handleCloseTab(activeTab.id)
        }
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          switchToPreviousTab()
        } else {
          switchToNextTab()
        }
        return
      }
      if (e.key >= '1' && e.key <= '9' && !e.shiftKey) {
        e.preventDefault()
        switchToTabByIndex(parseInt(e.key) - 1)
        return
      }
      if (e.key === '1' && e.shiftKey) {
        e.preventDefault()
        setEditorMode('source')
        return
      }
      if (e.key === '2' && e.shiftKey) {
        e.preventDefault()
        setEditorMode('split')
        return
      }
      if (e.key === '3' && e.shiftKey) {
        e.preventDefault()
        setEditorMode('preview-edit')
        return
      }
      if (e.key === '\\') {
        e.preventDefault()
        updateSettings({ showSidebar: !editorSettings.showSidebar })
        return
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    saveDocument,
    openDocument,
    createDocument,
    setEditorMode,
    editorSettings.showSidebar,
    updateSettings,
    activeTab,
    handleCloseTab,
    switchToNextTab,
    switchToPreviousTab,
    switchToTabByIndex,
    openEditorView
  ])

  useEffect(() => {
    return window.api.menu.onCommand((command) => {
      if (command === 'document:export-default') {
        void handleExport(editorSettings.export.defaultFormat)
      }

      if (command === 'document:export-html') {
        void handleExport('html')
      }

      if (command === 'document:export-pdf') {
        void handleExport('pdf')
      }

      if (command === 'document:export-png') {
        void handleExport(editorSettings.export.imageFormat)
      }

      if (command === 'document:export-docx') {
        void handleExport('docx')
      }

      if (command === 'document:new') {
        openEditorView()
        void createDocument()
      }

      if (command === 'document:open') {
        openEditorView()
        void openDocument()
      }

      if (command === 'document:save') {
        void saveDocument()
      }

      if (command === 'workspace:open-folder') {
        void openWorkspace()
      }

      if (command === 'updater:check') {
        void checkForUpdates()
      }
    })
  }, [
    checkForUpdates,
    createDocument,
    editorSettings.export.defaultFormat,
    editorSettings.export.imageFormat,
    handleExport,
    openDocument,
    openWorkspace,
    saveDocument,
    openEditorView
  ])

  useEffect(() => {
    return window.api.app.onOpenFile((filePath: string) => {
      void openPath(filePath, { mode: 'preview-edit' })
    })
  }, [openPath])

  useEffect(() => {
    if (hasInitializedRef.current) {
      return
    }

    let cancelled = false

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return
      }

      hasInitializedRef.current = true
      void refreshRecent()

      window.api.app.getPendingOpenFile().then((result) => {
        if (result.ok && result.data) {
          void openPath(result.data, { mode: 'preview-edit' })
          return
        }

        window.api.preferences.getEditor().then((result) => {
          if (!result.ok) {
            Toast.error(result.error.message)
            return
          }

          if (!result.data.hasSeenWelcome) {
            void window.api.preferences.updateEditor({ hasSeenWelcome: true })
            return
          }

          window.api.session.getLastDocument().then((sessionResult) => {
            if (sessionResult.ok && sessionResult.data) {
              void openPath(sessionResult.data.path, { mode: sessionResult.data.mode })
            }
          })
        })
      })

      window.api.recent.listWorkspaces().then((result) => {
        if (result.ok && result.data[0]) {
          void loadWorkspace(result.data[0].path)
        }
      })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [loadWorkspace, openPath, refreshRecent])

  useEffect(() => {
    return window.api.workspace.onDidChange(() => {
      if (workspaceRoot) {
        window.api.workspace.getTree(workspaceRoot).then((result) => {
          if (result.ok) {
            setWorkspaceTree(result.data)
          }
        })
      }
    })
  }, [workspaceRoot])

  const dragOverFrameRef = useRef<number | undefined>(undefined)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!hasExternalFiles(e.dataTransfer)) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    if (dragOverFrameRef.current === undefined) {
      dragOverFrameRef.current = requestAnimationFrame(() => {
        setIsDragging(true)
        dragOverFrameRef.current = undefined
      })
    }
  }, [])

  useEffect(() => {
    return () => {
      if (dragOverFrameRef.current !== undefined) {
        cancelAnimationFrame(dragOverFrameRef.current)
      }
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!hasExternalFiles(e.dataTransfer)) {
      return
    }

    e.preventDefault()
    e.stopPropagation()
    const relatedTarget = e.relatedTarget as Node | null
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!hasExternalFiles(e.dataTransfer)) {
        return
      }

      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      const firstFilePath = getDroppedFilePath(files[0])
      if (files.length === 1 && firstFilePath) {
        const statResult = await window.api.workspace.getTree(firstFilePath)
        if (statResult.ok) {
          await loadWorkspaceRef.current?.(firstFilePath)
          void refreshRecentRef.current?.()
          return
        }
      }

      for (const file of files) {
        const filePath = getDroppedFilePath(file)
        if (filePath && /\.(md|markdown|mdown|mkd|txt)$/i.test(filePath)) {
          openEditorView()
          await openPathRef.current?.(filePath, { mode: 'preview-edit' })
        }
      }
    },
    [openEditorView]
  )

  const createWorkspaceEntry = useCallback(
    async (
      parentPath: string,
      name: string,
      type: 'file' | 'directory'
    ): Promise<string | null> => {
      const result = await window.api.workspace.createEntry({ parentPath, name, type })
      if (result.ok) return result.data
      Toast.error(result.error.message)
      return null
    },
    []
  )

  const renameWorkspaceEntry = useCallback(
    async (path: string, newName: string): Promise<string | null> => {
      const result = await window.api.workspace.renameEntry({ path, newName })
      if (result.ok) {
        if (activeTab?.document.path === path) {
          updateTabDocument(activeTab.id, { path: result.data })
        }
        return result.data
      }
      Toast.error(result.error.message)
      return null
    },
    [activeTab, updateTabDocument]
  )

  const deleteWorkspaceEntry = useCallback(async (path: string): Promise<boolean> => {
    const result = await window.api.workspace.deleteEntry({ path })
    if (result.ok) {
      return true
    }
    Toast.error(result.error.message)
    return false
  }, [])

  return (
    <div
      className="app-shell"
      data-color-mode={resolvedAppearanceMode}
      data-appearance-mode={editorSettings.appearanceMode}
      data-platform={platform}
      data-sidebar-visible={editorSettings.showSidebar}
      data-view={activeView}
      data-dragging={isDragging}
      data-resizing-sidebar={isResizingSidebar}
      style={{ '--sidebar-pane-width': `${sidebarPaneWidth}px` } as React.CSSProperties}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Sidebar
        activeView={activeView}
        visible={editorSettings.showSidebar}
        paneWidth={sidebarPaneWidth}
        workspaceRoot={workspaceRoot}
        workspaceTree={workspaceTree}
        recentFiles={recentFiles}
        selectedPath={document.path}
        expandedPaths={expandedWorkspacePaths}
        onNew={() => {
          openEditorView()
          void createDocument()
        }}
        onOpenEditor={openEditorView}
        onOpenSettings={openSettingsView}
        onOpenWorkspace={() => void openWorkspace()}
        onResizeStart={handleSidebarResizeStart}
        onResizeByKeyboard={resizeSidebarByKeyboard}
        onOpenFile={(path) => {
          openEditorView()
          void openPath(path)
        }}
        onExpandedPathsChange={setExpandedWorkspacePaths}
        onCreateWorkspaceEntry={createWorkspaceEntry}
        onRenameWorkspaceEntry={renameWorkspaceEntry}
        onDeleteWorkspaceEntry={deleteWorkspaceEntry}
      />
      <main className="main-panel">
        {activeView === 'editor' ? (
          <>
            <TitleBar
              mode={editorMode}
              platform={platform}
              showSidebar={editorSettings.showSidebar}
              onModeChange={setEditorMode}
              onToggleSidebar={() => updateSettings({ showSidebar: !editorSettings.showSidebar })}
              onOpen={() => void openDocument()}
              onSave={() => void saveDocument()}
              onExport={(format) => void handleExport(format)}
            />
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelect={setActiveTabId}
              onClose={(tabId) => void handleCloseTab(tabId)}
              onCloseOthers={(tabId) => void handleCloseOthers(tabId)}
              onCloseAll={() => void handleCloseAll()}
              onCloseSaved={closeSavedTabs}
              onPin={pinTab}
              onUnpin={unpinTab}
              onReorder={reorderTabs}
              onNewTab={handleNewTab}
            />
            <section className="editor-host" data-editor-mode={editorMode}>
              {activeTab ? (
                <MarkdownEditor
                  mode={editorMode}
                  dirty={document.dirty}
                  content={document.content}
                  settings={editorSettings}
                  currentPath={document.path}
                  workspaceRoot={workspaceRoot}
                  anchorTarget={pendingAnchor}
                  onChange={setContent}
                  onCursorChange={(position) => setCursorPosition(position.line, position.column)}
                  onOpenDocumentLink={openPathFromLink}
                  onLinkError={(message) => Toast.error(message)}
                />
              ) : (
                <div className="empty-editor" />
              )}
            </section>
            <StatusBar
              mode={editorMode}
              wordCount={wordCount}
              dirty={document.dirty}
              cursorPosition={cursorPosition}
              showLineNumbers={editorSettings.showLineNumbers}
            />
          </>
        ) : (
          <SettingsPage
            settings={editorSettings}
            onBack={openEditorView}
            onChange={(nextSettings) => {
              updateSettings(nextSettings)
            }}
            onReset={() => void resetSettings()}
          />
        )}
      </main>
      <Modal
        visible={!!exportProgress}
        title="正在导出"
        footer={null}
        closable={false}
        maskClosable={false}
        width={420}
      >
        {exportProgress ? (
          <div className="export-progress-modal">
            <Progress percent={exportProgress.percent} showInfo />
            <Typography.Text type="tertiary">{exportProgress.message}</Typography.Text>
          </div>
        ) : null}
      </Modal>
      <Modal
        visible={updaterStatus?.state === 'downloading'}
        title="正在下载更新"
        footer={null}
        closable={false}
        maskClosable={false}
        width={420}
      >
        {updaterStatus ? (
          <div className="export-progress-modal">
            <Progress percent={Math.round(updaterStatus.percent ?? 0)} showInfo />
            <Typography.Text type="tertiary">{updaterStatus.message}</Typography.Text>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
