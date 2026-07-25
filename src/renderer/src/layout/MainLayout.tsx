import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Progress, Toast, Typography } from '@douyinfe/semi-ui'
import { IconFolderStroked } from '@douyinfe/semi-icons'
import { exportFormatLabels, type ExportFormat, type ExportProgress } from '../../../shared/export'
import type {
  HistoryDocumentActivity,
  UpdaterStatus,
  WorkspaceEntry,
  WorkspaceSearchResult
} from '../../../shared/types'
import { normalizeEditorMode } from '../../../shared/preferences'
import type { CursorPosition, EditorMode } from '../modules/editor/model/types'
import {
  findTextSearchMatches,
  normalizeSearchQuery,
  replaceTextSearchMatches
} from '../modules/editor/services/documentSearch'
import '../modules/editor/styles/editor.css'
import { createWelcomeDocument, useTabs } from '../features/tabs/useTabs'
import { TabBar } from '../features/tabs/TabBar'
import { useEditorSettings } from '../features/settings/useEditorSettings'
import {
  applyThemeToDocument,
  resolveAppearanceMode,
  resolveThemeAccent,
  subscribeToSystemAppearance,
  type ResolvedAppearanceMode
} from '../features/theme/theme'
import { StatusBar } from './StatusBar'
import { SettingsPage, type PreferenceSection } from './SettingsPanel'
import { TitleBar, type TitleBarSearchResult, type TitleBarSearchScope } from './TitleBar'
import { WorkspaceTree } from './WorkspaceTree'

type AppView = 'editor' | 'recent' | 'settings'
type UpdaterDialogKind = 'available' | 'downloaded' | null
const MAX_TITLEBAR_SEARCH_RESULTS = 80

const MarkdownEditor = lazy(() =>
  import('../modules/editor/MarkdownEditor').then((module) => ({
    default: module.MarkdownEditor
  }))
)

const MarkdownPreview = lazy(() =>
  import('../modules/editor/preview/MarkdownPreview').then((module) => ({
    default: module.MarkdownPreview
  }))
)

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

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

function compactSearchSnippetPart(value: string): string {
  return value.replace(/\s+/g, ' ')
}

function buildSearchResultSnippet(
  content: string,
  from: number,
  to: number
): Pick<TitleBarSearchResult, 'before' | 'match' | 'after'> {
  const lineStart = content.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  const nextLineBreak = content.indexOf('\n', to)
  const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak
  const beforeStart = Math.max(lineStart, from - 42)
  const afterEnd = Math.min(lineEnd, to + 58)

  return {
    before: `${beforeStart > lineStart ? '...' : ''}${compactSearchSnippetPart(
      content.slice(beforeStart, from)
    )}`,
    match: compactSearchSnippetPart(content.slice(from, to)),
    after: `${compactSearchSnippetPart(content.slice(to, afterEnd))}${
      afterEnd < lineEnd ? '...' : ''
    }`
  }
}

function buildTitlebarSearchResults(
  content: string,
  query: string,
  caseSensitive: boolean
): { totalCount: number; items: TitleBarSearchResult[] } {
  const normalizedQuery = normalizeSearchQuery(query)
  if (!normalizedQuery) {
    return { totalCount: 0, items: [] }
  }

  const matches = findTextSearchMatches(content, normalizedQuery, { caseSensitive })
  let currentLine = 1
  let scannedOffset = 0

  const items = matches.slice(0, MAX_TITLEBAR_SEARCH_RESULTS).map((match, index) => {
    let newlineOffset = content.indexOf('\n', scannedOffset)
    while (newlineOffset !== -1 && newlineOffset < match.from) {
      currentLine += 1
      scannedOffset = newlineOffset + 1
      newlineOffset = content.indexOf('\n', scannedOffset)
    }

    const lineStart = content.lastIndexOf('\n', Math.max(0, match.from - 1)) + 1

    return {
      id: `document-${index}-${currentLine}-${match.from}`,
      scope: 'document' as const,
      index,
      matchIndex: index,
      line: currentLine,
      column: match.from - lineStart + 1,
      ...buildSearchResultSnippet(content, match.from, match.to)
    }
  })

  return { totalCount: matches.length, items }
}

