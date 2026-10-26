import { BrowserWindow } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'
import { stat } from 'node:fs/promises'
import { ipcChannels } from '../../shared/channels'
import type { ExternalDocumentChange } from '../../shared/types'
import { logger } from './log-service'

/** Coalesce bursts (atomic saves, formatters) into one renderer notification. */
const CHANGE_DEBOUNCE_MS = 120
/** Ignore echoes of our own writes within this window. */
const SELF_WRITE_WINDOW_MS = 600
/** Atomic save = write temp file + rename over target: unlink then add. */
const RENAME_SETTLE_MS = 160

interface Suppression {
  until: number
  mtimeMs?: number
}

/**
 * Tracks the files that are currently open in tabs, independently from the
 * workspace tree watcher. A workspace watcher answers "did the tree change?";
 * this one answers "did the open document change on disk?" — the two must not
 * share a chokidar instance because they need different ignore rules.
 */
export class FileWatchService {
  private readonly watchers = new Map<string, FSWatcher>()
  private readonly timers = new Map<string, NodeJS.Timeout>()
  private readonly suppression = new Map<string, Suppression>()
  private readonly lastMtime = new Map<string, number>()

  watchDocument(filePath: string): void {
    const key = keyOf(filePath)

    if (this.watchers.has(key)) {
      return
    }

    const watcher = chokidar.watch(key, {
      ignoreInitial: true,
      persistent: true,
      depth: 0,
      // Half-written files would otherwise be read mid-save by the renderer.
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 }
    })

    watcher
      .on('change', () => this.schedule(key))
      .on('add', () => this.schedule(key, RENAME_SETTLE_MS))
      .on('unlink', () => this.schedule(key, RENAME_SETTLE_MS))
      .on('error', (error) => {
        logger.warn(`Document watcher error for ${key}`, error)
      })

    this.watchers.set(key, watcher)
    void this.seed(key)
  }

  unwatchDocument(filePath: string): void {
    const key = keyOf(filePath)
    const timer = this.timers.get(key)

    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }

    const watcher = this.watchers.get(key)

    if (watcher) {
      void watcher.close()
      this.watchers.delete(key)
    }

    this.suppression.delete(key)
    this.lastMtime.delete(key)
  }

  /** Called right after the app itself writes a file. */
  markSelfWrite(filePath: string, mtimeMs?: number): void {
    this.suppression.set(keyOf(filePath), {
      until: Date.now() + SELF_WRITE_WINDOW_MS,
      mtimeMs
    })
  }

  /**
   * Network shares and WSL mounts do not deliver inotify events reliably.
   * A cheap stat × N on window focus restores parity with negligible cost.
   */
  async verifyWatchedDocuments(): Promise<void> {
    for (const key of this.watchers.keys()) {
      await this.compare(key)
    }
  }

  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }

    this.timers.clear()

    for (const watcher of this.watchers.values()) {
      void watcher.close()
    }

    this.watchers.clear()
    this.suppression.clear()
    this.lastMtime.clear()
  }

  private schedule(key: string, delay = CHANGE_DEBOUNCE_MS): void {
    const existing = this.timers.get(key)

    if (existing) {
      clearTimeout(existing)
    }

    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key)
        void this.compare(key)
      }, delay)
    )
  }

  /** Remembers the on-disk fingerprint so the first comparison is silent. */
  private async seed(key: string): Promise<void> {
    try {
      const stats = await stat(key)

      if (stats.isFile() && !this.lastMtime.has(key)) {
        this.lastMtime.set(key, stats.mtimeMs)
      }
    } catch {
      // File vanished between open and watch: the next compare reports removal.
    }
  }

  private async compare(key: string): Promise<void> {
    const suppression = this.suppression.get(key)

    if (suppression && Date.now() < suppression.until) {
      return
    }

    let stats

    try {
      stats = await stat(key)
    } catch {
      this.lastMtime.delete(key)
      this.emit(ipcChannels.document.externalRemoved, { path: key })
      this.unwatchDocument(key)
      return
    }

    if (!stats.isFile()) {
      return
    }

    const previous = this.lastMtime.get(key)

    if (previous === undefined) {
      this.lastMtime.set(key, stats.mtimeMs)
      return
    }

    if (previous === stats.mtimeMs) {
      return
    }

    if (suppression?.mtimeMs !== undefined && suppression.mtimeMs === stats.mtimeMs) {
      this.lastMtime.set(key, stats.mtimeMs)
      return
    }

    this.lastMtime.set(key, stats.mtimeMs)
    logger.info(`External document change detected: ${key}`)
    this.emit(ipcChannels.document.externalChange, {
      path: key,
      mtimeMs: stats.mtimeMs,
      size: stats.size
    } satisfies ExternalDocumentChange)
  }

  private emit(channel: string, payload: ExternalDocumentChange | { path: string }): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send(channel, payload)
      }
    }
  }
}

function keyOf(filePath: string): string {
  // Normalize separators so the same document registered from different
  // code paths (open dialog vs. recent list) is never watched twice.
  return process.platform === 'win32' ? filePath.replaceAll('/', '\\') : filePath
}
