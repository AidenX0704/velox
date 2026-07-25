import { useCallback, useEffect, useRef, useState } from 'react'
import { Dropdown, Input } from '@douyinfe/semi-ui'
import {
  IconCaseSensitive,
  IconChevronDown,
  IconChevronUp,
  IconExport,
  IconFile,
  IconFolderOpenStroked,
  IconHistory,
  IconImage,
  IconImageStroked,
  IconPdf,
  IconPlusStroked,
  IconSaveStroked,
  IconSearchStroked,
  IconSettingStroked
} from '@douyinfe/semi-icons'
import type { ExportFormat } from '../../../shared/export'
import { Segment, type SegmentOption } from '../components/Segment'
import type { EditorMode } from '../modules/editor/model/types'
import { editorModeLabels } from '../modules/editor/model/types'

export type TitleBarSearchScope = 'document' | 'workspace'

export interface TitleBarSearchResult {
  id: string
  scope: TitleBarSearchScope
  index: number
  matchIndex: number
  path?: string
  relativePath?: string
  fileName?: string
  line: number
  column: number
  before: string
  match: string
  after: string
}

interface TitleBarProps {
  mode: EditorMode
  platform: string
  searchValue: string
  searchScope: TitleBarSearchScope
  searchCaseSensitive: boolean
  replaceValue: string
  replaceVisible: boolean
  searchMatchCount: number
  activeSearchOrdinal: number
  searchResults: TitleBarSearchResult[]
  searchLoading: boolean
  searchError?: string
  workspaceAvailable: boolean
  searchTruncated: boolean
  searchFocusRequestId: number
  explorerVisible: boolean
  onModeChange: (mode: EditorMode) => void
  onSearchChange: (value: string) => void
  onSearchScopeChange: (scope: TitleBarSearchScope) => void
  onSearchCaseSensitiveChange: (caseSensitive: boolean) => void
  onReplaceChange: (value: string) => void
  onReplaceVisibleChange: (visible: boolean) => void
  onSearchStep: (direction: 1 | -1) => void
  onSearchSelect: (result: TitleBarSearchResult) => void
  onReplaceCurrent: () => void
  onReplaceAll: () => void
  onNew: () => void
  onOpen: () => void
  onOpenWorkspace: () => void
  onOpenRecent: () => void
  onSave: () => void
  onOpenSettings: () => void
  onOpenAbout: () => void
  onToggleExplorer: () => void
  onCheckForUpdates: () => void
  onExport: (format: ExportFormat) => void
}

const modeOptions: Array<SegmentOption<EditorMode>> = [
  { value: 'source', label: editorModeLabels.source },
  {
    value: 'preview-edit',
    label: editorModeLabels['preview-edit']
  }
]

const searchScopeLabels: Record<TitleBarSearchScope, string> = {
  document: '当前文档',
  workspace: '工作区'
}

function WindowsCaptionIcon({
  type
}: {
  type: 'minimize' | 'maximize' | 'restore' | 'close'
}): React.JSX.Element {
  return <span className="windows-caption-icon" data-icon={type} aria-hidden="true" />
}

