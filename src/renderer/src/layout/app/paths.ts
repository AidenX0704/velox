/** Path, drag-and-drop and explorer-state helpers (pure, no React). */

const MAX_RESTORED_EXPLORER_PATHS = 128
const WORKSPACE_EXPLORER_STATE_VERSION = '2'

export function getDroppedFilePath(file: File): string {
  return (file as File & { path?: string }).path || window.api.app.getPathForFile(file)
}

export function hasExternalFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files')
}

export function isPathInsideWorkspace(filePath: string, workspacePath: string): boolean {
  const normalizedFilePath = filePath.replace(/\\/g, '/')
  const normalizedWorkspacePath = workspacePath.replace(/\\/g, '/').replace(/\/$/, '')

  return (
    normalizedFilePath === normalizedWorkspacePath ||
    normalizedFilePath.startsWith(`${normalizedWorkspacePath}/`)
  )
}

/**
 * Expanded folders are only restored when they still belong to the workspace and
 * the stored state version matches — an old layout should not resurrect paths.
 */
export function restoreWorkspaceExpandedPaths(workspacePath: string, paths: string[]): string[] {
  const migrationKey = `velox:workspace-explorer-state:${workspacePath}`

  try {
    if (window.localStorage.getItem(migrationKey) !== WORKSPACE_EXPLORER_STATE_VERSION) {
      window.localStorage.setItem(migrationKey, WORKSPACE_EXPLORER_STATE_VERSION)
      return []
    }
  } catch {
    return []
  }

  if (paths.length > MAX_RESTORED_EXPLORER_PATHS) {
    return []
  }

  return [...new Set(paths)].filter(
    (path) => path !== workspacePath && isPathInsideWorkspace(path, workspacePath)
  )
}
