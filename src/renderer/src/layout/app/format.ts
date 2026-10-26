import type { UpdaterStatus } from '../../../../shared/types'

/** Explorer width bounds, shared by the resizer and the persisted state. */
export const DEFAULT_EXPLORER_WIDTH = 268
export const MIN_EXPLORER_WIDTH = 220
export const MAX_EXPLORER_WIDTH = 480

export function clampExplorerWidth(width: number): number {
  return Math.min(MAX_EXPLORER_WIDTH, Math.max(MIN_EXPLORER_WIDTH, width))
}

export function computeWordCount(content: string): number {
  const text = content.trim()

  if (!text) {
    return 0
  }

  return text.split(/\s+/).length
}

export function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

export function formatActivityTime(value?: string): string {
  if (!value) {
    return '暂无'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

export function formatUpdateDate(value?: string): string | undefined {
  if (!value) {
    return undefined
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export function getUpdateNotes(status: UpdaterStatus): string {
  return status.releaseNotes?.trim() || '此版本没有提供更新日志。'
}
