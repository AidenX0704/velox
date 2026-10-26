import { Fragment, type ReactNode } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import rehypeReact from 'rehype-react'
import { unified } from 'unified'
import type { DocumentImageContext } from '../services/documentImage'
import {
  CodeBlockPre,
  MarkdownBlockquote,
  MarkdownFrontmatter,
  MarkdownImage,
  MarkdownTable,
  SafeLink,
  type MarkdownFrontmatterEntry
} from './MarkdownRenderComponents'
import type { HastNode } from './pipeline'

export interface MarkdownRenderOptions extends DocumentImageContext {
  showCodeBlockLineNumbers?: boolean
}

export type MarkdownAstRenderer = (
  hast: HastNode,
  frontmatter: MarkdownFrontmatterEntry[]
) => ReactNode

/**
 * Builds a hast→React renderer. Cheap (no parsing), so creating one per preview
 * context is fine; the parse itself happens in the worker.
 */
export function createAstRenderer(options: MarkdownRenderOptions): MarkdownAstRenderer {
  const showLineNumbers = options.showCodeBlockLineNumbers ?? false

  function RenderedCodeBlock(props: React.ComponentProps<'pre'>): ReactNode {
    return <CodeBlockPre {...props} showLineNumbers={showLineNumbers} />
  }

  function ResolvedMarkdownImage(props: React.ComponentProps<'img'>): ReactNode {
    return (
      <MarkdownImage
        {...props}
        currentPath={options.currentPath}
        workspaceRoot={options.workspaceRoot}
      />
    )
  }

  const processor = unified().use(rehypeReact, {
    Fragment,
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    elementAttributeNameCase: 'react',
    stylePropertyNameCase: 'dom',
    components: {
      pre: RenderedCodeBlock,
      table: MarkdownTable,
      img: ResolvedMarkdownImage,
      a: SafeLink,
      blockquote: MarkdownBlockquote
    }
  })

  function renderMarkdownAst(hast: HastNode, frontmatter: MarkdownFrontmatterEntry[]): ReactNode {
    const body = processor.stringify(hast as never) as ReactNode

    if (frontmatter.length === 0) {
      return body
    }

    return (
      <>
        <MarkdownFrontmatter entries={frontmatter} />
        {body}
      </>
    )
  }

  return renderMarkdownAst
}
