import { useEffect, useMemo, useState, useRef } from 'react'
import { Button, Typography, Dropdown, Input } from '@douyinfe/semi-ui'
import {
  IconChevronRight,
  IconFile,
  IconFolderOpenStroked,
  IconFolderStroked
} from '@douyinfe/semi-icons'
import type { WorkspaceEntry } from '../../../shared/types'

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

type WorkspaceRootType = 'directory' | 'file'

interface WorkspaceTreeProps {
  entries: WorkspaceEntry[]
  selectedPath?: string
  expandedPaths?: string[]
  workspaceRoot: string
  workspaceRootType?: WorkspaceRootType
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

export function WorkspaceTree({
  entries,
  selectedPath,
  expandedPaths,
  workspaceRoot,
  workspaceRootType = 'directory',
  onOpenFile,
  onExpandedPathsChange,
  onCreateWorkspaceEntry,
  onRenameWorkspaceEntry,
  onDeleteWorkspaceEntry
}: WorkspaceTreeProps): React.JSX.Element {
  const treeKey = entries.map((entry) => entry.path).join('|')

  return (
    <WorkspaceTreeContent
      key={treeKey}
      entries={entries}
      selectedPath={selectedPath}
      expandedPaths={expandedPaths}
      workspaceRoot={workspaceRoot}
      workspaceRootType={workspaceRootType}
      onOpenFile={onOpenFile}
      onExpandedPathsChange={onExpandedPathsChange}
      onCreateWorkspaceEntry={onCreateWorkspaceEntry}
      onRenameWorkspaceEntry={onRenameWorkspaceEntry}
      onDeleteWorkspaceEntry={onDeleteWorkspaceEntry}
    />
  )
}

interface InlineInputState {
  type: 'create' | 'rename'
  parentPath?: string // for create
  targetPath?: string // for rename
  entryType?: 'file' | 'directory' // for create
  initialValue: string
}

function WorkspaceTreeContent({
  entries,
  selectedPath,
  expandedPaths,
  workspaceRoot,
  workspaceRootType = 'directory',
  onOpenFile,
  onExpandedPathsChange,
  onCreateWorkspaceEntry,
  onRenameWorkspaceEntry,
  onDeleteWorkspaceEntry
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

  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null)

  useEffect(() => {
    if (!selectedPath) {
      return
    }

    onExpandedPathsChange?.([...effectiveExpandedPaths])
  }, [effectiveExpandedPaths, onExpandedPathsChange, selectedPath])

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

  const handleCreateRequest = (parentPath: string, type: 'file' | 'directory'): void => {
    if (!onCreateWorkspaceEntry) {
      return
    }

    // Ensure parent is expanded
    setLocalExpandedPaths((current) => {
      const next = new Set(current)
      next.add(parentPath)
      onExpandedPathsChange?.([...new Set([...next, ...defaultExpandedPaths])])
      return next
    })

    setInlineInput({
      type: 'create',
      parentPath,
      entryType: type,
      initialValue: type === 'file' ? 'Untitled.md' : 'New Folder'
    })
  }

  const handleRenameRequest = (path: string, currentName: string): void => {
    setInlineInput({
      type: 'rename',
      targetPath: path,
      initialValue: currentName
    })
  }

  const handleDeleteRequest = async (path: string): Promise<void> => {
    if (onDeleteWorkspaceEntry) {
      await onDeleteWorkspaceEntry(path)
    }
  }

  const handleInlineInputComplete = async (value: string): Promise<void> => {
    if (!value.trim() || !inlineInput) {
      setInlineInput(null)
      return
    }

    try {
      if (
        inlineInput.type === 'create' &&
        onCreateWorkspaceEntry &&
        inlineInput.parentPath &&
        inlineInput.entryType
      ) {
        const newPath = await onCreateWorkspaceEntry(
          inlineInput.parentPath,
          value,
          inlineInput.entryType
        )
        if (newPath && inlineInput.entryType === 'file') {
          onOpenFile(newPath)
        }
      } else if (
        inlineInput.type === 'rename' &&
        onRenameWorkspaceEntry &&
        inlineInput.targetPath
      ) {
        await onRenameWorkspaceEntry(inlineInput.targetPath, value)
      }
    } finally {
      setInlineInput(null)
    }
  }

  if (workspaceRootType === 'file') {
    return (
      <div className="workspace-tree" role="tree">
        <button
          className="workspace-tree-single-file"
          type="button"
          title={workspaceRoot}
          role="treeitem"
          aria-selected
          data-selected={selectedPath === workspaceRoot || undefined}
          onClick={() => onOpenFile(workspaceRoot)}
        >
          <span className="workspace-tree-icon">
            <IconFile />
          </span>
          <span className="workspace-tree-label">{basename(workspaceRoot)}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="workspace-tree" role="tree">
      <div className="explorer-root-header">
        <IconFolderOpenStroked />
        <div className="explorer-root-copy">
          <Typography.Text className="explorer-root-name" ellipsis={{ showTooltip: true }}>
            {workspaceRoot ? basename(workspaceRoot) : '未打开工作区'}
          </Typography.Text>
        </div>
        {onCreateWorkspaceEntry ? (
          <div className="explorer-root-actions">
            <button
              className="explorer-action-button"
              type="button"
              title="新建文件"
              onClick={() => handleCreateRequest(workspaceRoot, 'file')}
            >
              <IconFile />
            </button>
            <button
              className="explorer-action-button"
              type="button"
              title="新建文件夹"
              onClick={() => handleCreateRequest(workspaceRoot, 'directory')}
            >
              <IconFolderStroked />
            </button>
          </div>
        ) : null}
      </div>

      {inlineInput?.type === 'create' && inlineInput.parentPath === workspaceRoot && (
        <InlineInputNode
          initialValue={inlineInput.initialValue}
          level={0}
          icon={inlineInput.entryType === 'directory' ? <IconFolderStroked /> : <IconFile />}
          onComplete={handleInlineInputComplete}
          onCancel={() => setInlineInput(null)}
        />
      )}

      {entries.length === 0 && !inlineInput ? (
        <Typography.Text className="workspace-tree-empty" type="tertiary">
          暂无工作区文件
        </Typography.Text>
      ) : (
        entries.map((entry) => (
          <WorkspaceTreeNode
            key={entry.path}
            entry={entry}
            selectedPath={selectedPath}
            expandedPaths={effectiveExpandedPaths}
            level={0}
            inlineInput={inlineInput}
            onOpenFile={onOpenFile}
            onToggleDirectory={toggleDirectory}
            onCreateRequest={handleCreateRequest}
            onRenameRequest={handleRenameRequest}
            onDeleteRequest={handleDeleteRequest}
            canCreate={!!onCreateWorkspaceEntry}
            canRename={!!onRenameWorkspaceEntry}
            canDelete={!!onDeleteWorkspaceEntry}
            onInlineInputComplete={handleInlineInputComplete}
            onInlineInputCancel={() => setInlineInput(null)}
          />
        ))
      )}
    </div>
  )
}

interface WorkspaceTreeNodeProps {
  entry: WorkspaceEntry
  selectedPath?: string
  expandedPaths: Set<string>
  level: number
  inlineInput: InlineInputState | null
  onOpenFile: (path: string) => void
  onToggleDirectory: (path: string) => void
  onCreateRequest: (parentPath: string, type: 'file' | 'directory') => void
  onRenameRequest: (path: string, currentName: string) => void
  onDeleteRequest: (path: string) => void
  canCreate: boolean
  canRename: boolean
  canDelete: boolean
  onInlineInputComplete: (value: string) => void
  onInlineInputCancel: () => void
}

function WorkspaceTreeNode({
  entry,
  selectedPath,
  expandedPaths,
  level,
  inlineInput,
  onOpenFile,
  onToggleDirectory,
  onCreateRequest,
  onRenameRequest,
  onDeleteRequest,
  canCreate,
  canRename,
  canDelete,
  onInlineInputComplete,
  onInlineInputCancel
}: WorkspaceTreeNodeProps): React.JSX.Element {
  const isDirectory = entry.type === 'directory'
  const isExpanded = isDirectory && expandedPaths.has(entry.path)
  const isMarkdown = /\.(md|markdown|mdown|mkd|txt)$/i.test(entry.name)
  const canOpen = entry.type === 'file' && isMarkdown
  const isSelected = canOpen && entry.path === selectedPath

  const isRenaming = inlineInput?.type === 'rename' && inlineInput.targetPath === entry.path

  if (isRenaming) {
    return (
      <InlineInputNode
        initialValue={inlineInput.initialValue}
        level={level}
        icon={isDirectory ? <IconFolderStroked /> : <IconFile />}
        onComplete={onInlineInputComplete}
        onCancel={onInlineInputCancel}
      />
    )
  }

  return (
    <div className="workspace-tree-item" role="none">
      <Dropdown
        trigger="contextMenu"
        render={
          <Dropdown.Menu>
            {isDirectory && (
              <>
                {canCreate ? (
                  <>
                    <Dropdown.Item onClick={() => onCreateRequest(entry.path, 'file')}>
                      新建文件
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => onCreateRequest(entry.path, 'directory')}>
                      新建文件夹
                    </Dropdown.Item>
                    <Dropdown.Divider />
                  </>
                ) : null}
              </>
            )}
            {canRename ? (
              <Dropdown.Item onClick={() => onRenameRequest(entry.path, entry.name)}>
                重命名
              </Dropdown.Item>
            ) : null}
            {canDelete ? (
              <Dropdown.Item type="danger" onClick={() => void onDeleteRequest(entry.path)}>
                删除
              </Dropdown.Item>
            ) : null}
            {canRename || canDelete ? <Dropdown.Divider /> : null}
            <Dropdown.Item onClick={() => void window.api.shell.showItemInFolder(entry.path)}>
              在访达中显示
            </Dropdown.Item>
          </Dropdown.Menu>
        }
      >
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
              {isDirectory ? (
                isExpanded ? (
                  <IconFolderOpenStroked />
                ) : (
                  <IconFolderStroked />
                )
              ) : (
                <IconFile />
              )}
            </span>
            <span className="workspace-tree-label" title={entry.path}>
              {entry.name}
            </span>
            {isDirectory && canCreate && (
              <span className="workspace-tree-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="workspace-tree-action-btn"
                  title="新建文件"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateRequest(entry.path, 'file')
                  }}
                >
                  <IconFile />
                </button>
                <button
                  className="workspace-tree-action-btn"
                  title="新建文件夹"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateRequest(entry.path, 'directory')
                  }}
                >
                  <IconFolderStroked />
                </button>
              </span>
            )}
          </span>
        </Button>
      </Dropdown>

      {isExpanded && (
        <div className="workspace-tree-children" role="group">
          {inlineInput?.type === 'create' && inlineInput.parentPath === entry.path && (
            <InlineInputNode
              initialValue={inlineInput.initialValue}
              level={level + 1}
              icon={inlineInput.entryType === 'directory' ? <IconFolderStroked /> : <IconFile />}
              onComplete={onInlineInputComplete}
              onCancel={onInlineInputCancel}
            />
          )}
          {entry.children?.map((child) => (
            <WorkspaceTreeNode
              key={child.path}
              entry={child}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              level={level + 1}
              inlineInput={inlineInput}
              onOpenFile={onOpenFile}
              onToggleDirectory={onToggleDirectory}
              onCreateRequest={onCreateRequest}
              onRenameRequest={onRenameRequest}
              onDeleteRequest={onDeleteRequest}
              canCreate={canCreate}
              canRename={canRename}
              canDelete={canDelete}
              onInlineInputComplete={onInlineInputComplete}
              onInlineInputCancel={onInlineInputCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function InlineInputNode({
  initialValue,
  level,
  icon,
  onComplete,
  onCancel
}: {
  initialValue: string
  level: number
  icon: React.ReactNode
  onComplete: (value: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      // Select text before extension
      const dotIndex = initialValue.lastIndexOf('.')
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex)
      } else {
        inputRef.current.select()
      }
    }
  }, [initialValue])

  return (
    <div className="workspace-tree-item" role="none">
      <div
        className="workspace-tree-node workspace-tree-node-inline-input"
        style={{ '--tree-level': level } as React.CSSProperties}
      >
        <span className="workspace-tree-row">
          <span className="workspace-tree-chevron" />
          <span className="workspace-tree-icon">{icon}</span>
          <Input
            ref={inputRef}
            value={value}
            onChange={setValue}
            size="small"
            onBlur={() => onComplete(value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onComplete(value)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }}
          />
        </span>
      </div>
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
