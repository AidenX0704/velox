import type { MarkdownFrontmatterEntry } from './pipeline'

export interface ParsedMarkdown {
  hast: unknown
  frontmatter: MarkdownFrontmatterEntry[]
}

type Resolver = (result: ParsedMarkdown | null) => void

let worker: Worker | null = null
let workerUnavailable = false
let sequence = 0
const pending = new Map<number, Resolver>()

function getWorker(): Worker | null {
  if (worker || workerUnavailable) {
    return worker
  }

  try {
    worker = new Worker(new URL('./markdown.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (
      event: MessageEvent<{ id: number; ok: boolean; hast?: unknown; frontmatter?: unknown }>
    ) => {
      const { id, ok, hast, frontmatter } = event.data
      const resolve = pending.get(id)

      if (!resolve) {
        return
      }

      pending.delete(id)
      resolve(
        ok
          ? { hast, frontmatter: (frontmatter as MarkdownFrontmatterEntry[] | undefined) ?? [] }
          : null
      )
    }
    worker.onerror = () => {
      // A broken worker must not break previews: fall back to sync rendering.
      workerUnavailable = true
      for (const resolve of pending.values()) {
        resolve(null)
      }
      pending.clear()
      worker?.terminate()
      worker = null
    }
  } catch {
    workerUnavailable = true
    worker = null
  }

  return worker
}

/**
 * Parses Markdown off the UI thread. Resolves `null` when the worker cannot be
 * used, so the caller can fall back to a synchronous parse.
 */
export function parseMarkdownInWorker(content: string): Promise<ParsedMarkdown | null> {
  const instance = getWorker()

  if (!instance) {
    return Promise.resolve(null)
  }

  const id = (sequence += 1)

  return new Promise<ParsedMarkdown | null>((resolve) => {
    pending.set(id, resolve)
    instance.postMessage({ id, content })
  })
}
