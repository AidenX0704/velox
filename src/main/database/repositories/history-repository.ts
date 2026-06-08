import type Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { basename } from 'node:path'

export type HistoryEventType =
  | 'open'
  | 'save'
  | 'snapshot'
  | 'branch_create'
  | 'branch_advance'
  | 'restore'

export type HistorySnapshotSource = 'save' | 'autosave' | 'manual' | 'restore' | 'import'

export interface HistoryTimelineEntry {
  id: number
  documentId?: number
  documentPath?: string
  documentTitle?: string
  branchId?: number
  branchName?: string
  snapshotId?: number
  type: HistoryEventType
  title: string
  details: Record<string, unknown>
  createdAt: string
}

export interface HistoryBranchRecord {
  id: number
  documentId: number
  documentPath: string
  documentTitle: string
  name: string
  headSnapshotId?: number
  forkedFromSnapshotId?: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface HistorySnapshotRecord {
  id: number
  documentId: number
  documentPath: string
  documentTitle: string
  branchId: number
  branchName: string
  parentSnapshotId?: number
  blobHash: string
  byteSize: number
  message?: string
  source: HistorySnapshotSource
  createdAt: string
}

export interface HistorySnapshotContentRecord extends HistorySnapshotRecord {
  content: string
}

interface DocumentRow {
  id: number
  path: string
  title: string
  active_branch_id: number | null
  current_snapshot_id: number | null
  updated_at: string
}

interface BranchRow {
  id: number
  document_id: number
  document_path: string
  document_title: string
  name: string
  head_snapshot_id: number | null
  forked_from_snapshot_id: number | null
  archived: number
  created_at: string
  updated_at: string
}

interface SnapshotRow {
  id: number
  document_id: number
  document_path: string
  document_title: string
  branch_id: number
  branch_name: string
  parent_snapshot_id: number | null
  blob_hash: string
  byte_size: number
  message: string | null
  source: HistorySnapshotSource
  created_at: string
}

interface EventRow {
  id: number
  document_id: number | null
  document_path: string | null
  document_title: string | null
  branch_id: number | null
  branch_name: string | null
  snapshot_id: number | null
  type: HistoryEventType
  title: string
  details_json: string
  created_at: string
}

export interface RecordSnapshotInput {
  path: string
  content: string
  source: HistorySnapshotSource
  message?: string
}

export class HistoryRepository {
  constructor(private readonly database: Database.Database) {}

  recordOpen(path: string): void {
    const now = new Date().toISOString()
    const document = this.ensureDocument(path, now)
    const branch = this.ensureDefaultBranch(document.id, now)

    this.insertEvent({
      documentId: document.id,
      branchId: branch.id,
      type: 'open',
      title: `打开 ${document.title}`,
      details: { path },
      createdAt: now
    })
  }

  recordSnapshot(input: RecordSnapshotInput): HistorySnapshotRecord {
    return this.database.transaction((snapshotInput: RecordSnapshotInput) => {
      const now = new Date().toISOString()
      const document = this.ensureDocument(snapshotInput.path, now)
      const branch = this.ensureDefaultBranch(document.id, now)
      const blobHash = createContentHash(snapshotInput.content)
      const byteSize = Buffer.byteLength(snapshotInput.content, 'utf8')

      this.database
        .prepare(
          `insert into document_blobs (hash, content, byte_size, created_at)
           values (@hash, @content, @byteSize, @createdAt)
           on conflict(hash) do nothing`
        )
        .run({
          hash: blobHash,
          content: snapshotInput.content,
          byteSize,
          createdAt: now
        })

      const currentHead = this.getBranchHead(branch.id)
      const existingHead =
        currentHead && currentHead.blobHash === blobHash ? currentHead : undefined

      if (existingHead) {
        if (snapshotInput.source === 'import') {
          return existingHead
        }

        this.insertEvent({
          documentId: document.id,
          branchId: branch.id,
          snapshotId: existingHead.id,
          type: getEventTypeForSnapshotSource(snapshotInput.source),
          title: snapshotInput.message ?? `保存 ${document.title}`,
          details: {
            path: snapshotInput.path,
            byteSize,
            unchanged: true,
            source: snapshotInput.source
          },
          createdAt: now
        })

        return existingHead
      }

      const result = this.database
        .prepare(
          `insert into document_snapshots (
             document_id, branch_id, parent_snapshot_id, blob_hash, message, source, created_at
           ) values (
             @documentId, @branchId, @parentSnapshotId, @blobHash, @message, @source, @createdAt
           )`
        )
        .run({
          documentId: document.id,
          branchId: branch.id,
          parentSnapshotId: currentHead?.id ?? null,
          blobHash,
          message: snapshotInput.message ?? null,
          source: snapshotInput.source,
          createdAt: now
        })

      const snapshotId = Number(result.lastInsertRowid)

      this.database
        .prepare(
          `update document_branches
           set head_snapshot_id = @snapshotId,
               updated_at = @updatedAt
           where id = @branchId`
        )
        .run({ snapshotId, updatedAt: now, branchId: branch.id })

      this.database
        .prepare(
          `update documents
           set current_snapshot_id = @snapshotId,
               active_branch_id = @branchId,
               title = @title,
               updated_at = @updatedAt
           where id = @documentId`
        )
        .run({
          snapshotId,
          branchId: branch.id,
          title: basename(snapshotInput.path),
          updatedAt: now,
          documentId: document.id
        })

      this.insertEvent({
        documentId: document.id,
        branchId: branch.id,
        snapshotId,
        type: getEventTypeForSnapshotSource(snapshotInput.source),
        title: snapshotInput.message ?? `保存 ${document.title}`,
        details: {
          path: snapshotInput.path,
          byteSize,
          source: snapshotInput.source,
          parentSnapshotId: currentHead?.id
        },
        createdAt: now
      })

      return this.getSnapshot(snapshotId)!
    })(input)
  }

