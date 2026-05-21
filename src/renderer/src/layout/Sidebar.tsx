import { useState } from 'react'
import { Typography } from '@douyinfe/semi-ui'
import {
  IconFile,
  IconFolderOpenStroked,
  IconFolderStroked,
  IconHistory,
  IconPlusStroked,
  IconSettingStroked
} from '@douyinfe/semi-icons'
import type { RecentFileRecord, WorkspaceEntry } from '../../../shared/types'
import { BrandLogo } from '../components/BrandLogo'
import { WorkspaceTree } from './WorkspaceTree'

type AppView = 'editor' | 'settings'
type SidebarPanelTab = 'workspace' | 'recent'

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

interface SidebarProps {
  activeView: AppView
  visible: boolean
  workspaceRoot: string | null
  workspaceTree: WorkspaceEntry[]
  recentFiles: RecentFileRecord[]
  selectedPath?: string
  expandedPaths?: string[]
  onNew: () => void
  onOpenEditor: () => void
  onOpenSettings: () => void
  onOpenWorkspace: () => void
  onOpenFile: (path: string) => void
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
  workspaceRoot,
  workspaceTree,
  recentFiles,
  selectedPath,
  expandedPaths,
  onNew,
  onOpenEditor,
  onOpenSettings,
  onOpenWorkspace,
  onOpenFile,
  onExpandedPathsChange,
  onCreateWorkspaceEntry,
  onRenameWorkspaceEntry,
  onDeleteWorkspaceEntry
}: SidebarProps): React.JSX.Element {
  const [panelTab, setPanelTab] = useState<SidebarPanelTab>('workspace')
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
          </button>
          <button
            className="activity-item"
            data-active={activeView === 'editor' && panelTab === 'recent'}
            type="button"
            title="最近文件"
            aria-label="最近文件"
            onClick={() => {
              setPanelTab('recent')
              onOpenEditor()
            }}
          >
            <IconHistory />
          </button>
          <button
            className="activity-item"
            type="button"
            title="新建文档"
            aria-label="新建文档"
            onClick={onNew}
          >
            <IconPlusStroked />
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
              <IconFile />
              <Typography.Text className="recent-panel-title">最近打开</Typography.Text>
            </div>
            <div className="recent-file-list">
              {recentFiles.map((file) => (
                <button
                  key={file.path}
                  className="recent-file-item"
                  type="button"
                  title={file.path}
                  onClick={() => onOpenFile(file.path)}
                >
                  <span className="recent-file-title">{file.title}</span>
                  <span className="recent-file-path">{file.path}</span>
                </button>
              ))}
              {recentFiles.length === 0 ? (
                <Typography.Text className="recent-file-empty" type="tertiary">
                  暂无最近文件
                </Typography.Text>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}
