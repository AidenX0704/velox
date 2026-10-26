import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { slugifyHeading } from '../rendering/headingAnchors'
import { renderMultimdTableBlocks } from './multimdTable'
import { markdownSanitizeSchema } from './sanitizeSchema'

export interface MarkdownFrontmatterEntry {
  key: string
  value: string | string[]
}

/** Minimal hast shape — avoids depending on @types/hast at runtime. */
export interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

export interface MarkdownAstResult {
  hast: HastNode
  frontmatter: MarkdownFrontmatterEntry[]
}

/**
 * Markdown → hast. Pure and React-free so it can run inside a Worker; the only
 * platform dependency is `rehype-katex`, which is also pure.
 *
 * Heading ids are resolved here (not while rendering) so the renderer stays a
 * stateless function — v1 kept a module-level counter that two previews could
 * corrupt by rendering concurrently.
 */
export function buildMarkdownAst(content: string): MarkdownAstResult {
  const { body, frontmatter } = splitFrontmatter(content)

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, markdownSanitizeSchema)
    .use(rehypeKatex)

  const tree = processor.runSync(
    processor.parse(renderMultimdTableBlocks(body))
  ) as unknown as HastNode

  assignHeadingAnchors(tree)

  return { hast: tree, frontmatter }
}

/** Sync rendering path (worker unavailable, or a tiny document). */
export function splitFrontmatter(content: string): {
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

export function parseFrontmatter(raw: string): MarkdownFrontmatterEntry[] {
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

/** h1…h6 → id + data-heading-anchor, with de-duplication per document. */
function assignHeadingAnchors(tree: HastNode): void {
  const counts = new Map<string, number>()

  const visit = (node: HastNode): void => {
    if (node.tagName && /^h[1-6]$/.test(node.tagName)) {
      const text = textOf(node)
      const baseSlug = slugifyHeading(text) || 'heading'
      const used = counts.get(baseSlug) ?? 0
      counts.set(baseSlug, used + 1)
      const slug = used > 0 ? `${baseSlug}-${used + 1}` : baseSlug

      node.properties = {
        ...node.properties,
        id: node.properties?.id ?? slug,
        'data-heading-anchor': slug
      }
    }

    node.children?.forEach(visit)
  }

  visit(tree)
}

function textOf(node: HastNode): string {
  if (node.type === 'text') {
    return node.value ?? ''
  }

  return (node.children ?? []).map(textOf).join('')
}
