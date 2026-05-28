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
import {
  CodeBlockPre,
  MarkdownBlockquote,
  MarkdownFrontmatter,
  MarkdownImage,
  MarkdownTable,
  SafeLink,
  type MarkdownFrontmatterEntry
} from './MarkdownRenderComponents'
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
  const { body, frontmatter } = splitFrontmatter(content)

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
        a: SafeLink,
        blockquote: MarkdownBlockquote
      }
    })
    .processSync(body)

  if (frontmatter.length > 0) {
    return (
      <>
        <MarkdownFrontmatter entries={frontmatter} />
        {file.result}
      </>
    )
  }

  return file.result
}

function splitFrontmatter(content: string): {
  body: string
  frontmatter: MarkdownFrontmatterEntry[]
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)

  if (!match) {
    return { body: content, frontmatter: [] }
  }

  return {
    body: content.slice(match[0].length),
    frontmatter: parseFrontmatter(match[1])
  }
}

function parseFrontmatter(raw: string): MarkdownFrontmatterEntry[] {
  const entries: MarkdownFrontmatterEntry[] = []
  let currentEntry: MarkdownFrontmatterEntry | null = null

  const commitCurrentEntry = (): void => {
    if (currentEntry) {
      entries.push(currentEntry)
      currentEntry = null
    }
  }

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) {
      continue
    }

    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)

    if (pair) {
      commitCurrentEntry()
      currentEntry = {
        key: pair[1],
        value: pair[2] ? stripYamlQuotes(pair[2].trim()) : []
      }
      continue
    }

    const listItem = /^\s*-\s+(.+)$/.exec(line)

    if (listItem && currentEntry) {
      const nextValue = stripYamlQuotes(listItem[1].trim())
      currentEntry.value = Array.isArray(currentEntry.value)
        ? [...currentEntry.value, nextValue]
        : [currentEntry.value, nextValue].filter(Boolean)
      continue
    }

    if (currentEntry && typeof currentEntry.value === 'string') {
      currentEntry.value = `${currentEntry.value} ${stripYamlQuotes(line.trim())}`.trim()
    }
  }

  commitCurrentEntry()

  return entries
}

function stripYamlQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
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