export function TitleBar({
  mode,
  platform,
  searchValue,
  searchScope,
  searchCaseSensitive,
  replaceValue,
  replaceVisible,
  searchMatchCount,
  activeSearchOrdinal,
  searchResults,
  searchLoading,
  searchError,
  workspaceAvailable,
  searchTruncated,
  searchFocusRequestId,
  explorerVisible,
  onModeChange,
  onSearchChange,
  onSearchScopeChange,
  onSearchCaseSensitiveChange,
  onReplaceChange,
  onReplaceVisibleChange,
  onSearchStep,
  onSearchSelect,
  onReplaceCurrent,
  onReplaceAll,
  onNew,
  onOpen,
  onOpenWorkspace,
  onOpenRecent,
  onSave,
  onOpenSettings,
  onOpenAbout,
  onToggleExplorer,
  onCheckForUpdates,
  onExport
}: TitleBarProps): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const hasSearchValue = searchValue.trim().length > 0
  const searchResultLabel = searchValue
    ? searchMatchCount > 0
      ? `${activeSearchOrdinal}/${searchMatchCount}`
      : '0/0'
    : undefined

  const focusSearchInput = useCallback((): void => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
  }, [])

  useEffect(() => {
    if (platform !== 'win32') {
      return
    }

    let disposed = false

    window.api.window.getIsMaximized().then((result) => {
      if (!disposed && result.ok) {
        setIsMaximized(result.data)
      }
    })

    const unsubscribe = window.api.window.onMaximizedChange(setIsMaximized)

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [platform])

  useEffect(() => {
    if (searchFocusRequestId === 0) {
      return
    }

    focusSearchInput()
  }, [focusSearchInput, searchFocusRequestId])

  const handleToggleMaximize = async (): Promise<void> => {
    const result = await window.api.window.toggleMaximize()

    if (result.ok) {
      const state = await window.api.window.getIsMaximized()

      if (state.ok) {
        setIsMaximized(state.data)
      }
    }
  }

  const closeSearchPanelIfFocusLeft = (): void => {
    window.setTimeout(() => {
      const activeElement = document.activeElement
      if (activeElement && searchWrapRef.current?.contains(activeElement)) {
        return
      }

      setSearchPanelOpen(false)
    }, 0)
  }

  const showSearchPanel = searchPanelOpen && hasSearchValue
  const hiddenResultCount = Math.max(searchMatchCount - searchResults.length, 0)
  const canReplace = hasSearchValue && searchMatchCount > 0
  const searchPlaceholder = searchScope === 'workspace' ? '搜索工作区' : '搜索当前文档'
  const searchStatusText = searchLoading
    ? '正在搜索...'
    : searchMatchCount > 0
      ? `找到 ${searchMatchCount} 处匹配`
      : searchError
        ? searchError
        : searchScope === 'workspace' && !workspaceAvailable
          ? '工作区不可用'
          : '没有找到匹配'

  return (
    <header className="titlebar" data-platform={platform}>
      <nav className="titlebar-menu" aria-label="应用菜单">
        <Dropdown
          position="bottomLeft"
          render={
            <Dropdown.Menu>
              <Dropdown.Item icon={<IconPlusStroked />} onClick={onNew}>
                新建文档
              </Dropdown.Item>
              <Dropdown.Item icon={<IconFile />} onClick={onOpen}>
                打开文件
              </Dropdown.Item>
              <Dropdown.Item icon={<IconFolderOpenStroked />} onClick={onOpenWorkspace}>
                打开文件夹
              </Dropdown.Item>
              <Dropdown.Item icon={<IconHistory />} onClick={onOpenRecent}>
                最近活动
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item icon={<IconSaveStroked />} onClick={onSave}>
                保存
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item icon={<IconPdf />} onClick={() => onExport('pdf')}>
                导出 PDF
              </Dropdown.Item>
              <Dropdown.Item icon={<IconImageStroked />} onClick={() => onExport('png')}>
                导出 PNG
              </Dropdown.Item>
              <Dropdown.Item icon={<IconImage />} onClick={() => onExport('jpeg')}>
                导出 JPEG
              </Dropdown.Item>
              <Dropdown.Item icon={<IconExport />} onClick={() => onExport('docx')}>
                导出 Word
              </Dropdown.Item>
              <Dropdown.Item icon={<IconExport />} onClick={() => onExport('html')}>
                导出 HTML
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <button className="titlebar-menu-button" type="button">
            文件
          </button>
        </Dropdown>
        <Dropdown
          position="bottomLeft"
          render={
            <Dropdown.Menu>
              <Dropdown.Item icon={<IconSearchStroked />} onClick={focusSearchInput}>
                查找
              </Dropdown.Item>
              <Dropdown.Item onClick={() => onSearchStep(-1)}>上一个匹配</Dropdown.Item>
              <Dropdown.Item onClick={() => onSearchStep(1)}>下一个匹配</Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item icon={<IconSettingStroked />} onClick={onOpenSettings}>
                偏好设置
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <button className="titlebar-menu-button" type="button">
            编辑
          </button>
        </Dropdown>
        <Dropdown
          position="bottomLeft"
          render={
            <Dropdown.Menu>
              <Dropdown.Item onClick={onToggleExplorer}>
                {explorerVisible ? '隐藏资源管理器' : '显示资源管理器'}
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item onClick={() => void window.api.window.minimize()}>
                最小化
              </Dropdown.Item>
              <Dropdown.Item onClick={() => void handleToggleMaximize()}>
                {isMaximized ? '还原窗口' : '最大化'}
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <button className="titlebar-menu-button" type="button">
            窗口
          </button>
        </Dropdown>
        <Dropdown
          position="bottomLeft"
          render={
            <Dropdown.Menu>
              <Dropdown.Item onClick={onCheckForUpdates}>检查更新</Dropdown.Item>
              <Dropdown.Item icon={<IconSettingStroked />} onClick={onOpenAbout}>
                关于 Velox
              </Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <button className="titlebar-menu-button" type="button">
            帮我
          </button>
        </Dropdown>
      </nav>

      <div
        ref={searchWrapRef}
        className="titlebar-search"
        role="search"
        onBlurCapture={closeSearchPanelIfFocusLeft}
        onFocusCapture={() => {
          if (hasSearchValue) {
            setSearchPanelOpen(true)
          }
        }}
      >
        <Input
          ref={searchInputRef}
          prefix={<IconSearchStroked />}
          suffix={
            searchResultLabel ? (
              <span className="titlebar-search-count">{searchResultLabel}</span>
            ) : null
          }
          value={searchValue}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          onChange={(value) => {
            onSearchChange(value)
            setSearchPanelOpen(value.trim().length > 0)
          }}
          onKeyDown={(event) => {
            event.stopPropagation()

            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && searchMatchCount > 0) {
              event.preventDefault()
              onSearchStep(event.key === 'ArrowDown' ? 1 : -1)
              setSearchPanelOpen(true)
              return
            }

            if (event.key === 'Enter') {
              event.preventDefault()
              if (searchPanelOpen && searchResults.length > 0) {
                const activeIndex = activeSearchOrdinal > 0 ? activeSearchOrdinal - 1 : 0
                const activeResult =
                  searchResults.find((result) => result.index === activeIndex) ?? searchResults[0]
                if (activeResult) {
                  onSearchSelect(activeResult)
                } else {
                  onSearchStep(event.shiftKey ? -1 : 1)
                }
                setSearchPanelOpen(false)
                return
              }

              onSearchStep(event.shiftKey ? -1 : 1)
              setSearchPanelOpen(true)
              return
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              if (searchPanelOpen) {
                setSearchPanelOpen(false)
              } else {
                onSearchChange('')
              }
            }
          }}
        />
        {showSearchPanel ? (
          <div className="titlebar-search-popover" role="listbox" aria-label="搜索结果">
            <div className="titlebar-search-popover-header">
              <span>{searchStatusText}</span>
              {hiddenResultCount > 0 || searchTruncated ? (
                <span>显示前 {searchResults.length} 项</span>
              ) : null}
            </div>
            <div className="titlebar-search-tools">
              <div className="titlebar-search-scope" role="tablist" aria-label="搜索范围">
                {(['document', 'workspace'] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    role="tab"
                    aria-selected={searchScope === scope}
                    data-active={searchScope === scope}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSearchScopeChange(scope)}
                  >
                    {searchScopeLabels[scope]}
                  </button>
                ))}
              </div>
              <button
                className="titlebar-search-tool-button"
                type="button"
                aria-pressed={searchCaseSensitive}
                data-active={searchCaseSensitive}
                title="区分大小写"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onSearchCaseSensitiveChange(!searchCaseSensitive)}
              >
                <IconCaseSensitive />
                <span>Aa</span>
              </button>
              <button
                className="titlebar-search-tool-button"
                type="button"
                aria-expanded={replaceVisible}
                data-active={replaceVisible}
                title="替换"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onReplaceVisibleChange(!replaceVisible)}
              >
                {replaceVisible ? <IconChevronUp /> : <IconChevronDown />}
                <span>替换</span>
              </button>
            </div>
            {replaceVisible ? (
              <div className="titlebar-replace-row">
                <Input
                  value={replaceValue}
                  placeholder="替换为"
                  aria-label="替换为"
                  onChange={onReplaceChange}
                  onKeyDown={(event) => {
                    event.stopPropagation()

                    if (event.key === 'Enter') {
                      event.preventDefault()
                      if (event.metaKey || event.ctrlKey) {
                        onReplaceAll()
                      } else {
                        onReplaceCurrent()
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!canReplace}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onReplaceCurrent}
                >
                  替换
                </button>
                <button
                  type="button"
                  disabled={!canReplace}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onReplaceAll}
                >
                  全部替换
                </button>
              </div>
            ) : null}
            {searchResults.length > 0 ? (
              <div className="titlebar-search-results">
                {searchResults.map((result, resultPosition) => {
                  const active = result.index + 1 === activeSearchOrdinal
                  const previousResult = searchResults[resultPosition - 1]
                  const showGroupHeader =
                    result.scope === 'workspace' &&
                    result.relativePath &&
                    result.relativePath !== previousResult?.relativePath

                  return (
                    <div key={result.id} className="titlebar-search-result-group">
                      {showGroupHeader ? (
                        <div className="titlebar-search-result-file">{result.relativePath}</div>
                      ) : null}
                      <button
                        className="titlebar-search-result"
                        data-active={active}
                        type="button"
                        role="option"
                        aria-selected={active}
                        title={`${result.relativePath ?? result.fileName ?? '当前文档'} · 第 ${
                          result.line
                        } 行，第 ${result.column} 列`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onSearchSelect(result)
                          setSearchPanelOpen(false)
                        }}
                      >
                        <span className="titlebar-search-result-position">
                          {result.line}:{result.column}
                        </span>
                        <span className="titlebar-search-result-snippet">
                          <span>{result.before}</span>
                          <mark>{result.match}</mark>
                          <span>{result.after}</span>
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="titlebar-search-empty">
                {searchLoading
                  ? '正在搜索...'
                  : searchError ||
                    (searchScope === 'workspace' && !workspaceAvailable
                      ? '先打开一个工作区'
                      : '没有可定位的结果')}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="titlebar-right">
        <Segment
          className="mode-segment"
          value={mode}
          options={modeOptions}
          ariaLabel="编辑模式切换"
          size="small"
          onChange={onModeChange}
        />
        <div className="window-controls" aria-label="窗口控制">
          <button
            type="button"
            aria-label="最小化"
            onClick={() => void window.api.window.minimize()}
          >
            <WindowsCaptionIcon type="minimize" />
          </button>
          <button
            type="button"
            aria-label={isMaximized ? '还原窗口' : '最大化'}
            onClick={() => void handleToggleMaximize()}
          >
            <WindowsCaptionIcon type={isMaximized ? 'restore' : 'maximize'} />
          </button>
          <button
            className="window-control-close"
            type="button"
            aria-label="关闭"
            onClick={() => void window.api.window.close()}
          >
            <WindowsCaptionIcon type="close" />
          </button>
        </div>
      </div>
    </header>
  )
}