  listTimeline(limit = 50, path?: string): HistoryTimelineEntry[] {
    const rows = (
      path
        ? this.database
            .prepare(
              `select e.id,
                      e.document_id,
                      d.path as document_path,
                      d.title as document_title,
                      e.branch_id,
                      b.name as branch_name,
                      e.snapshot_id,
                      e.type,
                      e.title,
                      e.details_json,
                      e.created_at
               from document_events e
               left join documents d on d.id = e.document_id
               left join document_branches b on b.id = e.branch_id
               where d.path = ?
               order by e.created_at desc, e.id desc
               limit ?`
            )
            .all(path, limit)
        : this.database
            .prepare(
              `select e.id,
                      e.document_id,
                      d.path as document_path,
                      d.title as document_title,
                      e.branch_id,
                      b.name as branch_name,
                      e.snapshot_id,
                      e.type,
                      e.title,
                      e.details_json,
                      e.created_at
               from document_events e
               left join documents d on d.id = e.document_id
               left join document_branches b on b.id = e.branch_id
               order by e.created_at desc, e.id desc
               limit ?`
            )
            .all(limit)
    ) as EventRow[]

    return rows.map((row) => ({
      id: row.id,
      ...(row.document_id ? { documentId: row.document_id } : {}),
      ...(row.document_path ? { documentPath: row.document_path } : {}),
      ...(row.document_title ? { documentTitle: row.document_title } : {}),
      ...(row.branch_id ? { branchId: row.branch_id } : {}),
      ...(row.branch_name ? { branchName: row.branch_name } : {}),
      ...(row.snapshot_id ? { snapshotId: row.snapshot_id } : {}),
      type: row.type,
      title: row.title,
      details: parseDetails(row.details_json),
      createdAt: row.created_at
    }))
  }

  listBranches(limit = 50, path?: string): HistoryBranchRecord[] {
    const rows = (
      path
        ? this.database
            .prepare(
              `select b.id,
                      b.document_id,
                      d.path as document_path,
                      d.title as document_title,
                      b.name,
                      b.head_snapshot_id,
                      b.forked_from_snapshot_id,
                      b.archived,
                      b.created_at,
                      b.updated_at
               from document_branches b
               join documents d on d.id = b.document_id
               where d.path = ?
               order by b.archived asc, b.updated_at desc
               limit ?`
            )
            .all(path, limit)
        : this.database
            .prepare(
              `select b.id,
                      b.document_id,
                      d.path as document_path,
                      d.title as document_title,
                      b.name,
                      b.head_snapshot_id,
                      b.forked_from_snapshot_id,
                      b.archived,
                      b.created_at,
                      b.updated_at
               from document_branches b
               join documents d on d.id = b.document_id
               order by b.archived asc, b.updated_at desc
               limit ?`
            )
            .all(limit)
    ) as BranchRow[]

    return rows.map(toBranchRecord)
  }

  getHeadSnapshot(path: string): HistorySnapshotContentRecord | undefined {
    const row = this.database
      .prepare(
        `select s.id,
                s.document_id,
                d.path as document_path,
                d.title as document_title,
                s.branch_id,
                b.name as branch_name,
                s.parent_snapshot_id,
                s.blob_hash,
                blob.byte_size,
                blob.content,
                s.message,
                s.source,
                s.created_at
         from documents d
         join document_branches b on b.id = d.active_branch_id
         join document_snapshots s on s.id = b.head_snapshot_id
         join document_blobs blob on blob.hash = s.blob_hash
         where d.path = ?`
      )
      .get(path) as (SnapshotRow & { content: string }) | undefined

    return row
      ? {
          ...toSnapshotRecord(row),
          content: row.content
        }
      : undefined
  }

