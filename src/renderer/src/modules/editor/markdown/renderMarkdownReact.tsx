import type { ReactNode } from 'react'
import { buildMarkdownAst } from './pipeline'
import { createAstRenderer, type MarkdownRenderOptions } from './renderAst'

export type { MarkdownRenderOptions }

/**
 * Synchronous Markdown → React. Kept for the fallback path and for callers that
 * cannot await; `MarkdownPreview` uses `useMarkdownRender`, which parses in a
 * worker and only renders here.
 */
export function renderMarkdownReact(
  content: string,
  options: MarkdownRenderOptions = {}
): ReactNode {
  const { hast, frontmatter } = buildMarkdownAst(content)

  return createAstRenderer(options)(hast, frontmatter)
}
