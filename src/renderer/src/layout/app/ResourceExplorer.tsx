import { memo } from 'react'
import { IconFolderStroked } from '@douyinfe/semi-icons'
import type { WorkspaceEntry } from '../../../../shared/types'
import { Typography } from '../../ui'
import { WorkspaceTree } from '../WorkspaceTree'
import { MAX_EXPLORER_WIDTH, MIN_EXPLORER_WIDTH, basename } from './format'

interface ResourceExplorerProps {
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
  width: number
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void
  onResizeKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
}

/**
 * Sidebar shell around the workspace tree, including the drag handle. Memoised
 * because the editor re-renders on every keystroke and the tree does not.
 */
export const ResourceExplorer = memo(function ResourceExplorer({
  workspaceRoot,
  workspaceTree,
  selectedPath,
  expandedPaths,
  onOpenWorkspace,
  onOpenFile,
  onExpandedPathsChange,
  onCreateWorkspaceEntry,
  onRenameWorkspaceEntry,
  onDeleteWorkspaceEntry,
  width,
  onResizeStart,
  onResizeKeyDown
}: ResourceExplorerProps): React.JSX.Element {
  const singleFileEntry: WorkspaceEntry | null =
    !workspaceRoot && selectedPath
      ? {
          path: selectedPath,
          name: basename(selectedPath),
          type: 'file'
        }
      : null

  return (
    <aside
      className="resource-explorer"
      aria-label="资源管理器"
      style={{ width, flexBasis: width }}
    >
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
            打开一个本地文件夹后可浏览 Markdown 文档和图片资源。
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
      <div
        className="resource-explorer-resizer"
        role="separator"
        aria-label="调整资源管理器宽度"
        aria-orientation="vertical"
        aria-valuemin={MIN_EXPLORER_WIDTH}
        aria-valuemax={MAX_EXPLORER_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onResizeStart}
        onKeyDown={onResizeKeyDown}
      />
    </aside>
  )
})
