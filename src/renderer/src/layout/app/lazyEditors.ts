import { lazy } from 'react'

/**
 * The editor stack (CodeMirror + ProseMirror + shiki + katex) is several
 * megabytes; it must never be part of the first-paint chunk. Keeping the lazy
 * boundaries in one module means every consumer shares the same chunk.
 */
export const MarkdownEditor = lazy(() =>
  import('../../modules/editor/MarkdownEditor').then((module) => ({
    default: module.MarkdownEditor
  }))
)

export const MarkdownPreview = lazy(() =>
  import('../../modules/editor/preview/MarkdownPreview').then((module) => ({
    default: module.MarkdownPreview
  }))
)