function flattenWorkspaceSearchResults(
  result: WorkspaceSearchResult | null
): TitleBarSearchResult[] {
  if (!result) {
    return []
  }

  let globalIndex = 0
  const items: TitleBarSearchResult[] = []

  for (const file of result.files) {
    for (const match of file.matches) {
      items.push({
        id: `workspace-${globalIndex}-${file.path}-${match.index}`,
        scope: 'workspace',
        index: globalIndex,
        matchIndex: match.index,
        path: file.path,
        relativePath: file.relativePath,
        fileName: file.name,
        line: match.line,
        column: match.column,
        before: match.before,
        match: match.match,
        after: match.after
      })
      globalIndex += 1
    }
  }

  return items
}

function isPathInsideWorkspace(filePath: string, workspacePath: string): boolean {
  const normalizedFilePath = filePath.replace(/\\/g, '/')
  const normalizedWorkspacePath = workspacePath.replace(/\\/g, '/').replace(/\/$/, '')

  return (
    normalizedFilePath === normalizedWorkspacePath ||
    normalizedFilePath.startsWith(`${normalizedWorkspacePath}/`)
  )
}

function EditorLoadingFallback(): React.JSX.Element {
  return (
    <div className="editor-loading" aria-label="正在加载编辑器">
      <div className="editor-loading-toolbar" />
      <div className="editor-loading-body">
        <div className="editor-loading-column">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="editor-loading-column editor-loading-column-preview">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}

function formatActivityTime(value?: string): string {
  if (!value) return '暂无'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function formatUpdateDate(value?: string): string | undefined {
  if (!value) return undefined

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function getUpdateNotes(status: UpdaterStatus): string {
  return status.releaseNotes?.trim() || '此版本没有提供更新日志。'
}

function ResourceExplorer({
  workspaceRoot,
  workspaceTree,
  selectedPath,
  expandedPaths,
  onOpenWorkspace,
  onOpenFile,
  onExpandedPathsChange,
  onCreateWorkspaceEntry,
  onRenameWorkspaceEntry,
  onDeleteWorkspaceEntry
}: {
  workspaceRoot: string | null
  workspaceTree: WorkspaceEntry[]
  selectedPath?: string
  expandedPaths: string[]
  onOpenWorkspace: () => void
  onOpenFile: (path: string) => void
  onExpandedPathsChange: (paths: string[]) => void
  onCreateWorkspaceEntry: (
    parentPath: string,
    name: string,
    type: 'file' | 'directory'
  ) => Promise<string | null>
  onRenameWorkspaceEntry: (path: string, newName: string) => Promise<string | null>
  onDeleteWorkspaceEntry: (path: string) => Promise<boolean>
}): React.JSX.Element {
  const singleFileEntry: WorkspaceEntry | null =
    !workspaceRoot && selectedPath
      ? {
          path: selectedPath,
          name: basename(selectedPath),
          type: 'file'
        }
      : null

  return (
    <aside className="resource-explorer" aria-label="资源管理器">
      <header className="resource-explorer-header">
        <div className="resource-explorer-title">资源管理器</div>
      </header>
      {workspaceRoot ? (
        <WorkspaceTree
          entries={workspaceTree}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          workspaceRoot={workspaceRoot}
          onOpenFile={onOpenFile}
          onExpandedPathsChange={onExpandedPathsChange}
          onCreateWorkspaceEntry={onCreateWorkspaceEntry}
          onRenameWorkspaceEntry={onRenameWorkspaceEntry}
          onDeleteWorkspaceEntry={onDeleteWorkspaceEntry}
        />
      ) : singleFileEntry ? (
        <WorkspaceTree
          entries={[singleFileEntry]}
          selectedPath={selectedPath}
          workspaceRoot={singleFileEntry.path}
          workspaceRootType="file"
          onOpenFile={onOpenFile}
        />
      ) : (
        <div className="resource-explorer-empty">
          <IconFolderStroked />
          <Typography.Text strong>未打开文件夹</Typography.Text>
          <Typography.Text type="tertiary">
            打开一个本地文件夹后可浏览 Markdown 文件。
          </Typography.Text>
          <button
            className="resource-explorer-empty-action"
            type="button"
            onClick={onOpenWorkspace}
          >
            打开文件夹
          </button>
        </div>
      )}
    </aside>
  )
}

function RecentWorkbench({
  activity,
  recentFiles,
  selectedPath,
  onSelectFile,
  onOpenInEditor,
  onBack,
  customCss
}: {
  activity: HistoryDocumentActivity | null
  recentFiles: import('../../../shared/types').RecentFileRecord[]
  selectedPath?: string
  onSelectFile: (path: string) => void
  onOpenInEditor: (path: string) => void
  onBack: () => void
  customCss?: string
}): React.JSX.Element {
  const selectedFile = recentFiles.find((file) => file.path === selectedPath)

  return (
    <section className="recent-workbench" aria-label="最近活动">
      <header className="recent-workbench-header">
        <div className="recent-workbench-title">
          <Typography.Title heading={5}>最近活动</Typography.Title>
          <Typography.Text type="tertiary">
            查看打开记录、分支推进和当前文档相对最近快照的变化。
          </Typography.Text>
        </div>
        <div className="recent-workbench-actions">
          <button className="recent-workbench-open" type="button" onClick={onBack}>
            返回编辑
          </button>
          {activity ? (
            <button
              className="recent-workbench-open recent-workbench-open-primary"
              type="button"
              onClick={() => onOpenInEditor(activity.path)}
            >
              打开编辑
            </button>
          ) : null}
        </div>
      </header>
      <div className="recent-workbench-body">
        <aside className="recent-workbench-list" aria-label="最近文档">
          {recentFiles.map((file) => (
            <button
              key={file.path}
              className="recent-workbench-file"
              data-active={file.path === selectedPath}
              type="button"
              title={file.path}
              onClick={() => onSelectFile(file.path)}
            >
              <span className="recent-workbench-file-title">{file.title}</span>
              <span className="recent-workbench-file-path">{file.path}</span>
              <span className="recent-workbench-file-time">
                {formatActivityTime(file.lastOpenedAt)}
              </span>
            </button>
          ))}
          {recentFiles.length === 0 ? (
            <Typography.Text className="recent-workbench-empty" type="tertiary">
              拖入或打开 Markdown 文档后会出现在这里
            </Typography.Text>
          ) : null}
        </aside>
        {activity ? (
          <>
            <section className="recent-workbench-state" aria-label="文档状态">
              <div className="recent-state-card">
                <span className="recent-state-label">当前文档</span>
                <strong title={activity.path}>{activity.title}</strong>
                <span className="recent-state-path">{activity.path}</span>
              </div>
              <div className="recent-state-grid">
                <div className="recent-state-metric">
                  <span>新增</span>
                  <strong>+{activity.diff.addedLines}</strong>
                </div>
                <div className="recent-state-metric">
                  <span>删除</span>
                  <strong>-{activity.diff.removedLines}</strong>
                </div>
                <div className="recent-state-metric">
                  <span>分支</span>
                  <strong>{activity.headSnapshot?.branchName ?? 'main'}</strong>
                </div>
              </div>
              <div className="recent-state-card">
                <span className="recent-state-label">最近快照</span>
                <strong>
                  {activity.headSnapshot
                    ? `#${activity.headSnapshot.id}`
                    : selectedFile
                      ? '等待首次快照'
                      : '暂无'}
                </strong>
                <span className="recent-state-path">
                  {formatActivityTime(activity.headSnapshot?.createdAt)}
                </span>
              </div>
              <div className="recent-diff-panel">
                <header>
                  <span>变化对比</span>
                  <strong>{activity.diff.unchanged ? '无未保存变化' : '当前文件有变化'}</strong>
                </header>
                <div className="recent-diff-lines">
                  {activity.diff.lines.map((line, index) => (
                    <div
                      key={`${line.type}-${index}`}
                      className="recent-diff-line"
                      data-type={line.type}
                    >
                      <span>
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      <code>{line.text || ' '}</code>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className="recent-rendered-preview" aria-label="渲染预览">
              <Suspense fallback={<div className="recent-preview-loading" />}>
                <MarkdownPreview content={activity.currentContent} customCss={customCss} />
              </Suspense>
            </section>
          </>
        ) : (
          <div className="recent-workbench-placeholder">
            <Typography.Text type="tertiary">
              选择一个最近文档查看渲染状态和变化对比
            </Typography.Text>
          </div>
        )}
      </div>
    </section>
  )
}

export function MainLayout(): React.JSX.Element {
  const [activeView, setActiveView] = useState<AppView>('editor')
  const [platform, setPlatform] = useState<string>('')
  const [resolvedAppearanceMode, setResolvedAppearanceMode] =
    useState<ResolvedAppearanceMode>('light')
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceEntry[]>([])
  const [expandedWorkspacePaths, setExpandedWorkspacePaths] = useState<string[]>([])
  const [explorerVisible, setExplorerVisible] = useState(true)
  const [recentFiles, setRecentFiles] = useState<
    import('../../../shared/types').RecentFileRecord[]
  >([])
  const [selectedRecentPath, setSelectedRecentPath] = useState<string | undefined>(undefined)
  const [recentActivity, setRecentActivity] = useState<HistoryDocumentActivity | null>(null)
  const [settingsInitialSection, setSettingsInitialSection] = useState<PreferenceSection>('general')
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)
  const [updaterDialog, setUpdaterDialog] = useState<UpdaterDialogKind>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<TitleBarSearchScope>('document')
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false)
  const [replaceValue, setReplaceValue] = useState('')
  const [replaceVisible, setReplaceVisible] = useState(false)
  const [, setSearchMatchCount] = useState(0)
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0)
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0)
  const [searchFocusRequestId, setSearchFocusRequestId] = useState(0)
  const [searchNavigationRequestId, setSearchNavigationRequestId] = useState(0)
  const [workspaceSearchResult, setWorkspaceSearchResult] = useState<WorkspaceSearchResult | null>(
    null
  )
  const [workspaceSearchLoading, setWorkspaceSearchLoading] = useState(false)
  const [workspaceSearchError, setWorkspaceSearchError] = useState<string | undefined>(undefined)
  const workspacePersistTimerRef = useRef<number | undefined>(undefined)
  const sessionPersistTimerRef = useRef<number | undefined>(undefined)
  const exportProgressCloseTimerRef = useRef<number | undefined>(undefined)
  const editorHostRef = useRef<HTMLElement | null>(null)
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
    updateTabDocument,
    findTabByPath
  } = useTabs()

  // Refs for stable callback references
  const openPathRef = useRef<
    ((path: string, options?: { mode?: EditorMode }) => Promise<boolean>) | undefined
  >(undefined)
  const loadWorkspaceRef = useRef<((path: string) => Promise<void>) | undefined>(undefined)
  const refreshRecentRef = useRef<
    (() => Promise<import('../../../shared/types').RecentFileRecord[]>) | undefined
  >(undefined)
  const hasInitializedRef = useRef(false)

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
  const editorMode = activeTab?.editorMode ?? 'preview-edit'
  const cursorPosition = useMemo<CursorPosition>(
    () => ({
      line: activeTab?.cursorLine ?? 1,
      column: activeTab?.cursorColumn ?? 1
    }),
    [activeTab?.cursorLine, activeTab?.cursorColumn]
  )
  const wordCount = useMemo(() => computeWordCount(document.content), [document.content])
  const searchResultSummary = useMemo(
    () => buildTitlebarSearchResults(document.content, searchQuery, searchCaseSensitive),
    [document.content, searchCaseSensitive, searchQuery]
  )
  const workspaceSearchResults = useMemo(
    () => flattenWorkspaceSearchResults(workspaceSearchResult),
    [workspaceSearchResult]
  )
  const titlebarSearchResults =
    searchScope === 'workspace' ? workspaceSearchResults : searchResultSummary.items
  const effectiveSearchMatchCount =
    searchScope === 'workspace'
      ? (workspaceSearchResult?.totalCount ?? 0)
      : searchResultSummary.totalCount
  const titlebarSearchTruncated =
    searchScope === 'workspace'
      ? Boolean(workspaceSearchResult?.truncated)
      : searchResultSummary.totalCount > searchResultSummary.items.length
  const activeSearchOrdinal =
    searchQuery && effectiveSearchMatchCount > 0
      ? Math.min(activeSearchResultIndex, effectiveSearchMatchCount - 1) + 1
      : 0
  const searchResultsForNavigation = titlebarSearchResults
  const workspaceSearchDisabledError =
    searchScope === 'workspace' && !workspaceRoot ? '先打开一个工作区' : undefined

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
        const touchResult = await window.api.document.openPath(path)
        if (!touchResult.ok) {
          Toast.error(touchResult.error.message)
        }
        void refreshRecent()
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

  const loadWorkspace = useCallback(async (path: string) => {
    setWorkspaceSearchLoading(false)
    setWorkspaceSearchError(undefined)
    setWorkspaceSearchResult(null)
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

  const refreshWorkspaceTree = useCallback(async (): Promise<void> => {
    if (!workspaceRoot) return

    const result = await window.api.workspace.getTree(workspaceRoot)
    if (result.ok) {
      setWorkspaceTree(result.data)
    }
  }, [workspaceRoot])

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
        setExplorerVisible(result.data.sidebarVisible)
      }
    })

    return () => {
      cancelled = true
    }
  }, [workspaceRoot])

  useEffect(() => {
    if (!document.path) return

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
  }, [document.path, setEditorMode, setCursorPosition])

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
    if (!workspaceRoot) return

    window.clearTimeout(workspacePersistTimerRef.current)
    workspacePersistTimerRef.current = window.setTimeout(() => {
      void window.api.workspace.updateState({
        workspacePath: workspaceRoot,
        expandedPaths: expandedWorkspacePaths,
        sidebarVisible: explorerVisible
      })
    }, 250)
  }, [expandedWorkspacePaths, explorerVisible, workspaceRoot])

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

  const openEditorView = useCallback((): void => {
    setActiveView('editor')
  }, [])

  const openSettingsView = useCallback((section: PreferenceSection = 'general'): void => {
    setSettingsInitialSection(section)
    setActiveView('settings')
  }, [])

  const triggerDocumentSearch = useCallback((): void => {
    openEditorView()
    setSearchFocusRequestId((current) => current + 1)
  }, [openEditorView])

  const updateSearchQuery = useCallback((value: string): void => {
    setSearchQuery(value)
    setSearchMatchCount(0)
    setActiveSearchResultIndex(0)
    setActiveSearchMatchIndex(0)
    setWorkspaceSearchResult(null)
    setWorkspaceSearchError(undefined)
    setWorkspaceSearchLoading(false)
  }, [])

  const updateSearchScope = useCallback((scope: TitleBarSearchScope): void => {
    setSearchScope(scope)
    setSearchMatchCount(0)
    setActiveSearchResultIndex(0)
    setActiveSearchMatchIndex(0)
    setWorkspaceSearchResult(null)
    setWorkspaceSearchError(undefined)
    setWorkspaceSearchLoading(false)
  }, [])

  const updateSearchCaseSensitive = useCallback((caseSensitive: boolean): void => {
    setSearchCaseSensitive(caseSensitive)
    setSearchMatchCount(0)
    setActiveSearchResultIndex(0)
    setActiveSearchMatchIndex(0)
    setWorkspaceSearchResult(null)
    setWorkspaceSearchError(undefined)
    setWorkspaceSearchLoading(false)
  }, [])

  const updateSearchMatchCount = useCallback((count: number): void => {
    setSearchMatchCount(count)
    setActiveSearchMatchIndex((current) => (count === 0 ? 0 : Math.min(current, count - 1)))
  }, [])

  useEffect(() => {
    const normalizedQuery = normalizeSearchQuery(searchQuery)

    if (searchScope !== 'workspace' || !normalizedQuery || !workspaceRoot) return

    let cancelled = false

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return
      }

      setWorkspaceSearchLoading(true)
      setWorkspaceSearchError(undefined)
      setWorkspaceSearchResult(null)

      window.api.workspace
        .search({
          rootPath: workspaceRoot,
          query: normalizedQuery,
          caseSensitive: searchCaseSensitive
        })
        .then((result) => {
          if (cancelled) {
            return
          }

          if (result.ok) {
            setWorkspaceSearchResult(result.data)
            setActiveSearchResultIndex((current) =>
              result.data.totalCount === 0 ? 0 : Math.min(current, result.data.totalCount - 1)
            )
          } else {
            setWorkspaceSearchResult(null)
            setWorkspaceSearchError(result.error.message)
          }
        })
        .finally(() => {
          if (!cancelled) {
            setWorkspaceSearchLoading(false)
          }
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchCaseSensitive, searchQuery, searchScope, workspaceRoot])

  const navigateToSearchResult = useCallback(
    async (result: TitleBarSearchResult): Promise<void> => {
      openEditorView()

      if (result.scope === 'workspace' && result.path) {
        const opened = await openPath(result.path, { mode: 'source' })
        if (!opened) {
          return
        }
      } else {
        setEditorMode('source')
      }

      setActiveSearchResultIndex(result.index)
      setActiveSearchMatchIndex(result.matchIndex)
      setSearchNavigationRequestId((current) => current + 1)
    },
    [openEditorView, openPath, setEditorMode]
  )

  const stepSearchMatch = useCallback(
    (direction: 1 | -1): void => {
      if (searchScope === 'workspace') {
        const visibleResultCount = searchResultsForNavigation.length

        if (visibleResultCount === 0) {
          setSearchFocusRequestId((current) => current + 1)
          return
        }

        const nextIndex =
          (activeSearchResultIndex + direction + visibleResultCount) % visibleResultCount
        const nextResult = searchResultsForNavigation[nextIndex]

        if (nextResult) {
          void navigateToSearchResult(nextResult)
        }
        return
      }

      const matchCount = searchResultSummary.totalCount

      if (matchCount === 0) {
        setSearchFocusRequestId((current) => current + 1)
        return
      }

      const nextIndex = (activeSearchResultIndex + direction + matchCount) % matchCount
      openEditorView()
      setEditorMode('source')
      setActiveSearchResultIndex(nextIndex)
      setActiveSearchMatchIndex(nextIndex)
      setSearchNavigationRequestId((current) => current + 1)
    },
    [
      activeSearchResultIndex,
      navigateToSearchResult,
      openEditorView,
      searchResultSummary.totalCount,
      searchResultsForNavigation,
      searchScope,
      setEditorMode
    ]
  )

  const selectSearchMatch = useCallback(
    (result: TitleBarSearchResult): void => {
      void navigateToSearchResult(result)
    },
    [navigateToSearchResult]
  )

  const replaceCurrentSearchMatch = useCallback((): void => {
    const normalizedQuery = normalizeSearchQuery(searchQuery)

    if (!normalizedQuery) {
      setSearchFocusRequestId((current) => current + 1)
      return
    }

    if (searchScope === 'workspace') {
      Toast.warning('工作区范围请使用全部替换')
      return
    }

    const matches = findTextSearchMatches(document.content, normalizedQuery, {
      caseSensitive: searchCaseSensitive
    })

    if (matches.length === 0) {
      setSearchFocusRequestId((current) => current + 1)
      return
    }

    const matchIndex = Math.min(activeSearchMatchIndex, matches.length - 1)
    const match = matches[matchIndex]
    const nextContent = replaceTextSearchMatches(document.content, [match], replaceValue)
    const nextMatches = findTextSearchMatches(nextContent, normalizedQuery, {
      caseSensitive: searchCaseSensitive
    })
    const nextIndex = nextMatches.length === 0 ? 0 : Math.min(matchIndex, nextMatches.length - 1)

    openEditorView()
    setEditorMode('source')
    setContent(nextContent)
    setActiveSearchResultIndex(nextIndex)
    setActiveSearchMatchIndex(nextIndex)
    setSearchNavigationRequestId((current) => current + 1)
    Toast.success('已替换 1 处')
  }, [
    activeSearchMatchIndex,
    document.content,
    openEditorView,
    replaceValue,
    searchCaseSensitive,
    searchQuery,
    searchScope,
    setContent,
    setEditorMode
  ])

  const replaceAllSearchMatches = useCallback(async (): Promise<void> => {
    const normalizedQuery = normalizeSearchQuery(searchQuery)

    if (!normalizedQuery) {
      setSearchFocusRequestId((current) => current + 1)
      return
    }

    if (searchScope !== 'workspace') {
      const matches = findTextSearchMatches(document.content, normalizedQuery, {
        caseSensitive: searchCaseSensitive
      })

      if (matches.length === 0) {
        setSearchFocusRequestId((current) => current + 1)
        return
      }

      openEditorView()
      setEditorMode('source')
      setContent(replaceTextSearchMatches(document.content, matches, replaceValue))
      setActiveSearchResultIndex(0)
      setActiveSearchMatchIndex(0)
      setSearchNavigationRequestId((current) => current + 1)
      Toast.success(`已替换 ${matches.length} 处`)
      return
    }

    if (!workspaceRoot) {
      Toast.error('先打开一个工作区')
      return
    }

    const dirtyWorkspaceTabs = tabs.filter(
      (tab) =>
        tab.document.dirty &&
        tab.document.path &&
        isPathInsideWorkspace(tab.document.path, workspaceRoot)
    )
    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '替换整个工作区匹配项？',
        content:
          dirtyWorkspaceTabs.length > 0
            ? `将按磁盘文件替换 ${effectiveSearchMatchCount} 处匹配，并刷新已打开的命中文件。${dirtyWorkspaceTabs.length} 个未保存标签可能被磁盘内容覆盖。`
            : `将按磁盘文件替换 ${effectiveSearchMatchCount} 处匹配。`,
        okText: '全部替换',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })

    if (!confirmed) {
      return
    }

    const result = await window.api.workspace.replaceAll({
      rootPath: workspaceRoot,
      query: normalizedQuery,
      replacement: replaceValue,
      caseSensitive: searchCaseSensitive
    })

    if (!result.ok) {
      Toast.error(result.error.message)
      return
    }

    for (const file of result.data.files) {
      const openTab = findTabByPath(file.path)

      if (!openTab) {
        continue
      }

      const documentResult = await window.api.document.openPath(file.path)
      if (documentResult.ok) {
        updateTabDocument(openTab.id, {
          path: documentResult.data.path,
          title: documentResult.data.title,
          content: documentResult.data.content,
          dirty: false,
          updatedAt: documentResult.data.updatedAt
        })
      }
    }

    const searchResult = await window.api.workspace.search({
      rootPath: workspaceRoot,
      query: normalizedQuery,
      caseSensitive: searchCaseSensitive
    })

    if (searchResult.ok) {
      setWorkspaceSearchResult(searchResult.data)
    }

    setActiveSearchResultIndex(0)
    setActiveSearchMatchIndex(0)
    void refreshWorkspaceTree()
    Toast.success(`已替换 ${result.data.replacements} 处，涉及 ${result.data.changedFiles} 个文件`)
  }, [
    document.content,
    effectiveSearchMatchCount,
    findTabByPath,
    openEditorView,
    refreshWorkspaceTree,
    replaceValue,
    searchCaseSensitive,
    searchQuery,
    searchScope,
    setContent,
    setEditorMode,
    tabs,
    updateTabDocument,
    workspaceRoot
  ])

  const openRecentView = useCallback((): void => {
    setActiveView('recent')
    const targetPath = selectedRecentPath ?? document.path ?? recentFiles[0]?.path

    if (targetPath) {
      void loadRecentActivity(targetPath)
    }
  }, [document.path, loadRecentActivity, recentFiles, selectedRecentPath])

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
    setUpdaterDialog(null)

    const result = await window.api.updater.downloadUpdate()

    if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [])

  const installUpdate = useCallback(async (): Promise<void> => {
    setUpdaterDialog(null)

    const result = await window.api.updater.quitAndInstall()

    if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [])

  const handleUpdaterStatus = useCallback((status: UpdaterStatus): void => {
    setUpdaterStatus(status)

    if (status.state === 'available') {
      updaterManualCheckRef.current = false

      const version = status.version ?? status.updatedAt
      if (updaterAvailablePromptRef.current === version) {
        return
      }

      updaterAvailablePromptRef.current = version
      setUpdaterDialog('available')
      return
    }

    if (status.state === 'downloading') {
      setUpdaterDialog(null)
      return
    }

    if (status.state === 'downloaded') {
      const version = status.version ?? status.updatedAt
      if (updaterInstallPromptRef.current === version) {
        return
      }

      updaterInstallPromptRef.current = version
      setUpdaterDialog('downloaded')
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
  }, [])

  const checkForUpdates = useCallback(async (): Promise<void> => {
    updaterManualCheckRef.current = true
    updaterAvailablePromptRef.current = undefined
    updaterInstallPromptRef.current = undefined
    Toast.info('正在检查更新')

    const result = await window.api.updater.checkForUpdates()

    if (!result.ok) {
      updaterManualCheckRef.current = false
      Toast.error(result.error.message)
      return
    }

    handleUpdaterStatus(result.data)
  }, [handleUpdaterStatus])

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
        setEditorMode('source')
        return
      }
      if (e.key === '2' && e.shiftKey) {
        e.preventDefault()
        setEditorMode('preview-edit')
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
    triggerDocumentSearch
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

        const pendingOpenFileResult = await window.api.app.getPendingOpenFile()
        if (cancelled) return

        if (pendingOpenFileResult.ok && pendingOpenFileResult.data) {
          openEditorView()
          await openPath(pendingOpenFileResult.data, { mode: 'preview-edit' })
          return
        }

        const preferenceResult = await window.api.preferences.getEditor()
        if (cancelled) return

        if (!preferenceResult.ok) {
          Toast.error(preferenceResult.error.message)
          return
        }

        const recentWorkspaceResult = await window.api.recent.listWorkspaces()
        if (cancelled) return
        const recentWorkspace = recentWorkspaceResult.ok ? recentWorkspaceResult.data[0] : undefined

        if (!preferenceResult.data.hasSeenWelcome) {
          replaceTabs([
            {
              document: createWelcomeDocument(),
              editorMode: preferenceResult.data.defaultMode
            }
          ])
          void window.api.preferences.updateEditor({ hasSeenWelcome: true })
          if (recentWorkspace) {
            await loadWorkspace(recentWorkspace.path)
          }
          return
        }

        const lastDocumentResult = await window.api.session.getLastDocument()
        if (cancelled) return

        if (lastDocumentResult.ok && lastDocumentResult.data) {
          const opened = await openPath(lastDocumentResult.data.path, {
            mode: normalizeEditorMode(lastDocumentResult.data.mode)
          })

          if (opened && recentWorkspace) {
            await loadWorkspace(recentWorkspace.path)
          }

          return
        }

        if (recentWorkspace) {
          await loadWorkspace(recentWorkspace.path)
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
          firstOpenedFilePath ??= filePath
        }
      }

      if (firstOpenedFilePath) {
        await refreshRecentRef.current?.()
        setSelectedRecentPath(firstOpenedFilePath)
        void loadRecentActivity(firstOpenedFilePath)
      }
    },
    [loadRecentActivity, openEditorView]
  )

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
        if (activeTab?.document.path === path) {
          updateTabDocument(activeTab.id, { path: result.data, title: basename(result.data) })
        }
        void refreshWorkspaceTree()
        return result.data
      }
      Toast.error(result.error.message)
      return null
    },
    [activeTab, refreshWorkspaceTree, updateTabDocument]
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

  return (
    <div
      className="app-shell"
      data-color-mode={resolvedAppearanceMode}
      data-appearance-mode={editorSettings.appearanceMode}
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
          workspaceAvailable={Boolean(workspaceRoot)}
          searchTruncated={titlebarSearchTruncated}
          searchFocusRequestId={searchFocusRequestId}
          explorerVisible={explorerVisible}
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
          onToggleExplorer={() => setExplorerVisible((current) => !current)}
          onCheckForUpdates={() => void checkForUpdates()}
          onExport={(format) => void handleExport(format)}
        />
        {activeView === 'editor' ? (
          <>
            <div className="editor-workspace" data-explorer-visible={explorerVisible}>
              {explorerVisible ? (
                <ResourceExplorer
                  workspaceRoot={workspaceRoot}
                  workspaceTree={workspaceTree}
                  selectedPath={document.path}
                  expandedPaths={expandedWorkspacePaths}
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
                <section ref={editorHostRef} className="editor-host" data-editor-mode={editorMode}>
                  {activeTab ? (
                    <Suspense fallback={<EditorLoadingFallback />}>
                      <MarkdownEditor
                        key={activeTab.id}
                        mode={editorMode}
                        dirty={document.dirty}
                        content={document.content}
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
                        onScrollTopChange={(scrollTop) => setTabScrollTop(activeTab.id, scrollTop)}
                        onOpenDocumentLink={openPathFromLink}
                        onLinkError={(message) => Toast.error(message)}
                      />
                    </Suspense>
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
              </div>
            </div>
          </>
        ) : activeView === 'recent' ? (
          <RecentWorkbench
            activity={recentActivity}
            recentFiles={recentFiles}
            selectedPath={selectedRecentPath}
            customCss={editorSettings.customPreviewCss}
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
            updaterStatus={updaterStatus}
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
      <Modal
        visible={!!exportProgress}
        title="正在导出"
        footer={null}
        closable={false}
        maskClosable={false}
        centered
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
        visible={updaterDialog === 'available' && updaterStatus?.state === 'available'}
        title={updaterStatus?.version ? `发现新版本 ${updaterStatus.version}` : '发现新版本'}
        okText="下载更新"
        cancelText="稍后"
        centered
        width={560}
        onOk={() => void downloadUpdate()}
        onCancel={() => setUpdaterDialog(null)}
      >
        {updaterStatus ? (
          <div className="updater-dialog-content">
            <div className="updater-dialog-meta">
              {updaterStatus.releaseName ? <span>{updaterStatus.releaseName}</span> : null}
              {updaterStatus.releaseDate ? (
                <span>发布于 {formatUpdateDate(updaterStatus.releaseDate)}</span>
              ) : null}
            </div>
            <Typography.Text type="tertiary">{updaterStatus.message}</Typography.Text>
            <div className="updater-release-notes" aria-label="更新日志">
              <div className="updater-release-notes-title">更新日志</div>
              <pre>{getUpdateNotes(updaterStatus)}</pre>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        visible={updaterDialog === 'downloaded' && updaterStatus?.state === 'downloaded'}
        title="更新已准备就绪"
        okText="重启安装"
        cancelText="稍后"
        centered
        width={520}
        onOk={() => void installUpdate()}
        onCancel={() => setUpdaterDialog(null)}
      >
        {updaterStatus ? (
          <div className="updater-dialog-content">
            <Typography.Text>
              {updaterStatus.version
                ? `版本 ${updaterStatus.version} 已下载，重启后会完成安装。`
                : '更新已下载，重启后会完成安装。'}
            </Typography.Text>
            <div className="updater-release-notes" aria-label="更新日志">
              <div className="updater-release-notes-title">更新日志</div>
              <pre>{getUpdateNotes(updaterStatus)}</pre>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        visible={updaterStatus?.state === 'downloading'}
        title="正在下载更新"
        footer={null}
        closable={false}
        maskClosable={false}
        centered
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
