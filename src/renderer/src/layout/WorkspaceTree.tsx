import { useEffect, useState, useRef } from 'react'
import { Typography, Dropdown, Input } from '@douyinfe/semi-ui'
import {
  IconBriefStroked,
  IconChevronRight,
  IconDeleteStroked,
  IconEditStroked,
  IconExternalOpenStroked,
  IconFile,
  IconFolderOpenStroked,
  IconFolderStroked,
  IconImageStroked,
  IconMoreStroked,
  IconPlusStroked,
  IconShrink,
  IconTreeTriangleRight
} from '@douyinfe/semi-icons'
import type { WorkspaceEntry } from '../../../shared/types'
import { getWorkspaceResourceKind } from './workspaceResource'

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

function WorkspaceEntryIcon({
  type,
  name,
  expanded = false
}: {
  type: WorkspaceEntry['type']
  name?: string
  expanded?: boolean
}): React.JSX.Element {
  const resourceKind = type === 'directory' ? 'directory' : getWorkspaceResourceKind(name ?? '')

  return (
    <span
      className="workspace-tree-icon"
      data-entry-kind={resourceKind}
      data-expanded={type === 'directory' ? expanded : undefined}
    >
      {type === 'directory' ? (
        expanded ? (
          <IconFolderOpenStroked />
        ) : (
          <IconFolderStroked />
        )
      ) : resourceKind === 'image' ? (
        <IconImageStroked />
      ) : (
        <IconBriefStroked />
      )}
    </span>
  )
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
  return (
    <WorkspaceTreeContent
      key={`${workspaceRootType}:${workspaceRoot}`}
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
  const [localExpandedPaths, setLocalExpandedPaths] = useState<Set<string>>(
    () => new Set(expandedPaths ?? [])
  )
  const localExpandedPathsRef = useRef(localExpandedPaths)

  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null)

  useEffect(() => {
    if (expandedPaths !== undefined) {
      const next = new Set(expandedPaths)

      if (arePathSetsEqual(localExpandedPathsRef.current, next)) {
        return
      }

      localExpandedPathsRef.current = next
      setLocalExpandedPaths(next)
    }
  }, [expandedPaths])

  const commitExpandedPaths = (next: Set<string>): void => {
    localExpandedPathsRef.current = next
    setLocalExpandedPaths(next)
    onExpandedPathsChange?.([...next])
  }

  const toggleDirectory = (path: string): void => {
    const next = new Set(localExpandedPathsRef.current)

    if (next.has(path)) {
      next.delete(path)
    } else {
      next.add(path)
    }

    commitExpandedPaths(next)
  }

  const collapseAllDirectories = (): void => {
    commitExpandedPaths(new Set())
  }

  const handleCreateRequest = (parentPath: string, type: 'file' | 'directory'): void => {
    if (!onCreateWorkspaceEntry) {
      return
    }

    // Ensure parent is expanded
    if (parentPath !== workspaceRoot) {
      const next = new Set(localExpandedPathsRef.current)
      next.add(parentPath)
      commitExpandedPaths(next)
    }

    setInlineInput({
      type: 'create',
      parentPath,
      entryType: type,
      initialValue: type === 'file' ? 'undefined.md' : 'New Folder'
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

  const workspaceMenu = (
    <Dropdown.Menu>
      {onCreateWorkspaceEntry ? (
        <>
          <Dropdown.Item
            icon={<IconFile />}
            onClick={() => handleCreateRequest(workspaceRoot, 'file')}
          >
            新建文件
          </Dropdown.Item>
          <Dropdown.Item
            icon={<IconFolderStroked />}
            onClick={() => handleCreateRequest(workspaceRoot, 'directory')}
          >
            新建文件夹
          </Dropdown.Item>
        </>
      ) : null}
      {localExpandedPaths.size > 0 ? (
        <Dropdown.Item icon={<IconTreeTriangleRight />} onClick={collapseAllDirectories}>
          全部折叠
        </Dropdown.Item>
      ) : null}
      {onCreateWorkspaceEntry || localExpandedPaths.size > 0 ? <Dropdown.Divider /> : null}
      <Dropdown.Item
        icon={<IconExternalOpenStroked />}
        onClick={() => void window.api.shell.showItemInFolder(workspaceRoot)}
      >
        在访达中显示
      </Dropdown.Item>
    </Dropdown.Menu>
  )

  const workspaceTreeToolbar = (
    <div className="workspace-tree-toolbar">
      <div className="workspace-tree-toolbar-title">
        <span className="workspace-tree-toolbar-icon" aria-hidden="true">
          <IconFolderOpenStroked />
        </span>
        <span>资源管理器</span>
        <span className="workspace-tree-toolbar-count">{entries.length}</span>
      </div>
      {workspaceRootType === 'directory' ? (
        <div className="workspace-tree-toolbar-actions">
          {onCreateWorkspaceEntry ? (
            <>
              <button
                className="workspace-tree-toolbar-button"
                type="button"
                aria-label="新建文件"
                title="新建文件"
                onClick={() => handleCreateRequest(workspaceRoot, 'file')}
              >
                <IconPlusStroked />
              </button>
              <button
                className="workspace-tree-toolbar-button"
                type="button"
                aria-label="新建文件夹"
                title="新建文件夹"
                onClick={() => handleCreateRequest(workspaceRoot, 'directory')}
              >
                <IconFolderStroked />
              </button>
            </>
          ) : null}
          {localExpandedPaths.size > 0 ? (
            <button
              className="workspace-tree-toolbar-button"
              type="button"
              aria-label="全部折叠"
              title="全部折叠"
              onClick={collapseAllDirectories}
            >
              <IconShrink />
            </button>
          ) : null}
          <Dropdown trigger="click" position="bottomRight" render={workspaceMenu}>
            <button
              className="workspace-tree-toolbar-button"
              type="button"
              aria-label="资源管理器更多操作"
              title="更多操作"
            >
              <IconMoreStroked />
            </button>
          </Dropdown>
        </div>
      ) : null}
    </div>
  )

  if (workspaceRootType === 'file') {
    return (
      <div className="workspace-tree" role="tree">
        {workspaceTreeToolbar}
        <button
          className="workspace-tree-single-file"
          type="button"
          title={workspaceRoot}
          role="treeitem"
          aria-selected
          data-selected={selectedPath === workspaceRoot || undefined}
          onClick={() => onOpenFile(workspaceRoot)}
        >
          <WorkspaceEntryIcon type="file" name={basename(workspaceRoot)} />
          <span className="workspace-tree-label">{basename(workspaceRoot)}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="workspace-tree" role="tree">
      {workspaceTreeToolbar}
      <Dropdown trigger="contextMenu" render={workspaceMenu}>
        <div className="explorer-root-header">
          <IconFolderOpenStroked className="explorer-root-folder-icon" />
          <div className="explorer-root-copy">
            <Typography.Text
              className="explorer-root-name"
              ellipsis={{ showTooltip: true }}
              title={workspaceRoot}
            >
              {basename(workspaceRoot)}
            </Typography.Text>
            <span className="explorer-root-meta">工作区</span>
          </div>
        </div>
      </Dropdown>

      {inlineInput?.type === 'create' && inlineInput.parentPath === workspaceRoot && (
        <InlineInputNode
          initialValue={inlineInput.initialValue}
          level={0}
          entryType={inlineInput.entryType ?? 'file'}
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
            expandedPaths={localExpandedPaths}
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

function arePathSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false
  }

  for (const path of left) {
    if (!right.has(path)) {
      return false
    }
  }

  return true
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
  const resourceKind = isDirectory ? null : getWorkspaceResourceKind(entry.name)
  const canOpen = entry.type === 'file' && resourceKind !== 'unsupported'
  const isSelected = canOpen && entry.path === selectedPath
  const isDisabled = entry.type === 'file' && !canOpen

  const isRenaming = inlineInput?.type === 'rename' && inlineInput.targetPath === entry.path

  const activateNode = (): void => {
    if (isDisabled) {
      return
    }

    if (isDirectory) {
      onToggleDirectory(entry.path)
      return
    }

    onOpenFile(entry.path)
  }

  if (isRenaming) {
    return (
      <InlineInputNode
        initialValue={inlineInput.initialValue}
        level={level}
        entryType={entry.type}
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
                    <Dropdown.Item
                      icon={<IconFile />}
                      onClick={() => onCreateRequest(entry.path, 'file')}
                    >
                      新建文件
                    </Dropdown.Item>
                    <Dropdown.Item
                      icon={<IconFolderStroked />}
                      onClick={() => onCreateRequest(entry.path, 'directory')}
                    >
                      新建文件夹
                    </Dropdown.Item>
                    <Dropdown.Divider />
                  </>
                ) : null}
              </>
            )}
            {canRename ? (
              <Dropdown.Item
                icon={<IconEditStroked />}
                onClick={() => onRenameRequest(entry.path, entry.name)}
              >
                重命名
              </Dropdown.Item>
            ) : null}
            {canDelete ? (
              <Dropdown.Item
                icon={<IconDeleteStroked />}
                type="danger"
                onClick={() => void onDeleteRequest(entry.path)}
              >
                删除
              </Dropdown.Item>
            ) : null}
            {canRename || canDelete ? <Dropdown.Divider /> : null}
            <Dropdown.Item
              icon={<IconFolderOpenStroked />}
              onClick={() => void window.api.shell.showItemInFolder(entry.path)}
            >
              在访达中显示
            </Dropdown.Item>
          </Dropdown.Menu>
        }
      >
        <div
          className="workspace-tree-node"
          style={{ '--tree-level': level } as React.CSSProperties}
          role="treeitem"
          tabIndex={isDisabled ? -1 : 0}
          aria-expanded={isDirectory ? isExpanded : undefined}
          aria-selected={isSelected || undefined}
          aria-disabled={isDisabled || undefined}
          data-selected={isSelected || undefined}
          onClick={activateNode}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || isDisabled) {
              return
            }

            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              activateNode()
              return
            }

            if (event.key === 'ArrowRight' && isDirectory && !isExpanded) {
              event.preventDefault()
              onToggleDirectory(entry.path)
              return
            }

            if (event.key === 'ArrowLeft' && isDirectory && isExpanded) {
              event.preventDefault()
              onToggleDirectory(entry.path)
            }
          }}
        >
          <span className="workspace-tree-row">
            <span className="workspace-tree-chevron" data-expanded={isExpanded}>
              {isDirectory ? <IconChevronRight /> : null}
            </span>
            <WorkspaceEntryIcon type={entry.type} name={entry.name} expanded={isExpanded} />
            <span className="workspace-tree-label" title={entry.path}>
              {entry.name}
            </span>
          </span>
        </div>
      </Dropdown>

      {isExpanded && (
        <div
          className="workspace-tree-children"
          role="group"
          style={{ '--tree-parent-level': level } as React.CSSProperties}
        >
          {inlineInput?.type === 'create' && inlineInput.parentPath === entry.path && (
            <InlineInputNode
              initialValue={inlineInput.initialValue}
              level={level + 1}
              entryType={inlineInput.entryType ?? 'file'}
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
  entryType,
  onComplete,
  onCancel
}: {
  initialValue: string
  level: number
  entryType: WorkspaceEntry['type']
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
          <WorkspaceEntryIcon type={entryType} name={initialValue} />
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
