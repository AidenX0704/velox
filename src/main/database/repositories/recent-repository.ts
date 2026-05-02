import type Database from 'better-sqlite3'
import { basename } from 'node:path'

export interface RecentFileRecord {
  path: string
  title: string
  lastOpenedAt: string
  pinned: boolean
  existsCache: boolean
}

export interface RecentWorkspaceRecord {
  path: string
  name: string
  lastOpenedAt: string
  pinned: boolean
}

interface RecentFileRow {
  path: string
  title: string
  last_opened_at: string
  pinned: number
  exists_cache: number
}

interface RecentWorkspaceRow {
  path: string
  name: string
  last_opened_at: string
  pinned: number
}

export class RecentRepository {
  constructor(private readonly database: Database.Database) {}

  upsertFile(filePath: string): void {
    this.database
      .prepare(
        `insert into recent_files (path, title, last_opened_at, exists_cache)
         values (@path, @title, @lastOpenedAt, 1)
         on conflict(path) do update set
           title = excluded.title,
           last_opened_at = excluded.last_opened_at,
           exists_cache = 1`
      )
      .run({
        path: filePath,
        title: basename(filePath),
        lastOpenedAt: new Date().toISOString()
      })
  }

  upsertWorkspace(workspacePath: string): void {
    this.database
      .prepare(
        `insert into recent_workspaces (path, name, last_opened_at)
         values (@path, @name, @lastOpenedAt)
         on conflict(path) do update set
           name = excluded.name,
           last_opened_at = excluded.last_opened_at`
      )
      .run({
        path: workspacePath,
        name: basename(workspacePath),
        lastOpenedAt: new Date().toISOString()
      })
  }

  listFiles(limit = 20): RecentFileRecord[] {
    const rows = this.database
      .prepare(
        `select path, title, last_opened_at, pinned, exists_cache
         from recent_files
         order by pinned desc, last_opened_at desc
         limit ?`
      )
      .all(limit) as RecentFileRow[]

    return rows.map((row) => ({
      path: row.path,
      title: row.title,
      lastOpenedAt: row.last_opened_at,
      pinned: row.pinned === 1,
      existsCache: row.exists_cache === 1
    }))
  }

  listWorkspaces(limit = 20): RecentWorkspaceRecord[] {
    const rows = this.database
      .prepare(
        `select path, name, last_opened_at, pinned
         from recent_workspaces
         order by pinned desc, last_opened_at desc
         limit ?`
      )
      .all(limit) as RecentWorkspaceRow[]

    return rows.map((row) => ({
      path: row.path,
      name: row.name,
      lastOpenedAt: row.last_opened_at,
      pinned: row.pinned === 1
    }))
  }

  clear(): void {
    this.database.prepare('delete from recent_files where pinned = 0').run()
    this.database.prepare('delete from recent_workspaces where pinned = 0').run()
  }
}
