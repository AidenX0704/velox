import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { runMigrations } from './migrations'

let database: Database.Database | undefined

export function getDatabase(): Database.Database {
  if (database) {
    return database
  }

  const databasePath = join(app.getPath('userData'), 'velox.sqlite3')
  mkdirSync(dirname(databasePath), { recursive: true })

  database = new Database(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  runMigrations(database)

  return database
}

export function closeDatabase(): void {
  database?.close()
  database = undefined
}
