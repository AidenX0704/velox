import { useState } from 'react'
import { Typography } from '@douyinfe/semi-ui'
import {
  IconBranch,
  IconClock,
  IconFile,
  IconFolderOpenStroked,
  IconFolderStroked,
  IconGit,
  IconHistory,
  IconPlusStroked,
  IconSave,
  IconSettingStroked
} from '@douyinfe/semi-icons'
import type {
  HistoryBranchRecord,
  HistoryEventType,
  HistoryTimelineEntry,
  RecentFileRecord,
  WorkspaceEntry
} from '../../../shared/types'
import { BrandLogo } from '../components/BrandLogo'
import { WorkspaceTree } from './WorkspaceTree'

type AppView = 'editor' | 'recent' | 'settings'
type SidebarPanelTab = 'workspace' | 'recent'
type RecentView = 'files' | 'history' | 'branches'

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime()
  const diff = Date.now() - timestamp

  if (!Number.isFinite(timestamp)) return ''
  if (diff < 60_000) return '刚刚'

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} 分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function getEventLabel(type: HistoryEventType): string {
  switch (type) {
    case 'open':
      return '打开'
    case 'save':
      return '保存'
    case 'snapshot':
      return '快照'
    case 'branch_create':
      return '分支'
    case 'branch_advance':
      return '推进'
    case 'restore':
      return '回溯'
  }
}

interface SidebarProps {
  activeView: AppView
  visible: boolean
  paneWidth: number
  workspaceRoot: string | null
  workspaceTree: WorkspaceEntry[]
  recentFiles: RecentFileRecord[]
  historyTimeline: HistoryTimelineEntry[]
  historyBranches: HistoryBranchRecord[]
  selectedPath?: string
  expandedPaths?: string[]
  onNew: () => void
  onOpenEditor: () => void
  onOpenRecent: () => void
  onOpenSettings: () => void
  onOpenWorkspace: () => void
  onOpenFile: (path: string) => void
  onSelectRecentFile: (path: string) => void
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void
  onResizeByKeyboard: (delta: number) => void
  onExpandedPathsChange?: (paths: string[]) => void
  onCreateWorkspaceEntry?: (
    parentPath: string,
    name: string,
    type: 'file' | 'directory'
  ) => Promise<string | null>
  onRenameWorkspaceEntry?: (path: string, newName: string) => Promise<string | null>
  onDeleteWorkspaceEntry?: (path: string) => Promise<boolean>
}

