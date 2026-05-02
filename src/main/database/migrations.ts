import type Database from 'better-sqlite3'

const currentVersion = 1

export function runMigrations(database: Database.Database): void {
  const version = database.pragma('user_version', { simple: true }) as number

  if (version < 1) {
    database.exec(`
      create table if not exists app_settings (
        key text primary key,
        value text not null,
        updated_at text not null
      );

      create table if not exists recent_files (
        path text primary key,
        title text not null,
        last_opened_at text not null,
        pinned integer not null default 0,
        exists_cache integer not null default 1
      );

      create table if not exists recent_workspaces (
        path text primary key,
        name text not null,
        last_opened_at text not null,
        pinned integer not null default 0
      );

      create table if not exists workspace_state (
        workspace_path text primary key,
        expanded_paths text not null default '[]',
        selected_path text,
        sidebar_visible integer not null default 1,
        updated_at text not null
      );

      create table if not exists document_sessions (
        path text primary key,
        mode text not null,
        cursor_line integer not null default 1,
        cursor_column integer not null default 1,
        scroll_top real not null default 0,
        updated_at text not null
      );

      create table if not exists document_drafts (
        path text primary key,
        content text not null,
        content_hash text not null,
        updated_at text not null
      );

      create index if not exists idx_recent_files_last_opened_at
        on recent_files(last_opened_at desc);

      create index if not exists idx_recent_workspaces_last_opened_at
        on recent_workspaces(last_opened_at desc);
    `)
  }

  database.pragma(`user_version = ${currentVersion}`)
}
