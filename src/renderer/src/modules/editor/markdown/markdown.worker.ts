/// <reference lib="webworker" />

import { buildMarkdownAst } from './pipeline'

/**
 * Runs the Markdown parse pipeline (remark + rehype + sanitize + KaTeX) off the
 * UI thread and posts the resulting hast back. React rendering stays on the main
 * thread — the expensive part is parsing, not creating elements.
 */
interface ParseRequest {
  id: number
  content: string
}

export interface ParseResponse {
  id: number
  ok: boolean
  hast?: unknown
  frontmatter?: unknown
  message?: string
}

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { id, content } = event.data

  try {
    const { hast, frontmatter } = buildMarkdownAst(content)
    scope.postMessage({ id, ok: true, hast, frontmatter } satisfies ParseResponse)
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    } satisfies ParseResponse)
  }
}
