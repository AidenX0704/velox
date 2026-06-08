import type Database from 'better-sqlite3'

const currentVersion = 2

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

  if (version < 2) {
    database.exec(`
      create table if not exists documents (
        id integer primary key,
        path text unique not null,
        title text not null,
        active_branch_id integer,
        current_snapshot_id integer,
        updated_at text not null
      );

      create table if not exists document_blobs (
        hash text primary key,
        content text not null,
        byte_size integer not null,
        created_at text not null
      );

      create table if not exists document_branches (
        id integer primary key,
        document_id integer not null,
        name text not null,
        head_snapshot_id integer,
        forked_from_snapshot_id integer,
        archived integer not null default 0,
        created_at text not null,
        updated_at text not null,
        unique(document_id, name),
        foreign key(document_id) references documents(id) on delete cascade
      );

      create table if not exists document_snapshots (
        id integer primary key,
        document_id integer not null,
        branch_id integer not null,
        parent_snapshot_id integer,
        blob_hash text not null,
        message text,
        source text not null,
        created_at text not null,
        foreign key(document_id) references documents(id) on delete cascade,
        foreign key(branch_id) references document_branches(id) on delete cascade,
        foreign key(parent_snapshot_id) references document_snapshots(id) on delete set null,
        foreign key(blob_hash) references document_blobs(hash) on delete restrict
      );

      create table if not exists document_events (
        id integer primary key,
        document_id integer,
        branch_id integer,
        snapshot_id integer,
        type text not null,
        title text not null,
        details_json text not null default '{}',
        created_at text not null,
        foreign key(document_id) references documents(id) on delete cascade,
        foreign key(branch_id) references document_branches(id) on delete set null,
        foreign key(snapshot_id) references document_snapshots(id) on delete set null
      );

      create index if not exists idx_document_snapshots_document_created
        on document_snapshots(document_id, created_at desc);

      create index if not exists idx_document_events_created
        on document_events(created_at desc);

      create index if not exists idx_document_events_document_created
        on document_events(document_id, created_at desc);
    `)
  }

  database.pragma(`user_version = ${currentVersion}`)
}