export function Sidebar({
  activeView,
  visible,
  paneWidth,
  workspaceRoot,
  workspaceTree,
  recentFiles,
  historyTimeline,
  historyBranches,
  selectedPath,
  expandedPaths,
  onNew,
  onOpenEditor,
  onOpenRecent,
  onOpenSettings,
  onOpenWorkspace,
  onOpenFile,
  onSelectRecentFile,
  onResizeStart,
  onResizeByKeyboard,
  onExpandedPathsChange,
  onCreateWorkspaceEntry,
  onRenameWorkspaceEntry,
  onDeleteWorkspaceEntry
}: SidebarProps): React.JSX.Element {
  const [panelTab, setPanelTab] = useState<SidebarPanelTab>('workspace')
  const [recentView, setRecentView] = useState<RecentView>('files')
  const singleFileEntry: WorkspaceEntry | null =
    !workspaceRoot && selectedPath
      ? {
          path: selectedPath,
          name: basename(selectedPath),
          type: 'file'
        }
      : null

  return (
    <aside className="sidebar" data-visible={visible}>
      <nav className="activity-bar" aria-label="功能导航">
        <div className="activity-bar-top">
          <button
            className="activity-brand"
            type="button"
            title="返回编辑器"
            aria-label="返回编辑器"
            onClick={onOpenEditor}
          >
            <BrandLogo className="activity-brand-logo" size={28} />
            <span className="activity-label">编辑</span>
          </button>
          <button
            className="activity-item"
            data-active={activeView === 'editor' && panelTab === 'workspace'}
            type="button"
            title="资源管理器"
            aria-label="资源管理器"
            onClick={() => {
              setPanelTab('workspace')
              onOpenEditor()
            }}
          >
            <IconFolderStroked />
            <span className="activity-label">资源</span>
          </button>
          <button
            className="activity-item"
            data-active={activeView === 'recent'}
            type="button"
            title="最近文件"
            aria-label="最近文件"
            onClick={() => {
              setPanelTab('recent')
              onOpenRecent()
            }}
          >
            <IconHistory />
            <span className="activity-label">最近</span>
          </button>
          <button
            className="activity-item"
            type="button"
            title="新建文档"
            aria-label="新建文档"
            onClick={onNew}
          >
            <IconPlusStroked />
            <span className="activity-label">新建</span>
          </button>
        </div>
        <div className="activity-bar-bottom">
          <button
            className="activity-item"
            data-active={activeView === 'settings'}
            type="button"
            title="设置"
            aria-label="设置"
            onClick={onOpenSettings}
          >
            <IconSettingStroked />
            <span className="activity-label">设置</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-pane">
        <header className="sidebar-pane-header">
          <Typography.Text className="sidebar-pane-title" strong>
            {panelTab === 'workspace' ? '资源管理器' : '最近文件'}
          </Typography.Text>
          {panelTab === 'workspace' ? (
            <button
              className="sidebar-pane-action"
              type="button"
              title="打开文件夹"
              aria-label="打开文件夹"
              onClick={onOpenWorkspace}
            >
              <IconFolderOpenStroked />
            </button>
          ) : null}
        </header>

        {panelTab === 'workspace' ? (
          <section className="sidebar-panel" role="tabpanel" aria-label="资源管理器">
            {workspaceRoot ? (
              <WorkspaceTree
                entries={workspaceTree}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onOpenFile={onOpenFile}
                onExpandedPathsChange={onExpandedPathsChange}
                onCreateWorkspaceEntry={onCreateWorkspaceEntry}
                onRenameWorkspaceEntry={onRenameWorkspaceEntry}
                onDeleteWorkspaceEntry={onDeleteWorkspaceEntry}
                workspaceRoot={workspaceRoot}
              />
            ) : singleFileEntry ? (
              <WorkspaceTree
                entries={[singleFileEntry]}
                selectedPath={selectedPath}
                onOpenFile={onOpenFile}
                workspaceRoot={singleFileEntry.path}
                workspaceRootType="file"
              />
            ) : (
              <div className="explorer-empty">
                <IconFolderStroked />
                <Typography.Text strong>未打开文件夹</Typography.Text>
                <Typography.Text type="tertiary">
                  选择一个工作区来浏览 Markdown 文件。
                </Typography.Text>
                <button className="explorer-empty-action" type="button" onClick={onOpenWorkspace}>
                  打开文件夹
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="sidebar-panel" role="tabpanel" aria-label="最近文件">
            <div className="recent-panel-header">
              {recentView === 'files' ? (
                <IconFile />
              ) : recentView === 'history' ? (
                <IconGit />
              ) : (
                <IconBranch />
              )}
              <Typography.Text className="recent-panel-title">
                {recentView === 'files'
                  ? '最近打开'
                  : recentView === 'history'
                    ? '历史时间线'
                    : '分支推进'}
              </Typography.Text>
            </div>
            <div className="recent-view-tabs" role="tablist" aria-label="最近视图">
              <button
                className="recent-view-tab"
                data-active={recentView === 'files'}
                type="button"
                onClick={() => setRecentView('files')}
              >
                最近
              </button>
              <button
                className="recent-view-tab"
                data-active={recentView === 'history'}
                type="button"
                onClick={() => setRecentView('history')}
              >
                历史
              </button>
              <button
                className="recent-view-tab"
                data-active={recentView === 'branches'}
                type="button"
                onClick={() => setRecentView('branches')}
              >
                分支
              </button>
            </div>
            {recentView === 'files' ? (
              <div className="recent-file-list">
                {recentFiles.map((file) => (
                  <button
                    key={file.path}
                    className="recent-file-item"
                    type="button"
                    title={file.path}
                    data-active={activeView === 'recent' && selectedPath === file.path}
                    onClick={() => onSelectRecentFile(file.path)}
                  >
                    <span className="recent-file-title">{file.title}</span>
                    <span className="recent-file-path">{file.path}</span>
                    <span className="recent-file-meta">
                      {formatRelativeTime(file.lastOpenedAt)}
                    </span>
                  </button>
                ))}
                {recentFiles.length === 0 ? (
                  <Typography.Text className="recent-file-empty" type="tertiary">
                    暂无最近文件
                  </Typography.Text>
                ) : null}
              </div>
            ) : null}
            {recentView === 'history' ? (
              <div className="history-timeline-list">
                {historyTimeline.map((entry) => (
                  <button
                    key={entry.id}
                    className="history-timeline-item"
                    type="button"
                    title={entry.documentPath}
                    onClick={() => {
                      if (entry.documentPath) {
                        onSelectRecentFile(entry.documentPath)
                      }
                    }}
                  >
                    <span className="history-timeline-node" data-type={entry.type}>
                      {entry.type === 'save' || entry.type === 'restore' ? (
                        <IconSave />
                      ) : (
                        <IconClock />
                      )}
                    </span>
                    <span className="history-timeline-copy">
                      <span className="history-timeline-title">{entry.title}</span>
                      <span className="history-timeline-path">
                        {entry.documentTitle ?? entry.documentPath ?? '未知文档'}
                      </span>
                      <span className="history-timeline-meta">
                        {getEventLabel(entry.type)}
                        {entry.branchName ? ` · ${entry.branchName}` : ''}
                        {' · '}
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </span>
                  </button>
                ))}
                {historyTimeline.length === 0 ? (
                  <Typography.Text className="recent-file-empty" type="tertiary">
                    保存文档后会生成历史节点
                  </Typography.Text>
                ) : null}
              </div>
            ) : null}
            {recentView === 'branches' ? (
              <div className="history-branch-list">
                {historyBranches.map((branch) => (
                  <button
                    key={branch.id}
                    className="history-branch-item"
                    type="button"
                    title={branch.documentPath}
                    data-active={activeView === 'recent' && selectedPath === branch.documentPath}
                    onClick={() => onSelectRecentFile(branch.documentPath)}
                  >
                    <span className="history-branch-icon">
                      <IconBranch />
                    </span>
                    <span className="history-branch-copy">
                      <span className="history-branch-title">
                        {branch.name}
                        {branch.headSnapshotId ? (
                          <span className="history-branch-head">#{branch.headSnapshotId}</span>
                        ) : null}
                      </span>
                      <span className="history-branch-path">{branch.documentTitle}</span>
                      <span className="history-branch-meta">
                        {branch.headSnapshotId ? '已推进' : '等待首个快照'} ·{' '}
                        {formatRelativeTime(branch.updatedAt)}
                      </span>
                    </span>
                  </button>
                ))}
                {historyBranches.length === 0 ? (
                  <Typography.Text className="recent-file-empty" type="tertiary">
                    保存文档后会创建 main 分支
                  </Typography.Text>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
      </div>
      <div
        className="sidebar-resizer"
        role="separator"
        aria-label="调整资源管理器宽度"
        aria-orientation="vertical"
        aria-valuemin={180}
        aria-valuemax={480}
        aria-valuenow={paneWidth}
        tabIndex={visible ? 0 : -1}
        onPointerDown={onResizeStart}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            onResizeByKeyboard(event.shiftKey ? -40 : -12)
          }

          if (event.key === 'ArrowRight') {
            event.preventDefault()
            onResizeByKeyboard(event.shiftKey ? 40 : 12)
          }
        }}
      />
    </aside>
  )
}