  private ensureDocument(path: string, now: string): DocumentRow {
    this.database
      .prepare(
        `insert into documents (path, title, updated_at)
         values (@path, @title, @updatedAt)
         on conflict(path) do update set
           title = excluded.title,
           updated_at = excluded.updated_at`
      )
      .run({
        path,
        title: basename(path),
        updatedAt: now
      })

    return this.database
      .prepare(
        `select id, path, title, active_branch_id, current_snapshot_id, updated_at
         from documents
         where path = ?`
      )
      .get(path) as DocumentRow
  }

  private ensureDefaultBranch(documentId: number, now: string): { id: number; name: string } {
    const existing = this.database
      .prepare(
        `select id, name
         from document_branches
         where document_id = ? and name = 'main'`
      )
      .get(documentId) as { id: number; name: string } | undefined

    if (existing) {
      return existing
    }

    const result = this.database
      .prepare(
        `insert into document_branches (document_id, name, created_at, updated_at)
         values (?, 'main', ?, ?)`
      )
      .run(documentId, now, now)

    const branchId = Number(result.lastInsertRowid)

    this.database
      .prepare(
        `update documents
         set active_branch_id = coalesce(active_branch_id, ?)
         where id = ?`
      )
      .run(branchId, documentId)

    this.insertEvent({
      documentId,
      branchId,
      type: 'branch_create',
      title: '创建 main 分支',
      details: { branch: 'main' },
      createdAt: now
    })

    return { id: branchId, name: 'main' }
  }

  private getBranchHead(branchId: number): HistorySnapshotRecord | undefined {
    const row = this.database
      .prepare(
        `select s.id,
                s.document_id,
                d.path as document_path,
                d.title as document_title,
                s.branch_id,
                b.name as branch_name,
                s.parent_snapshot_id,
                s.blob_hash,
                blob.byte_size,
                s.message,
                s.source,
                s.created_at
         from document_branches b
         join document_snapshots s on s.id = b.head_snapshot_id
         join documents d on d.id = s.document_id
         join document_blobs blob on blob.hash = s.blob_hash
         where b.id = ?`
      )
      .get(branchId) as SnapshotRow | undefined

    return row ? toSnapshotRecord(row) : undefined
  }

  private getSnapshot(snapshotId: number): HistorySnapshotRecord | undefined {
    const row = this.database
      .prepare(
        `select s.id,
                s.document_id,
                d.path as document_path,
                d.title as document_title,
                s.branch_id,
                b.name as branch_name,
                s.parent_snapshot_id,
                s.blob_hash,
                blob.byte_size,
                s.message,
                s.source,
                s.created_at
         from document_snapshots s
         join documents d on d.id = s.document_id
         join document_branches b on b.id = s.branch_id
         join document_blobs blob on blob.hash = s.blob_hash
         where s.id = ?`
      )
      .get(snapshotId) as SnapshotRow | undefined

    return row ? toSnapshotRecord(row) : undefined
  }

  private insertEvent(input: {
    documentId?: number
    branchId?: number
    snapshotId?: number
    type: HistoryEventType
    title: string
    details?: Record<string, unknown>
    createdAt: string
  }): void {
    this.database
      .prepare(
        `insert into document_events (
           document_id, branch_id, snapshot_id, type, title, details_json, created_at
         ) values (
           @documentId, @branchId, @snapshotId, @type, @title, @detailsJson, @createdAt
         )`
      )
      .run({
        documentId: input.documentId ?? null,
        branchId: input.branchId ?? null,
        snapshotId: input.snapshotId ?? null,
        type: input.type,
        title: input.title,
        detailsJson: JSON.stringify(input.details ?? {}),
        createdAt: input.createdAt
      })
  }
}

function getEventTypeForSnapshotSource(source: HistorySnapshotSource): HistoryEventType {
  if (source === 'save') return 'save'
  if (source === 'restore') return 'restore'
  return 'snapshot'
}

function createContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function parseDetails(detailsJson: string): Record<string, unknown> {
  try {
    const value = JSON.parse(detailsJson) as unknown
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function toBranchRecord(row: BranchRow): HistoryBranchRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    documentPath: row.document_path,
    documentTitle: row.document_title,
    name: row.name,
    ...(row.head_snapshot_id ? { headSnapshotId: row.head_snapshot_id } : {}),
    ...(row.forked_from_snapshot_id ? { forkedFromSnapshotId: row.forked_from_snapshot_id } : {}),
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toSnapshotRecord(row: SnapshotRow): HistorySnapshotRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    documentPath: row.document_path,
    documentTitle: row.document_title,
    branchId: row.branch_id,
    branchName: row.branch_name,
    ...(row.parent_snapshot_id ? { parentSnapshotId: row.parent_snapshot_id } : {}),
    blobHash: row.blob_hash,
    byteSize: row.byte_size,
    ...(row.message ? { message: row.message } : {}),
    source: row.source,
    createdAt: row.created_at
  }
}
