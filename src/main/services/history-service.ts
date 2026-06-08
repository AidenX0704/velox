import type {
  HistoryBranchRecord,
  HistoryRepository,
  HistorySnapshotRecord,
  HistoryTimelineEntry
} from '../database/repositories/history-repository'
import type { HistoryDocumentActivity } from '../../shared/types'
import { basename } from 'node:path'
import { readFile } from 'node:fs/promises'

export class HistoryService {
  constructor(private readonly historyRepository: HistoryRepository) {}

  recordOpen(path: string): void {
    this.historyRepository.recordOpen(path)
  }

  recordImport(path: string, content: string): HistorySnapshotRecord {
    return this.historyRepository.recordSnapshot({
      path,
      content,
      source: 'import',
      message: '导入文档'
    })
  }

  recordSave(path: string, content: string): HistorySnapshotRecord {
    return this.historyRepository.recordSnapshot({
      path,
      content,
      source: 'save',
      message: '保存文档'
    })
  }

  listTimeline(path?: string): HistoryTimelineEntry[] {
    return this.historyRepository.listTimeline(80, path)
  }

  listBranches(path?: string): HistoryBranchRecord[] {
    return this.historyRepository.listBranches(80, path)
  }

  async getDocumentActivity(path: string): Promise<HistoryDocumentActivity> {
    const currentContent = await readFile(path, 'utf8')
    const headSnapshot = this.historyRepository.getHeadSnapshot(path)
    const timeline = this.historyRepository.listTimeline(24, path)
    const branches = this.historyRepository.listBranches(12, path)
    const diff = createLineDiff(headSnapshot?.content ?? '', currentContent)

    return {
      path,
      title: basename(path),
      currentContent,
      ...(headSnapshot
        ? {
            headSnapshot: {
              id: headSnapshot.id,
              branchName: headSnapshot.branchName,
              content: headSnapshot.content,
              createdAt: headSnapshot.createdAt
            }
          }
        : {}),
      diff,
      timeline,
      branches
    }
  }
}

function createLineDiff(before: string, after: string): HistoryDocumentActivity['diff'] {
  const beforeLines = before.split(/\r?\n/)
  const afterLines = after.split(/\r?\n/)
  const max = Math.max(beforeLines.length, afterLines.length)
  const lines: HistoryDocumentActivity['diff']['lines'] = []
  let addedLines = 0
  let removedLines = 0

  for (let index = 0; index < max; index += 1) {
    const beforeLine = beforeLines[index]
    const afterLine = afterLines[index]

    if (beforeLine === afterLine) {
      if (afterLine !== undefined && lines.length < 80) {
        lines.push({ type: 'context', text: afterLine })
      }
      continue
    }

    if (beforeLine !== undefined) {
      removedLines += 1
      if (lines.length < 80) {
        lines.push({ type: 'removed', text: beforeLine })
      }
    }

    if (afterLine !== undefined) {
      addedLines += 1
      if (lines.length < 80) {
        lines.push({ type: 'added', text: afterLine })
      }
    }
  }

  return {
    addedLines,
    removedLines,
    unchanged: addedLines === 0 && removedLines === 0,
    lines
  }
}
