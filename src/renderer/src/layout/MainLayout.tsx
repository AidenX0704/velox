import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Progress, Toast, Typography } from '../ui'
import { exportFormatLabels, type ExportFormat, type ExportProgress } from '../../../shared/export'
import type { HistoryDocumentActivity, WorkspaceEntry } from '../../../shared/types'
import { normalizeEditorMode } from '../../../shared/preferences'
import type { CursorPosition, EditorMode } from '../modules/editor/model/types'
import '../modules/editor/styles/editor.css'
import { createWelcomeDocument, useTabs } from '../features/tabs/useTabs'
import { TabBar } from '../features/tabs/TabBar'
import { getCloseTabAction, persistTabBeforeClose } from '../features/tabs/closeTabWorkflow'
import { useEditorSettings } from '../features/settings/useEditorSettings'
import {
  applyThemeToDocument,
  resolveAppearanceMode,
  resolveThemeAccent,
  subscribeToSystemAppearance,
  type ResolvedAppearanceMode
} from '../features/theme/theme'
import { StatusBar } from './StatusBar'
import { InlineNotice } from '../app/InlineNotice'
import { SettingsPage, type PreferenceSection } from './SettingsPanel'
import { TitleBar } from './TitleBar'
import { WorkspaceImagePreview } from './WorkspaceImagePreview'
import { isWorkspaceImageResource } from './workspaceResource'
import { EditorLoadingFallback } from './app/EditorLoadingFallback'
import { CloseTabDecisionHost } from '../app/CloseTabDecision'
import { requestCloseTabDecision } from '../app/closeTabDecisionStore'
import { basename, computeWordCount, formatUpdateDate, getUpdateNotes } from './app/format'
import { MarkdownEditor } from './app/lazyEditors'
import { RecentWorkbench } from './app/RecentWorkbench'
import { useUpdaterState } from './app/useUpdaterState'
import { useExternalDocuments } from './app/useExternalDocuments'
import { useExplorerResize } from './app/useExplorerResize'
import { useTitleBarSearch } from './app/useTitleBarSearch'
import { getAppActions, setAppActions } from './app/appActionsStore'
import { ResourceExplorer } from './app/ResourceExplorer'
import {
  getDroppedFilePath,
  hasExternalFiles,
  isPathInsideWorkspace,
  restoreWorkspaceExpandedPaths
} from './app/paths'

