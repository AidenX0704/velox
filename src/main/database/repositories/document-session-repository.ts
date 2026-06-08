import type Database from 'better-sqlite3'
import {
  normalizeEditorMode,
  type EditorMode,
  type LegacyEditorMode
} from '../../../shared/preferences'

export interface DocumentSessionRecord {
  path: string
  mode: EditorMode
  cursorLine: number
  cursorColumn: number
  scrollTop: number
  updatedAt: string
}

export interface UpdateDocumentSessionInput {
  path: string
  mode?: EditorMode
  cursorLine?: number
  cursorColumn?: number
  scrollTop?: number
}

interface DocumentSessionRow {
  path: string
  mode: LegacyEditorMode
  cursor_line: number
  cursor_column: number
  scroll_top: number
  updated_at: string
}

export class DocumentSessionRepository {
  constructor(private readonly database: Database.Database) {}

  get(path: string): DocumentSessionRecord | undefined {
    const row = this.database
      .prepare(
        `select path, mode, cursor_line, cursor_column, scroll_top, updated_at
         from document_sessions
         where path = ?`
      )
      .get(path) as DocumentSessionRow | undefined

    return row ? this.toRecord(row) : undefined
  }

  getLast(): DocumentSessionRecord | undefined {
    const row = this.database
      .prepare(
        `select path, mode, cursor_line, cursor_column, scroll_top, updated_at
         from document_sessions
         order by updated_at desc
         limit 1`
      )
      .get() as DocumentSessionRow | undefined

    return row ? this.toRecord(row) : undefined
  }

  update(input: UpdateDocumentSessionInput): DocumentSessionRecord {
    const current = this.get(input.path)
    const next: DocumentSessionRecord = {
      path: input.path,
      mode: input.mode ?? current?.mode ?? 'preview-edit',
      cursorLine: input.cursorLine ?? current?.cursorLine ?? 1,
      cursorColumn: input.cursorColumn ?? current?.cursorColumn ?? 1,
      scrollTop: input.scrollTop ?? current?.scrollTop ?? 0,
      updatedAt: new Date().toISOString()
    }

    this.database
      .prepare(
        `insert into document_sessions (
           path, mode, cursor_line, cursor_column, scroll_top, updated_at
         ) values (
           @path, @mode, @cursorLine, @cursorColumn, @scrollTop, @updatedAt
         ) on conflict(path) do update set
           mode = excluded.mode,
           cursor_line = excluded.cursor_line,
           cursor_column = excluded.cursor_column,
           scroll_top = excluded.scroll_top,
           updated_at = excluded.updated_at`
      )
      .run(next)

    return next
  }

  private toRecord(row: DocumentSessionRow): DocumentSessionRecord {
    return {
      path: row.path,
      mode: normalizeEditorMode(row.mode),
      cursorLine: row.cursor_line,
      cursorColumn: row.cursor_column,
      scrollTop: row.scroll_top,
      updatedAt: row.updated_at
    }
  }
}
