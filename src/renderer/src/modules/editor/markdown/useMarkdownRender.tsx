import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildMarkdownAst, type HastNode, type MarkdownAstResult } from './pipeline'
import { parseMarkdownInWorker } from './markdownWorkerClient'
import { createAstRenderer, type MarkdownRenderOptions } from './renderAst'

/** Below this size a postMessage round-trip costs more than parsing inline. */
const SYNC_THRESHOLD = 4000
const DEBOUNCE_MS = 60

interface AsyncResult extends MarkdownAstResult {
  source: string
}

/**
 * Parses Markdown in a worker (debounced) and turns the resulting hast into
 * React nodes on the main thread. Small documents parse inline (the worker
 * round-trip would cost more), so a preview is never blank.
 */
export function useMarkdownRender(content: string, options: MarkdownRenderOptions): ReactNode {
  const { currentPath, workspaceRoot, showCodeBlockLineNumbers } = options

  const renderer = useMemo(
    () => createAstRenderer({ currentPath, workspaceRoot, showCodeBlockLineNumbers }),
    [currentPath, workspaceRoot, showCodeBlockLineNumbers]
  )

  // Small documents: derive during render, no state, no effect.
  const inlineResult = useMemo(
    () => (content.length <= SYNC_THRESHOLD ? buildMarkdownAst(content) : null),
    [content]
  )

  const [asyncResult, setAsyncResult] = useState<AsyncResult | null>(null)
  const latestRequest = useRef(0)

  useEffect(() => {
    if (content.length <= SYNC_THRESHOLD) {
      return
    }

    const requestId = (latestRequest.current += 1)

    const timer = window.setTimeout(() => {
      void parseMarkdownInWorker(content).then((parsed) => {
        if (latestRequest.current !== requestId) {
          return
        }

        setAsyncResult(
          parsed
            ? { hast: parsed.hast as HastNode, frontmatter: parsed.frontmatter, source: content }
            : { ...buildMarkdownAst(content), source: content }
        )
      })
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [content])

  return useMemo(() => {
    const result = inlineResult ?? (asyncResult?.source === content ? asyncResult : null)

    if (!result) {
      // Large document, first frame: keep the previous preview rather than
      // flashing empty while the worker catches up.
      return asyncResult ? renderer(asyncResult.hast, asyncResult.frontmatter) : null
    }

    return renderer(result.hast, result.frontmatter)
  }, [asyncResult, content, inlineResult, renderer])
}
