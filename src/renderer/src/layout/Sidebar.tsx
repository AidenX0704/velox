import { useState } from 'react'
import { Toast, Typography } from '@douyinfe/semi-ui'
import {
  IconBellStroked,
  IconBranch,
  IconClock,
  IconExit,
  IconFile,
  IconFolderStroked,
  IconGit,
  IconHelpCircleStroked,
  IconRefresh,
  IconSave,
  IconSearchStroked,
  IconSettingStroked,
  IconUserCircleStroked
} from '@douyinfe/semi-icons'
import type {
  HistoryBranchRecord,
  HistoryEventType,
  HistoryTimelineEntry,
  RecentFileRecord,
  WorkspaceEntry
} from '../../../shared/types'
import { WorkspaceTree } from './WorkspaceTree'

type AppView = 'editor' | 'recent' | 'settings'
type SidebarPanelTab = 'workspace' | 'recent'
type RecentView = 'files' | 'history' | 'branches'
type ActivityPlaceholder = 'search' | null

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

function showComingSoon(feature: string): void {
  Toast.info(`${feature}功能正在规划中`)
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
  onOpenEditor: () => void
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
  onOpenEditor,
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
  const [activePlaceholder, setActivePlaceholder] = useState<ActivityPlaceholder>(null)
  const [profileCardVisible, setProfileCardVisible] = useState(false)
  const singleFileEntry: WorkspaceEntry | null =
    !workspaceRoot && selectedPath
      ? {
          path: selectedPath,
          name: basename(selectedPath),
          type: 'file'
        }
      : null
  const isWorkspaceActivityActive =
    activeView === 'editor' && panelTab === 'workspace' && activePlaceholder === null

  const closeProfileCard = (): void => {
    setProfileCardVisible(false)
  }

  const openSettingsFromProfile = (): void => {
    closeProfileCard()
    setActivePlaceholder(null)
    onOpenSettings()
  }

  const checkForUpdatesFromProfile = async (): Promise<void> => {
    closeProfileCard()
    const result = await window.api.updater.checkForUpdates()
    if (result.ok) {
      Toast.info(result.data.message)
    } else {
      Toast.error(result.error.message)
    }
  }

  const openHelp = (): void => {
    closeProfileCard()
    void window.api.shell.openExternal('https://velox.app')
  }

  const showComingSoonFromProfile = (feature: string): void => {
    closeProfileCard()
    showComingSoon(feature)
  }

  const renderProfileCard = (
    <div className="profile-card" role="menu" aria-label="用户快捷操作">
      <div className="profile-card-header">
        <div className="profile-card-avatar" aria-hidden="true">
          V
        </div>
        <div className="profile-card-user">
          <span className="profile-card-name">Velox 用户</span>
          <span className="profile-card-meta">本地工作区</span>
        </div>
      </div>
      <div className="profile-card-actions">
        <button
          className="profile-card-action"
          type="button"
          role="menuitem"
          onClick={() => showComingSoonFromProfile('个人中心')}
        >
          <IconUserCircleStroked />
          <span>个人中心</span>
        </button>
        <button
          className="profile-card-action"
          type="button"
          role="menuitem"
          onClick={openSettingsFromProfile}
        >
          <IconSettingStroked />
          <span>偏好设置</span>
        </button>
        <button
          className="profile-card-action"
          type="button"
          role="menuitem"
          onClick={() => showComingSoonFromProfile('通知')}
        >
          <IconBellStroked />
          <span>通知中心</span>
        </button>
        <button
          className="profile-card-action"
          type="button"
          role="menuitem"
          onClick={() => void checkForUpdatesFromProfile()}
        >
          <IconRefresh />
          <span>检查更新</span>
        </button>
        <button className="profile-card-action" type="button" role="menuitem" onClick={openHelp}>
          <IconHelpCircleStroked />
          <span>帮助与反馈</span>
        </button>
      </div>
      <div className="profile-card-footer">
        <button
          className="profile-card-action profile-card-action-danger"
          type="button"
          role="menuitem"
          onClick={() => showComingSoonFromProfile('账户')}
        >
          <IconExit />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  )

  return (
    <aside className="sidebar" data-visible={visible}>
      <nav className="activity-bar" aria-label="功能导航">
        <div className="activity-bar-top">
          <button
            className="activity-item"
            data-active={isWorkspaceActivityActive}
            type="button"
            title="文档"
            aria-label="文档"
            onClick={() => {
              setPanelTab('workspace')
              setActivePlaceholder(null)
              onOpenEditor()
            }}
          >
            <IconFile />
            <span className="activity-label">文档</span>
          </button>
          <button
            className="activity-item"
            data-active={activePlaceholder === 'search'}
            type="button"
            title="搜索"
            aria-label="搜索"
            onClick={() => {
              setActivePlaceholder('search')
              onOpenEditor()
            }}
          >
            <IconSearchStroked />
            <span className="activity-label">搜索</span>
          </button>
        </div>
        <div className="activity-bar-bottom">
          <button
            className="activity-item"
            data-active={activeView === 'settings'}
            type="button"
            title="设置"
            aria-label="设置"
            onClick={() => {
              setActivePlaceholder(null)
              onOpenSettings()
            }}
          >
            <IconSettingStroked />
            <span className="activity-label">设置</span>
          </button>
          <div className="activity-avatar-wrap">
            <button
              className="activity-avatar"
              type="button"
              title="用户"
              aria-label={profileCardVisible ? '关闭用户快捷操作' : '打开用户快捷操作'}
              aria-expanded={profileCardVisible}
              onClick={() => setProfileCardVisible((current) => !current)}
            >
              <span className="activity-avatar-initial">V</span>
            </button>
            {profileCardVisible ? renderProfileCard : null}
          </div>
        </div>
      </nav>
      {profileCardVisible ? (
        <button
          className="profile-card-backdrop"
          type="button"
          aria-label="关闭用户快捷操作"
          onClick={closeProfileCard}
        />
      ) : null}

      <div className="sidebar-pane">
        <header className="sidebar-pane-header">
          <Typography.Text className="sidebar-pane-title" strong>
            {panelTab === 'workspace' ? '资源管理器' : '最近文件'}
          </Typography.Text>
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
        aria-valuemin={220}
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
