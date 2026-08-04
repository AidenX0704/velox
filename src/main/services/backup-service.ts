import { copyFile, mkdir, stat, utimes } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import fg from 'fast-glob'
import type { BackupFileStatus, BackupRunResult } from '../../shared/types'
import type { BackupTarget } from '../../shared/preferences'
import { VeloxError } from '../shared/errors'
import { PreferencesService } from './preferences-service'

export class BackupService {
  private lastRun: BackupRunResult | null = null

  constructor(private readonly preferencesService: PreferencesService) {}

  getLastRun(): BackupRunResult | null {
    return this.lastRun
  }

  async run(
    sourcePath: string,
    onProgress: (status: BackupFileStatus) => void
  ): Promise<BackupRunResult> {
    const source = resolve(sourcePath)
    const sourceStat = await stat(source).catch(() => null)
    if (!sourceStat?.isDirectory()) {
      throw new VeloxError('INVALID_BACKUP_SOURCE', '请先打开一个有效的工作区')
    }

    const preferences = this.preferencesService.getEditorPreferences().backup
    const targets = preferences.targets.filter((target) => target.enabled)
    if (targets.length === 0) {
      throw new VeloxError('NO_BACKUP_TARGET', '请至少启用一个备份目标')
    }

    const unsupported = targets.filter((target) => target.provider !== 'local')
    if (unsupported.length > 0) {
      throw new VeloxError(
        'BACKUP_PROVIDER_NOT_CONNECTED',
        `以下目标尚未完成授权：${unsupported.map((target) => target.name).join('、')}`
      )
    }

    const startedAt = new Date().toISOString()
    const run: BackupRunResult = {
      id: crypto.randomUUID(),
      state: 'running',
      startedAt,
      totalFiles: 0,
      syncedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      files: []
    }
    this.lastRun = run

    const ignore = preferences.excludePatterns
      .split(/\r?\n/)
      .map((pattern) => pattern.trim())
      .filter(Boolean)
      .flatMap((pattern) => [pattern, `${pattern}/**`])
    if (!preferences.includeAttachments) {
      ignore.push('**/*.{png,jpg,jpeg,gif,webp,svg,pdf,doc,docx,xls,xlsx,zip}')
    }

    const files = await fg('**/*', { cwd: source, onlyFiles: true, dot: true, ignore })
    run.totalFiles = files.length * targets.length

    for (const target of targets) {
      await this.backupToLocalTarget(source, files, target, run, onProgress)
    }

    run.completedAt = new Date().toISOString()
    run.state = run.failedFiles === 0 ? 'completed' : run.syncedFiles > 0 ? 'partial' : 'failed'
    this.lastRun = { ...run, files: [...run.files] }
    return this.lastRun
  }

  private async backupToLocalTarget(
    source: string,
    files: string[],
    target: BackupTarget,
    run: BackupRunResult,
    onProgress: (status: BackupFileStatus) => void
  ): Promise<void> {
    if (!target.remotePath.trim() || !isAbsolute(target.remotePath)) {
      throw new VeloxError('INVALID_BACKUP_TARGET', `${target.name} 需要填写绝对备份目录`)
    }

    const destination = resolve(target.remotePath)
    const destinationRelativeToSource = relative(source, destination)
    if (!destinationRelativeToSource.startsWith('..') && !isAbsolute(destinationRelativeToSource)) {
      throw new VeloxError('UNSAFE_BACKUP_TARGET', '备份目录不能位于当前工作区内部')
    }

    for (const relativePath of files) {
      const syncing = this.createFileStatus(target.id, relativePath, 'syncing')
      run.files.push(syncing)
      onProgress(syncing)

      try {
        const sourceFile = join(source, relativePath)
        const destinationFile = join(destination, relativePath)
        const sourceFileStat = await stat(sourceFile)
        const destinationFileStat = await stat(destinationFile).catch(() => null)
        if (
          destinationFileStat?.isFile() &&
          destinationFileStat.size === sourceFileStat.size &&
          Math.abs(destinationFileStat.mtimeMs - sourceFileStat.mtimeMs) < 1
        ) {
          const skipped = this.createFileStatus(
            target.id,
            relativePath,
            'skipped',
            sourceFileStat.size
          )
          run.files[run.files.length - 1] = skipped
          run.skippedFiles += 1
          onProgress(skipped)
          continue
        }

        await mkdir(resolve(destinationFile, '..'), { recursive: true })
        await copyFile(sourceFile, destinationFile)
        await utimes(destinationFile, sourceFileStat.atime, sourceFileStat.mtime)
        const synced = this.createFileStatus(target.id, relativePath, 'synced', sourceFileStat.size)
        run.files[run.files.length - 1] = synced
        run.syncedFiles += 1
        onProgress(synced)
      } catch (error) {
        const failed = this.createFileStatus(
          target.id,
          relativePath,
          'failed',
          undefined,
          error instanceof Error ? error.message : '复制失败'
        )
        run.files[run.files.length - 1] = failed
        run.failedFiles += 1
        onProgress(failed)
      }
    }
  }

  private createFileStatus(
    targetId: string,
    relativePath: string,
    state: BackupFileStatus['state'],
    bytes?: number,
    message?: string
  ): BackupFileStatus {
    return { targetId, relativePath, state, bytes, message, updatedAt: new Date().toISOString() }
  }
}
