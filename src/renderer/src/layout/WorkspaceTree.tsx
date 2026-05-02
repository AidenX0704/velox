import { useEffect, useMemo, useState } from 'react'
import { Button, Typography } from '@douyinfe/semi-ui'
import { IconChevronRight, IconFile, IconFolder, IconFolderOpen } from '@douyinfe/semi-icons'
import type { WorkspaceEntry } from '../../../shared/types'

interface WorkspaceTreeProps {
  entries: WorkspaceEntry[]
  selectedPath?: string
  expandedPaths?: string[]
  onOpenFile: (path: string) => void
  onExpandedPathsChange?: (paths: string[]) => void
}

export function WorkspaceTree({
  entries,
  selectedPath,
  expandedPaths,
  onOpenFile,
  onExpandedPathsChange
}: WorkspaceTreeProps): React.JSX.Element {
  const treeKey = entries.map((entry) => entry.path).join('|')

  return (
    <WorkspaceTreeContent
      key={treeKey}
      entries={entries}
      selectedPath={selectedPath}
      expandedPaths={expandedPaths}
      onOpenFile={onOpenFile}
      onExpandedPathsChange={onExpandedPathsChange}
    />
  )
}

function WorkspaceTreeContent({
  entries,
  selectedPath,
  expandedPaths,
  onOpenFile,
  onExpandedPathsChange
}: WorkspaceTreeProps): React.JSX.Element {
  const defaultExpandedPaths = useMemo(
    () => collectDefaultExpandedPaths(entries, selectedPath),
    [entries, selectedPath]
  )
  const [localExpandedPaths, setLocalExpandedPaths] = useState<Set<string>>(
    () => new Set(expandedPaths?.length ? expandedPaths : [...defaultExpandedPaths])
  )
  const effectiveExpandedPaths = useMemo(
    () => new Set([...localExpandedPaths, ...defaultExpandedPaths]),
    [defaultExpandedPaths, localExpandedPaths]
  )

  useEffect(() => {
    if (!selectedPath) {
      return
    }

    onExpandedPathsChange?.([...effectiveExpandedPaths])
  }, [effectiveExpandedPaths, onExpandedPathsChange, selectedPath])

  if (entries.length === 0) {
    return (
      <Typography.Text className="workspace-tree-empty" type="tertiary">
        暂无工作区文件
      </Typography.Text>
    )
  }

  const toggleDirectory = (path: string): void => {
    setLocalExpandedPaths((current) => {
      const next = new Set(current)

      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }

      onExpandedPathsChange?.([...new Set([...next, ...defaultExpandedPaths])])

      return next
    })
  }

  return (
    <div className="workspace-tree" role="tree">
      {entries.map((entry) => (
        <WorkspaceTreeNode
          key={entry.path}
          entry={entry}
          selectedPath={selectedPath}
          expandedPaths={effectiveExpandedPaths}
          level={0}
          onOpenFile={onOpenFile}
          onToggleDirectory={toggleDirectory}
        />
      ))}
    </div>
  )
}

function WorkspaceTreeNode({
  entry,
  selectedPath,
  expandedPaths,
  level,
  onOpenFile,
  onToggleDirectory
}: {
  entry: WorkspaceEntry
  selectedPath?: string
  expandedPaths: Set<string>
  level: number
  onOpenFile: (path: string) => void
  onToggleDirectory: (path: string) => void
}): React.JSX.Element {
  const isDirectory = entry.type === 'directory'
  const isExpanded = isDirectory && expandedPaths.has(entry.path)
  const isMarkdown = /\.(md|markdown|mdown|mkd|txt)$/i.test(entry.name)
  const canOpen = entry.type === 'file' && isMarkdown
  const isSelected = canOpen && entry.path === selectedPath

  return (
    <div className="workspace-tree-item" role="none">
      <Button
        className="workspace-tree-node"
        theme="borderless"
        type="tertiary"
        disabled={entry.type === 'file' && !canOpen}
        style={{ '--tree-level': level } as React.CSSProperties}
        role="treeitem"
        aria-expanded={isDirectory ? isExpanded : undefined}
        aria-selected={isSelected || undefined}
        data-selected={isSelected || undefined}
        onClick={() => {
          if (isDirectory) {
            onToggleDirectory(entry.path)
            return
          }

          if (canOpen) {
            onOpenFile(entry.path)
          }
        }}
      >
        <span className="workspace-tree-row">
          <span className="workspace-tree-chevron" data-expanded={isExpanded}>
            {isDirectory ? <IconChevronRight /> : null}
          </span>
          <span className="workspace-tree-icon">
            {isDirectory ? isExpanded ? <IconFolderOpen /> : <IconFolder /> : <IconFile />}
          </span>
          <span className="workspace-tree-label" title={entry.path}>
            {entry.name}
          </span>
        </span>
      </Button>
      {isExpanded && entry.children && entry.children.length > 0 ? (
        <div className="workspace-tree-children" role="group">
          {entry.children.map((child) => (
            <WorkspaceTreeNode
              key={child.path}
              entry={child}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              level={level + 1}
              onOpenFile={onOpenFile}
              onToggleDirectory={onToggleDirectory}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function collectDefaultExpandedPaths(
  entries: WorkspaceEntry[],
  selectedPath?: string
): Set<string> {
  const expandedPaths = new Set<string>()

  for (const entry of entries) {
    if (entry.type === 'directory') {
      expandedPaths.add(entry.path)

      if (selectedPath && isDescendantPath(selectedPath, entry.path)) {
        expandedPaths.add(entry.path)
      }

      for (const childPath of collectDefaultExpandedPaths(entry.children ?? [], selectedPath)) {
        expandedPaths.add(childPath)
      }
    }
  }

  return expandedPaths
}

function isDescendantPath(path: string, parentPath: string): boolean {
  return path.startsWith(`${parentPath}/`) || path.startsWith(`${parentPath}\\`)
}