type AppView = 'editor' | 'recent' | 'settings'
export function MainLayout(): React.JSX.Element {
  const [activeView, setActiveView] = useState<AppView>('editor')
  const [platform, setPlatform] = useState<string>('')
  const [resolvedAppearanceMode, setResolvedAppearanceMode] =
    useState<ResolvedAppearanceMode>('light')
  const [launchAppearance, setLaunchAppearance] = useState<ResolvedAppearanceMode | null>(null)

  useEffect(() => {
    void window.api.app.getLaunchOptions().then((result) => {
      if (result.ok && result.data.appearance) {
        setLaunchAppearance(result.data.appearance)
      }
    })
  }, [])
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceEntry[]>([])
  const [expandedWorkspacePaths, setExpandedWorkspacePaths] = useState<string[]>([])
  const [workspaceStateReady, setWorkspaceStateReady] = useState(false)
  const [explorerVisible, setExplorerVisible] = useState(false)
  const [recentFiles, setRecentFiles] = useState<
    import('../../../shared/types').RecentFileRecord[]
  >([])
  const [selectedRecentPath, setSelectedRecentPath] = useState<string | undefined>(undefined)
  const [recentActivity, setRecentActivity] = useState<HistoryDocumentActivity | null>(null)
  const [settingsInitialSection, setSettingsInitialSection] = useState<PreferenceSection>('general')
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null)
  const workspacePersistTimerRef = useRef<number | undefined>(undefined)
  const workspaceTreeRequestRef = useRef(0)
  const sessionPersistTimerRef = useRef<number | undefined>(undefined)
  const exportProgressCloseTimerRef = useRef<number | undefined>(undefined)
  const editorHostRef = useRef<HTMLElement | null>(null)
  const { settings: editorSettings, updateSettings, resetSettings } = useEditorSettings()
  const updater = useUpdaterState()
  const checkForUpdates = updater.check

  const {
    tabs,
    activeTabId,
    activeTab,
    setActiveTabId,
    setEditorMode,
    setContent,
    setCursorPosition,
    setTabScrollTop,
    addTab,
    replaceTabs,
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
    completeSaveAndCloseTab,
    updateTabDocument,
    findTabByPath,
    applyExternalContent,
    markTabMissing
  } = useTabs()

  // Long-lived listeners (drag & drop, menu commands) read the latest command
  // implementations from this store instead of through ref mirrors.
  const hasInitializedRef = useRef(false)
  const closingTabIdsRef = useRef(new Set<string>())

  const document = useMemo(
    () =>
      activeTab?.document ?? {
        title: 'undefined.md',
        content: '',
        dirty: false,
        path: undefined
      },
    [activeTab?.document]
  )
  const activeResourceKind = activeTab?.document.kind ?? 'markdown'
  const isImagePreview = activeResourceKind === 'image'
  const workspaceAvailable = Boolean(workspaceRoot) && workspaceStateReady
  const isExplorerVisible = workspaceAvailable && explorerVisible
  const editorMode = activeTab?.editorMode ?? 'preview-edit'
  const cursorPosition = useMemo<CursorPosition>(
    () => ({
      line: activeTab?.cursorLine ?? 1,
      column: activeTab?.cursorColumn ?? 1
    }),
    [activeTab?.cursorLine, activeTab?.cursorColumn]
  )
  const wordCount = useMemo(() => computeWordCount(document.content), [document.content])
  const refreshRecent = useCallback(async () => {
    const filesResult = await window.api.recent.listFiles()
    if (filesResult.ok) {
      setRecentFiles(filesResult.data)
    }
    return filesResult.ok ? filesResult.data : []
  }, [])

  const loadRecentActivity = useCallback(async (path: string): Promise<void> => {
    setSelectedRecentPath(path)
    const result = await window.api.history.getDocumentActivity(path)
    if (result.ok) {
      setRecentActivity(result.data)
    } else {
      Toast.error(result.error.message)
    }
  }, [])

  const saveDocument = useCallback(async (): Promise<void> => {
    if (!activeTab || activeTab.document.kind === 'image') return
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
      const imageResource = isWorkspaceImageResource(path)
      const existing = findTabByPath(path)
      if (existing) {
        setActiveTabId(existing.id)
        if (targetMode) {
          // setActiveTabId updates the hook ref synchronously; setEditorMode now targets that ref.
          setEditorMode(targetMode)
        }

        if (!imageResource) {
          const touchResult = await window.api.document.openPath(path)
          if (!touchResult.ok) {
            Toast.error(touchResult.error.message)
          }
          void refreshRecent()
        }
        return true
      }

      if (imageResource) {
        const imageResult = await window.api.document.resolveImage({
          src: path,
          workspaceRoot:
            workspaceRoot && isPathInsideWorkspace(path, workspaceRoot) ? workspaceRoot : undefined
        })

        if (imageResult.ok && imageResult.data) {
          addTab(
            {
              path,
              title: basename(path),
              content: '',
              dirty: false,
              kind: 'image',
              imageSource: imageResult.data
            },
            targetMode
          )
          return true
        }

        Toast.error(imageResult.ok ? '无法加载图片资源' : imageResult.error.message)
        return false
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
      refreshRecent,
      workspaceRoot
    ]
  )

  const createDocument = useCallback(async (): Promise<void> => {
    const existingUndefinedTab = tabs.find((tab) => tab.document.title === 'undefined.md')
    if (existingUndefinedTab) {
      setActiveTabId(existingUndefinedTab.id)
      return
    }

    const result = await window.api.document.createUntitled()
    if (result.ok) {
      const tabId = addTab(
        {
          path: result.data.path,
          title: result.data.title,
          content: result.data.content,
          dirty: result.data.dirty,
          updatedAt: result.data.updatedAt
        },
        editorSettings.defaultMode
      )
      setActiveTabId(tabId)
    } else {
      Toast.error(result.error.message)
    }
  }, [addTab, editorSettings.defaultMode, setActiveTabId, tabs])

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

  const openEditorView = useCallback((): void => {
    setActiveView('editor')
  }, [])

  const {
    searchQuery,
    searchScope,
    searchCaseSensitive,
    replaceValue,
    setReplaceValue,
    replaceVisible,
    setReplaceVisible,
    activeSearchMatchIndex,
    searchFocusRequestId,
    searchNavigationRequestId,
    workspaceSearchLoading,
    workspaceSearchError,
    titlebarSearchResults,
    titlebarSearchTruncated,
    activeSearchOrdinal,
    workspaceSearchDisabledError,
    effectiveSearchMatchCount,
    triggerDocumentSearch,
    clearWorkspaceSearch,
    updateSearchQuery,
    updateSearchScope,
    updateSearchCaseSensitive,
    updateSearchMatchCount,
    stepSearchMatch,
    selectSearchMatch,
    replaceCurrentSearchMatch,
    replaceAllSearchMatches
  } = useTitleBarSearch({
    documentContent: document.content,
    workspaceRoot,
    workspaceAvailable,
    tabs,
    openEditorView,
    openPath,
    setEditorMode,
    setContent,
    findTabByPath,
    updateTabDocument
  })

  const loadWorkspace = useCallback(
    async (path: string) => {
      const requestId = ++workspaceTreeRequestRef.current

      window.clearTimeout(workspacePersistTimerRef.current)
      clearWorkspaceSearch()

      setWorkspaceRoot(path)
      setWorkspaceTree([])
      setExpandedWorkspacePaths([])
      setWorkspaceStateReady(false)
      setExplorerVisible(false)

      const [treeResult, stateResult] = await Promise.all([
        window.api.workspace.getTree({ rootPath: path }),
        window.api.workspace.getState(path)
      ])

      if (requestId !== workspaceTreeRequestRef.current) {
        return
      }

      if (!treeResult.ok) {
        setWorkspaceRoot(null)
        setWorkspaceTree([])
        setExpandedWorkspacePaths([])
        setWorkspaceStateReady(false)
        setExplorerVisible(false)
        Toast.error(treeResult.error.message)
        return
      }

      const restoredExpandedPaths = restoreWorkspaceExpandedPaths(
        path,
        stateResult.ok && stateResult.data ? stateResult.data.expandedPaths : []
      )

      setExplorerVisible(
        stateResult.ok && stateResult.data ? stateResult.data.sidebarVisible : true
      )

      setExpandedWorkspacePaths(restoredExpandedPaths)
      setWorkspaceTree(treeResult.data)
      setWorkspaceStateReady(true)

      if (restoredExpandedPaths.length === 0) {
        return
      }

      const expandedTreeResult = await window.api.workspace.getTree({
        rootPath: path,
        expandedPaths: restoredExpandedPaths
      })

      if (requestId !== workspaceTreeRequestRef.current) {
        return
      }

      setWorkspaceTree(expandedTreeResult.ok ? expandedTreeResult.data : treeResult.data)

      if (!expandedTreeResult.ok) {
        Toast.error(expandedTreeResult.error.message)
      }
    },
    [clearWorkspaceSearch]
  )

  // Publish the latest command implementations for long-lived listeners.
  useEffect(() => {
    setAppActions({ openPath, loadWorkspace, refreshRecent })
  }, [openPath, loadWorkspace, refreshRecent])

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

  const refreshWorkspaceTree = useCallback(
    async (expandedPaths?: string[]): Promise<void> => {
      if (!workspaceRoot || !workspaceStateReady) return

      const requestId = ++workspaceTreeRequestRef.current
      const result = await window.api.workspace.getTree({
        rootPath: workspaceRoot,
        expandedPaths: expandedPaths ?? expandedWorkspacePaths
      })

      if (requestId === workspaceTreeRequestRef.current && result.ok) {
        setWorkspaceTree(result.data)
      }
    },
    [expandedWorkspacePaths, workspaceRoot, workspaceStateReady]
  )

  const updateExpandedWorkspacePaths = useCallback(
    (paths: string[]): void => {
      setExpandedWorkspacePaths(paths)
      void refreshWorkspaceTree(paths)
    },
    [refreshWorkspaceTree]
  )

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
      // 防止双击关闭或快捷键连按触发多个确认框和并发保存。
      if (closingTabIdsRef.current.has(tabId)) return

      const tab = tabs.find((item) => item.id === tabId)
      if (!tab) return

      if (!tab.document.dirty) {
        closeTab(tabId)
        return
      }

      closingTabIdsRef.current.add(tabId)
      setActiveTabId(tabId)

      try {
        const decision = await requestCloseTabDecision(tab.document.title)
        const action = getCloseTabAction(decision)

        if (action === 'keep') {
          return
        }

        if (action === 'discard') {
          closeTab(tabId, { force: true })
          return
        }

        const outcome = await persistTabBeforeClose(tab.document, window.api.document)

        if (outcome.kind === 'failed') {
          Toast.error(outcome.error.message)
          return
        }

        if (outcome.kind === 'cancelled') {
          return
        }

        completeSaveAndCloseTab(
          tabId,
          { path: tab.document.path, content: tab.document.content },
          outcome.document
        )
        void refreshRecent()
      } finally {
        closingTabIdsRef.current.delete(tabId)
      }
    },
    [closeTab, completeSaveAndCloseTab, refreshRecent, setActiveTabId, tabs]
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

  useEffect(() => {
    const updateResolvedMode = (): void => {
      setResolvedAppearanceMode(
        launchAppearance ?? resolveAppearanceMode(editorSettings.appearanceMode)
      )
    }

    updateResolvedMode()

    if (editorSettings.appearanceMode !== 'system') {
      return
    }

    return subscribeToSystemAppearance(updateResolvedMode)
  }, [editorSettings.appearanceMode, launchAppearance])

  useEffect(() => {
    applyThemeToDocument({
      accentColor: resolveThemeAccent(editorSettings),
      appearanceMode: editorSettings.appearanceMode,
      resolvedMode: resolvedAppearanceMode
    })
  }, [editorSettings, resolvedAppearanceMode])

  // Mirror the resolved appearance into the main process so the next launch can
  // paint the window background and the static skeleton in the right theme
  // before any JavaScript runs.
  useEffect(() => {
    void window.api.window.setAppearance(editorSettings.appearanceMode)
  }, [editorSettings.appearanceMode])

  useEffect(() => {
    if (activeResourceKind !== 'markdown' || !document.path) return

    let cancelled = false

    window.api.session.getDocument(document.path).then((result) => {
      if (cancelled) return
      if (result.ok && result.data) {
        setEditorMode(normalizeEditorMode(result.data.mode))
        setCursorPosition(result.data.cursorLine, result.data.cursorColumn)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeResourceKind, document.path, setEditorMode, setCursorPosition])

  useEffect(() => {
    if (activeResourceKind !== 'markdown' || !document.path) return

    window.clearTimeout(sessionPersistTimerRef.current)
    sessionPersistTimerRef.current = window.setTimeout(() => {
      void window.api.session.updateDocument({
        path: document.path!,
        mode: editorMode,
        cursorLine: cursorPosition.line,
        cursorColumn: cursorPosition.column
      })
    }, 250)
  }, [activeResourceKind, cursorPosition.column, cursorPosition.line, document.path, editorMode])

  useEffect(() => {
    if (!workspaceRoot || !workspaceStateReady) return

    window.clearTimeout(workspacePersistTimerRef.current)
    workspacePersistTimerRef.current = window.setTimeout(() => {
      void window.api.workspace.updateState({
        workspacePath: workspaceRoot,
        expandedPaths: expandedWorkspacePaths,
        sidebarVisible: explorerVisible
      })
    }, 250)
  }, [expandedWorkspacePaths, explorerVisible, workspaceRoot, workspaceStateReady])

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

  const openSettingsView = useCallback((section: PreferenceSection = 'general'): void => {
    setSettingsInitialSection(section)
    setActiveView('settings')
  }, [])

  // Title-bar search: query state, workspace search, navigation and both
  // replace flows live in their own hook (see layout/app/useTitleBarSearch).

  const openRecentView = useCallback((): void => {
    setActiveView('recent')
    const targetPath =
      selectedRecentPath ?? (isImagePreview ? undefined : document.path) ?? recentFiles[0]?.path

    if (targetPath) {
      void loadRecentActivity(targetPath)
    }
  }, [document.path, isImagePreview, loadRecentActivity, recentFiles, selectedRecentPath])

  const handleExport = useCallback(
    async (format: ExportFormat): Promise<void> => {
      if (isImagePreview) {
        return
      }

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
      editorSettings.export.pdfPageSize,
      isImagePreview
    ]
  )

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
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        triggerDocumentSearch()
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
        if (!isImagePreview) {
          setEditorMode('source')
        }
        return
      }
      if (e.key === '2' && e.shiftKey) {
        e.preventDefault()
        if (!isImagePreview) {
          setEditorMode('preview-edit')
        }
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
    activeTab,
    handleCloseTab,
    switchToNextTab,
    switchToPreviousTab,
    switchToTabByIndex,
    openEditorView,
    triggerDocumentSearch,
    isImagePreview
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
      ;(async () => {
        if (cancelled) {
          return
        }

        hasInitializedRef.current = true
        void refreshRecent()

        // Everything needed to decide *what* to show is fetched in one round
        // trip budget instead of four sequential awaits. The workspace tree is
        // deliberately excluded: it starts a recursive watcher and must not sit
        // on the critical path to the first editable document.
        const [pendingOpenFileResult, preferenceResult, recentWorkspaceResult, lastDocumentResult] =
          await Promise.all([
            window.api.app.getPendingOpenFile(),
            window.api.preferences.getEditor(),
            window.api.recent.listWorkspaces(),
            window.api.session.getLastDocument()
          ])

        if (cancelled) {
          return
        }

        if (!preferenceResult.ok) {
          Toast.error(preferenceResult.error.message)
          return
        }

        const preferences = preferenceResult.data
        const recentWorkspace = recentWorkspaceResult.ok ? recentWorkspaceResult.data[0] : undefined

        const pendingPath =
          pendingOpenFileResult.ok && pendingOpenFileResult.data ? pendingOpenFileResult.data : null
        const lastDocument =
          lastDocumentResult.ok && lastDocumentResult.data ? lastDocumentResult.data : null

        // A file passed on the command line always wins — including on the very
        // first launch, where the welcome document used to win instead.
        if (pendingPath) {
          openEditorView()
          await openPath(pendingPath, { mode: 'preview-edit' })

          if (!preferences.hasSeenWelcome) {
            void window.api.preferences.updateEditor({ hasSeenWelcome: true })
          }
        } else if (!preferences.hasSeenWelcome) {
          replaceTabs([
            {
              document: createWelcomeDocument(),
              editorMode: preferences.defaultMode
            }
          ])
          void window.api.preferences.updateEditor({ hasSeenWelcome: true })
        } else if (lastDocument) {
          await openPath(lastDocument.path, { mode: normalizeEditorMode(lastDocument.mode) })
        }

        if (recentWorkspace) {
          // Deferred: the document is already interactive by now.
          void loadWorkspace(recentWorkspace.path)
        }
      })()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [loadWorkspace, openEditorView, openPath, refreshRecent, replaceTabs])

  useEffect(() => {
    return window.api.workspace.onDidChange(() => {
      void refreshWorkspaceTree()
    })
  }, [refreshWorkspaceTree])

  const externalDocs = useExternalDocuments({
    tabs,
    applyExternalContent,
    markTabMissing,
    updateTabDocument,
    onDocumentSaved: () => void refreshRecent()
  })

  const activeTabNoticePath = activeTab?.document.path ?? ''
  const activeTabNotice = activeTabNoticePath
    ? externalDocs.notices[activeTabNoticePath]
    : undefined

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
      let firstOpenedFilePath: string | undefined

      const firstFilePath = getDroppedFilePath(files[0])
      if (files.length === 1 && firstFilePath) {
        const statResult = await window.api.workspace.getTree({ rootPath: firstFilePath })
        if (statResult.ok) {
          await getAppActions().loadWorkspace?.(firstFilePath)
          void getAppActions().refreshRecent?.()
          return
        }
      }

      for (const file of files) {
        const filePath = getDroppedFilePath(file)
        if (filePath && /\.(md|markdown|mdown|mkd|txt)$/i.test(filePath)) {
          openEditorView()
          await getAppActions().openPath?.(filePath, { mode: 'preview-edit' })
          firstOpenedFilePath ??= filePath
        }
      }

      if (firstOpenedFilePath) {
        await getAppActions().refreshRecent?.()
        setSelectedRecentPath(firstOpenedFilePath)
        void loadRecentActivity(firstOpenedFilePath)
      }
    },
    [loadRecentActivity, openEditorView]
  )

  const activeWorkspaceTabId = activeTab?.id
  const activeWorkspaceDocumentPath = activeTab?.document.path

  const createWorkspaceEntry = useCallback(
    async (
      parentPath: string,
      name: string,
      type: 'file' | 'directory'
    ): Promise<string | null> => {
      const result = await window.api.workspace.createEntry({ parentPath, name, type })
      if (result.ok) {
        void refreshWorkspaceTree()
        return result.data
      }
      Toast.error(result.error.message)
      return null
    },
    [refreshWorkspaceTree]
  )

  const renameWorkspaceEntry = useCallback(
    async (path: string, newName: string): Promise<string | null> => {
      const result = await window.api.workspace.renameEntry({ path, newName })
      if (result.ok) {
        if (activeWorkspaceDocumentPath === path && activeWorkspaceTabId) {
          updateTabDocument(activeWorkspaceTabId, {
            path: result.data,
            title: basename(result.data)
          })
        }
        void refreshWorkspaceTree()
        return result.data
      }
      Toast.error(result.error.message)
      return null
    },
    [activeWorkspaceDocumentPath, activeWorkspaceTabId, refreshWorkspaceTree, updateTabDocument]
  )

  const deleteWorkspaceEntry = useCallback(
    async (path: string): Promise<boolean> => {
      const result = await window.api.workspace.deleteEntry({ path })
      if (result.ok) {
        void refreshWorkspaceTree()
        return true
      }
      Toast.error(result.error.message)
      return false
    },
    [refreshWorkspaceTree]
  )

  const openWorkspaceFromExplorer = useCallback((): void => {
    void openWorkspace()
  }, [openWorkspace])

  const openWorkspaceFile = useCallback(
    (path: string): void => {
      openEditorView()
      void getAppActions().openPath?.(path)
    },
    [openEditorView]
  )

  const {
    width: explorerWidth,
    handleResizeStart: handleExplorerResizeStart,
    handleResizeKeyDown: handleExplorerResizeKeyDown
  } = useExplorerResize()

  const toggleExplorer = useCallback((): void => {
    if (!workspaceAvailable) return
    setExplorerVisible((current) => !current)
  }, [workspaceAvailable])

  return (
    <div
      className="app-shell"
      data-color-mode={resolvedAppearanceMode}
      data-appearance-mode={editorSettings.appearanceMode}
      data-ui-density={editorSettings.uiDensity}
      data-platform={platform}
      data-view={activeView}
      data-dragging={isDragging}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <main className="main-panel">
        <TitleBar
          mode={editorMode}
          documentActionsEnabled={!isImagePreview}
          platform={platform}
          searchValue={searchQuery}
          searchScope={searchScope}
          searchCaseSensitive={searchCaseSensitive}
          replaceValue={replaceValue}
          replaceVisible={replaceVisible}
          searchMatchCount={effectiveSearchMatchCount}
          activeSearchOrdinal={activeSearchOrdinal}
          searchResults={titlebarSearchResults}
          searchLoading={workspaceSearchLoading}
          searchError={workspaceSearchDisabledError ?? workspaceSearchError}
          workspaceAvailable={workspaceAvailable}
          searchTruncated={titlebarSearchTruncated}
          searchFocusRequestId={searchFocusRequestId}
          explorerVisible={isExplorerVisible}
          onModeChange={setEditorMode}
          onSearchChange={updateSearchQuery}
          onSearchScopeChange={updateSearchScope}
          onSearchCaseSensitiveChange={updateSearchCaseSensitive}
          onReplaceChange={setReplaceValue}
          onReplaceVisibleChange={setReplaceVisible}
          onSearchStep={stepSearchMatch}
          onSearchSelect={selectSearchMatch}
          onReplaceCurrent={replaceCurrentSearchMatch}
          onReplaceAll={() => void replaceAllSearchMatches()}
          onNew={handleNewTab}
          onOpen={() => void openDocument()}
          onOpenWorkspace={() => void openWorkspace()}
          onOpenRecent={openRecentView}
          onSave={() => void saveDocument()}
          onOpenSettings={() => openSettingsView('general')}
          onOpenAbout={() => openSettingsView('about')}
          onToggleExplorer={toggleExplorer}
          onCheckForUpdates={() => void checkForUpdates()}
          onExport={(format) => void handleExport(format)}
        />
        {activeView === 'editor' ? (
          <>
            <div className="editor-workspace" data-explorer-visible={isExplorerVisible}>
              {isExplorerVisible ? (
                <ResourceExplorer
                  workspaceRoot={workspaceRoot}
                  workspaceTree={workspaceTree}
                  selectedPath={document.path}
                  expandedPaths={expandedWorkspacePaths}
                  onOpenWorkspace={openWorkspaceFromExplorer}
                  onOpenFile={openWorkspaceFile}
                  onExpandedPathsChange={updateExpandedWorkspacePaths}
                  onCreateWorkspaceEntry={createWorkspaceEntry}
                  onRenameWorkspaceEntry={renameWorkspaceEntry}
                  onDeleteWorkspaceEntry={deleteWorkspaceEntry}
                  width={explorerWidth}
                  onResizeStart={handleExplorerResizeStart}
                  onResizeKeyDown={handleExplorerResizeKeyDown}
                />
              ) : null}
              <div className="editor-main">
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
                <section
                  ref={editorHostRef}
                  className="editor-host"
                  data-editor-mode={editorMode}
                  data-resource-kind={activeResourceKind}
                >
                  {activeTabNotice ? (
                    <InlineNotice
                      tone={
                        activeTabNotice.kind === 'removed'
                          ? 'danger'
                          : activeTabNotice.kind === 'conflict'
                            ? 'warning'
                            : 'success'
                      }
                      title={
                        activeTabNotice.kind === 'removed'
                          ? '文件已不在磁盘上'
                          : activeTabNotice.kind === 'conflict'
                            ? '文件已被外部修改'
                            : '已同步外部修改'
                      }
                      description={
                        activeTabNotice.kind === 'removed'
                          ? '该文件被移动或删除，当前内容仍保留在编辑器中。'
                          : activeTabNotice.kind === 'conflict'
                            ? '磁盘上的版本与你的未保存修改存在冲突。'
                            : undefined
                      }
                      actions={
                        activeTabNotice.kind === 'conflict'
                          ? [
                              {
                                label: '重新加载',
                                primary: true,
                                onClick: () =>
                                  externalDocs.resolveConflict(activeTabNoticePath, 'reload')
                              },
                              {
                                label: '保留我的修改',
                                onClick: () =>
                                  externalDocs.resolveConflict(activeTabNoticePath, 'keep')
                              }
                            ]
                          : activeTabNotice.kind === 'removed'
                            ? [
                                {
                                  label: '另存为…',
                                  primary: true,
                                  onClick: () => void externalDocs.saveMissing(activeTabNoticePath)
                                }
                              ]
                            : undefined
                      }
                      autoDismissMs={activeTabNotice.kind === 'synced' ? 2500 : undefined}
                      onDismiss={() => externalDocs.clearNotice(activeTabNoticePath)}
                    />
                  ) : null}
                  {activeTab ? (
                    isImagePreview ? (
                      document.imageSource ? (
                        <WorkspaceImagePreview
                          key={activeTab.id}
                          source={document.imageSource}
                          title={document.title}
                        />
                      ) : (
                        <div className="workspace-image-preview-error">无法加载图片资源</div>
                      )
                    ) : (
                      <Suspense fallback={<EditorLoadingFallback />}>
                        <MarkdownEditor
                          key={activeTab.id}
                          mode={editorMode}
                          dirty={document.dirty}
                          content={document.content}
                          externalRevision={activeTab.externalRevision ?? 0}
                          settings={editorSettings}
                          currentPath={document.path}
                          workspaceRoot={workspaceRoot}
                          anchorTarget={pendingAnchor}
                          searchQuery={searchQuery}
                          searchCaseSensitive={searchCaseSensitive}
                          activeSearchMatchIndex={activeSearchMatchIndex}
                          searchNavigationRequestId={searchNavigationRequestId}
                          initialScrollTop={activeTab.scrollTop}
                          onSearchMatchCountChange={updateSearchMatchCount}
                          onChange={setContent}
                          onCursorChange={(position) =>
                            setCursorPosition(position.line, position.column)
                          }
                          onScrollTopChange={(scrollTop) =>
                            setTabScrollTop(activeTab.id, scrollTop)
                          }
                          onOpenDocumentLink={openPathFromLink}
                          onLinkError={(message) => Toast.error(message)}
                        />
                      </Suspense>
                    )
                  ) : (
                    <div className="empty-editor" />
                  )}
                </section>
                {isImagePreview ? (
                  <footer className="statusbar">
                    <div className="statusbar-left">
                      <Typography.Text type="tertiary">图片预览</Typography.Text>
                    </div>
                    <div className="statusbar-right">
                      <Typography.Text type="tertiary">只读</Typography.Text>
                    </div>
                  </footer>
                ) : (
                  <StatusBar
                    mode={editorMode}
                    wordCount={wordCount}
                    dirty={document.dirty}
                    cursorPosition={cursorPosition}
                    showLineNumbers={editorSettings.showLineNumbers}
                  />
                )}
              </div>
            </div>
          </>
        ) : activeView === 'recent' ? (
          <RecentWorkbench
            activity={recentActivity}
            recentFiles={recentFiles}
            selectedPath={selectedRecentPath}
            customCss={editorSettings.customPreviewCss}
            showCodeBlockLineNumbers={editorSettings.showCodeBlockLineNumbers}
            onSelectFile={(path) => void loadRecentActivity(path)}
            onBack={openEditorView}
            onOpenInEditor={(path) => {
              openEditorView()
              void openPath(path, { mode: 'preview-edit' })
            }}
          />
        ) : (
          <SettingsPage
            key={settingsInitialSection}
            settings={editorSettings}
            updaterStatus={updater.status}
            workspaceRoot={workspaceRoot}
            initialSection={settingsInitialSection}
            onBack={openEditorView}
            onChange={(nextSettings) => {
              updateSettings(nextSettings)
            }}
            onReset={() => void resetSettings()}
            onCheckForUpdates={() => void checkForUpdates()}
          />
        )}
      </main>
      <CloseTabDecisionHost />
      <Modal visible={!!exportProgress} title="正在导出" footer={null} closable={false} width={420}>
        {exportProgress ? (
          <div className="export-progress-modal">
            <Progress percent={exportProgress.percent} showInfo />
            <Typography.Text type="tertiary">{exportProgress.message}</Typography.Text>
          </div>
        ) : null}
      </Modal>
      <Modal
        visible={updater.dialog === 'available' && updater.status?.state === 'available'}
        title={updater.status?.version ? `发现新版本 ${updater.status.version}` : '发现新版本'}
        okText="下载更新"
        cancelText="稍后"
        width={560}
        onOk={() => void updater.download()}
        onCancel={() => updater.setDialog(null)}
      >
        {updater.status ? (
          <div className="updater-dialog-content">
            <div className="updater-dialog-meta">
              {updater.status.releaseName ? <span>{updater.status.releaseName}</span> : null}
              {updater.status.releaseDate ? (
                <span>发布于 {formatUpdateDate(updater.status.releaseDate)}</span>
              ) : null}
            </div>
            <Typography.Text type="tertiary">{updater.status.message}</Typography.Text>
            <div className="updater-release-notes" aria-label="更新日志">
              <div className="updater-release-notes-title">更新日志</div>
              <pre>{getUpdateNotes(updater.status)}</pre>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        visible={updater.dialog === 'downloaded' && updater.status?.state === 'downloaded'}
        title="更新已准备就绪"
        okText="重启安装"
        cancelText="稍后"
        width={520}
        onOk={() => void updater.install()}
        onCancel={() => updater.setDialog(null)}
      >
        {updater.status ? (
          <div className="updater-dialog-content">
            <Typography.Text>
              {updater.status.version
                ? `版本 ${updater.status.version} 已下载，重启后会完成安装。`
                : '更新已下载，重启后会完成安装。'}
            </Typography.Text>
            <div className="updater-release-notes" aria-label="更新日志">
              <div className="updater-release-notes-title">更新日志</div>
              <pre>{getUpdateNotes(updater.status)}</pre>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        visible={updater.status?.state === 'downloading'}
        title="正在下载更新"
        footer={null}
        closable={false}
        width={420}
      >
        {updater.status ? (
          <div className="export-progress-modal">
            <Progress percent={Math.round(updater.status.percent ?? 0)} showInfo />
            <Typography.Text type="tertiary">{updater.status.message}</Typography.Text>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
