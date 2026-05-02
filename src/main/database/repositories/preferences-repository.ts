import type Database from 'better-sqlite3'

interface SettingRow {
  key: string
  value: string
}

export class PreferencesRepository {
  constructor(private readonly database: Database.Database) {}

  get<T>(key: string): T | undefined {
    const row = this.database
      .prepare('select key, value from app_settings where key = ?')
      .get(key) as SettingRow | undefined

    if (!row) {
      return undefined
    }

    return JSON.parse(row.value) as T
  }

  set<T>(key: string, value: T): void {
    this.database
      .prepare(
        `insert into app_settings (key, value, updated_at)
         values (@key, @value, @updatedAt)
         on conflict(key) do update set
           value = excluded.value,
           updated_at = excluded.updated_at`
      )
      .run({
        key,
        value: JSON.stringify(value),
        updatedAt: new Date().toISOString()
      })
  }
}
