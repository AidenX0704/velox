import { useState } from 'react'
import { Button, Divider, Typography } from '@douyinfe/semi-ui'
import {
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconHistory,
  IconPlus,
  IconSetting
} from '@douyinfe/semi-icons'
import type { RecentFileRecord, WorkspaceEntry } from '../../../shared/types'
import { BrandLogo } from '../components/BrandLogo'
import { WorkspaceTree } from './WorkspaceTree'

type AppView = 'editor' | 'settings'
type SidebarPanelTab = 'workspace' | 'recent'

interface SidebarProps {
  activeView: AppView
  visible: boolean
  workspaceRoot: string | null
  workspaceTree: WorkspaceEntry[]
  recentFiles: RecentFileRecord[]
  selectedPath?: string
  expandedPaths?: string[]
  onNew: () => void
  onClose: () => void
  onOpenEditor: () => void
  onOpenSettings: () => void
  onOpenWorkspace: () => void
  onOpenFile: (path: string) => void
  onExpandedPathsChange?: (paths: string[]) => void
}

const navigationItems = [
  { label: '编辑器', icon: <IconFile />, action: 'editor' },
  { label: '设置', icon: <IconSetting />, action: 'settings' }
]

const sidebarPanelTabs: Array<{
  key: SidebarPanelTab
  label: string
  icon: React.ReactNode
}> = [
  { key: 'workspace', label: '工作区', icon: <IconFolder /> },
  { key: 'recent', label: '最近文件', icon: <IconHistory /> }
]

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
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
  onExpandedPathsChange
}: SidebarProps): React.JSX.Element {
  const [panelTab, setPanelTab] = useState<SidebarPanelTab>('workspace')

  return (
    <aside className="sidebar" data-visible={visible}>
      <div className="sidebar-brand">
        <BrandLogo className="sidebar-brand-logo" size={40} />
        <div className="sidebar-brand-text">
          <Typography.Text strong>Velox</Typography.Text>
          <Typography.Text type="tertiary">Markdown Editor</Typography.Text>
        </div>
      </div>
      <div className="sidebar-cta">
        <Button block className="sidebar-new-button" icon={<IconPlus />} onClick={onNew}>
          新建文档
        </Button>
      </div>
      <nav className="sidebar-navigation" aria-label="主导航">
        {navigationItems.map((item) => (
          <button
            key={item.label}
            className="sidebar-nav-item"
            data-active={item.action === activeView}
            type="button"
            onClick={item.action === 'settings' ? onOpenSettings : onOpenEditor}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <Divider margin="12px" />

      <div className="sidebar-panel-tabs" role="tablist" aria-label="左侧面板内容">
        {sidebarPanelTabs.map((tab) => (
          <button
            key={tab.key}
            className="sidebar-panel-tab"
            data-active={panelTab === tab.key}
            type="button"
            role="tab"
            aria-selected={panelTab === tab.key}
            onClick={() => setPanelTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {panelTab === 'workspace' ? (
        <section className="sidebar-panel" role="tabpanel">
          <div className="sidebar-workspace-actions">
            <Button block icon={<IconFolderOpen />} theme="borderless" onClick={onOpenWorkspace}>
              打开文件夹
            </Button>
          </div>
          <div className="sidebar-section">
            <Typography.Text strong>当前工作区</Typography.Text>
            <Typography.Text
              className="workspace-root"
              type="tertiary"
              ellipsis={{ showTooltip: true }}
            >
              {workspaceRoot ? basename(workspaceRoot) : '未打开文件夹'}
            </Typography.Text>
          </div>
          <WorkspaceTree
            entries={workspaceTree}
            selectedPath={selectedPath}
            expandedPaths={expandedPaths}
            onOpenFile={onOpenFile}
            onExpandedPathsChange={onExpandedPathsChange}
          />
        </section>
      ) : (
        <section className="sidebar-panel" role="tabpanel">
          <div className="sidebar-section">
            <Typography.Text strong>最近文件</Typography.Text>
            <Typography.Text type="tertiary">快速回到最近打开的文档</Typography.Text>
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
    </aside>
  )
}
