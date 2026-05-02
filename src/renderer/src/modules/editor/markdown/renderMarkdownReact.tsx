import { Fragment, createElement, isValidElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeReact from 'rehype-react'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { CodeBlockPre, MarkdownImage, MarkdownTable, SafeLink } from './MarkdownRenderComponents'
import { slugifyHeading } from '../rendering/headingAnchors'
import { markdownSanitizeSchema } from './sanitizeSchema'

const headingSlugCounts = new Map<string, number>()
const Heading = {
  h1: createHeadingComponent('h1'),
  h2: createHeadingComponent('h2'),
  h3: createHeadingComponent('h3'),
  h4: createHeadingComponent('h4'),
  h5: createHeadingComponent('h5'),
  h6: createHeadingComponent('h6')
}

type HeadingTagName = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export function renderMarkdownReact(content: string): ReactNode {
  resetHeadingRenderState()

  const file = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, markdownSanitizeSchema)
    .use(rehypeKatex)
    .use(rehypeReact, {
      Fragment,
      jsx: jsxRuntime.jsx,
      jsxs: jsxRuntime.jsxs,
      elementAttributeNameCase: 'react',
      stylePropertyNameCase: 'dom',
      components: {
        h1: Heading.h1,
        h2: Heading.h2,
        h3: Heading.h3,
        h4: Heading.h4,
        h5: Heading.h5,
        h6: Heading.h6,
        pre: CodeBlockPre,
        table: MarkdownTable,
        img: MarkdownImage,
        a: SafeLink
      }
    })
    .processSync(content)

  return file.result
}

function resetHeadingRenderState(): void {
  headingSlugCounts.clear()
}

function createHeadingComponent(tagName: HeadingTagName) {
  return function MarkdownHeading(props: React.ComponentProps<'h1'>): ReactElement {
    const text = extractText(props.children)
    const baseSlug = slugifyHeading(text) || 'heading'
    const usedCount = headingSlugCounts.get(baseSlug) ?? 0
    headingSlugCounts.set(baseSlug, usedCount + 1)
    const slug = usedCount > 0 ? `${baseSlug}-${usedCount + 1}` : baseSlug

    return createElement(tagName, {
      ...props,
      id: props.id ?? slug,
      'data-heading-anchor': slug
    })
  }
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('')
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children)
  }

  return ''
}
