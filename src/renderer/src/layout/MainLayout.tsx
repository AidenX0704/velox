import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, Progress, Toast, Typography } from '@douyinfe/semi-ui'
import { exportFormatLabels, type ExportFormat, type ExportProgress } from '../../../shared/export'
import type { UpdaterStatus } from '../../../shared/types'
import { MarkdownEditor } from '../modules/editor/MarkdownEditor'
import type { CursorPosition } from '../modules/editor/model/types'
import { useDocument } from '../features/document/useDocument'
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

export function MainLayout(): React.JSX.Element {
  const [activeView, setActiveView] = useState<AppView>('editor')
  const [platform, setPlatform] = useState<string>('')
  const [resolvedAppearanceMode, setResolvedAppearanceMode] =
    useState<ResolvedAppearanceMode>('light')
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ line: 1, column: 1 })
  const [expandedWorkspacePaths, setExpandedWorkspacePaths] = useState<string[]>([])
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)
  const workspacePersistTimerRef = useRef<number | undefined>(undefined)
  const sessionPersistTimerRef = useRef<number | undefined>(undefined)
  const exportProgressCloseTimerRef = useRef<number | undefined>(undefined)
  const updaterManualCheckRef = useRef(false)
  const updaterAvailablePromptRef = useRef<string | undefined>(undefined)
  const updaterInstallPromptRef = useRef<string | undefined>(undefined)
  const { settings: editorSettings, updateSettings, resetSettings } = useEditorSettings()
  const {
    document,
    editorMode,
    workspaceRoot,
    workspaceTree,
    recentFiles,
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
    openWorkspace,
    createWorkspaceEntry,
    renameWorkspaceEntry,
    deleteWorkspaceEntry
  } = useDocument()

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
    setEditorMode(editorSettings.defaultMode)
  }, [editorSettings.defaultMode, setEditorMode])

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
    if (!workspaceRoot) {
      return
    }

    let cancelled = false

    window.api.workspace.getState(workspaceRoot).then((result) => {
      if (cancelled) {
        return
      }

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
    if (!document.path) {
      return
    }

    let cancelled = false

    window.api.session.getDocument(document.path).then((result) => {
      if (cancelled) {
        return
      }

      if (result.ok && result.data) {
        setEditorMode(result.data.mode)
        setCursorPosition({ line: result.data.cursorLine, column: result.data.cursorColumn })
      }
    })

    return () => {
      cancelled = true
    }
  }, [document.path, setEditorMode])

  useEffect(() => {
    if (!workspaceRoot) {
      return
    }

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
    if (!document.path) {
      return
    }

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
    if (!pendingAnchor) {
      return
    }

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

  const openEditorView = (): void => {
    setActiveView('editor')
  }

  const openSettingsView = (): void => {
    setActiveView('settings')
  }

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
    updateSettings
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
    saveDocument
  ])

  return (
    <div
      className="app-shell"
      data-color-mode={resolvedAppearanceMode}
      data-appearance-mode={editorSettings.appearanceMode}
      data-platform={platform}
      data-sidebar-visible={editorSettings.showSidebar}
      data-view={activeView}
    >
      <Sidebar
        activeView={activeView}
        visible={editorSettings.showSidebar}
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
              title={document.title}
              dirty={document.dirty}
              mode={editorMode}
              platform={platform}
              showSidebar={editorSettings.showSidebar}
              onModeChange={setEditorMode}
              onToggleSidebar={() => updateSettings({ showSidebar: !editorSettings.showSidebar })}
              onOpen={() => void openDocument()}
              onSave={() => void saveDocument()}
              onExport={(format) => void handleExport(format)}
            />
            <section className="editor-host" data-editor-mode={editorMode}>
              <MarkdownEditor
                mode={editorMode}
                dirty={document.dirty}
                content={document.content}
                settings={editorSettings}
                currentPath={document.path}
                workspaceRoot={workspaceRoot}
                anchorTarget={pendingAnchor}
                onChange={setContent}
                onCursorChange={setCursorPosition}
                onOpenDocumentLink={openPathFromLink}
                onLinkError={(message) => Toast.error(message)}
              />
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
