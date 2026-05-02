import type Database from 'better-sqlite3'

export interface WorkspaceStateRecord {
  workspacePath: string
  expandedPaths: string[]
  selectedPath?: string
  sidebarVisible: boolean
  updatedAt: string
}

export interface UpdateWorkspaceStateInput {
  workspacePath: string
  expandedPaths?: string[]
  selectedPath?: string
  sidebarVisible?: boolean
}

interface WorkspaceStateRow {
  workspace_path: string
  expanded_paths: string
  selected_path?: string
  sidebar_visible: number
  updated_at: string
}

export class WorkspaceStateRepository {
  constructor(private readonly database: Database.Database) {}

  get(workspacePath: string): WorkspaceStateRecord | undefined {
    const row = this.database
      .prepare(
        `select workspace_path, expanded_paths, selected_path, sidebar_visible, updated_at
         from workspace_state
         where workspace_path = ?`
      )
      .get(workspacePath) as WorkspaceStateRow | undefined

    return row ? this.toRecord(row) : undefined
  }

  update(input: UpdateWorkspaceStateInput): WorkspaceStateRecord {
    const current = this.get(input.workspacePath)
    const next: WorkspaceStateRecord = {
      workspacePath: input.workspacePath,
      expandedPaths: input.expandedPaths ?? current?.expandedPaths ?? [],
      selectedPath: input.selectedPath ?? current?.selectedPath,
      sidebarVisible: input.sidebarVisible ?? current?.sidebarVisible ?? true,
      updatedAt: new Date().toISOString()
    }

    this.database
      .prepare(
        `insert into workspace_state (
           workspace_path, expanded_paths, selected_path, sidebar_visible, updated_at
         ) values (
           @workspacePath, @expandedPaths, @selectedPath, @sidebarVisible, @updatedAt
         ) on conflict(workspace_path) do update set
           expanded_paths = excluded.expanded_paths,
           selected_path = excluded.selected_path,
           sidebar_visible = excluded.sidebar_visible,
           updated_at = excluded.updated_at`
      )
      .run({
        workspacePath: next.workspacePath,
        expandedPaths: JSON.stringify(next.expandedPaths),
        selectedPath: next.selectedPath,
        sidebarVisible: next.sidebarVisible ? 1 : 0,
        updatedAt: next.updatedAt
      })

    return next
  }

  private toRecord(row: WorkspaceStateRow): WorkspaceStateRecord {
    return {
      workspacePath: row.workspace_path,
      expandedPaths: JSON.parse(row.expanded_paths) as string[],
      selectedPath: row.selected_path,
      sidebarVisible: row.sidebar_visible === 1,
      updatedAt: row.updated_at
    }
  }
}
