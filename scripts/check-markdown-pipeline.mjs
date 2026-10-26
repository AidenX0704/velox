#!/usr/bin/env node
/**
 * Markdown pipeline regression check.
 *
 * The parse pipeline (`buildMarkdownAst`) must stay React-free so it can run in
 * a worker; this script bundles it for Node with the repo's esbuild, runs three
 * fixtures and asserts the observable contract:
 *   · heading ids + data-heading-anchor are assigned (and de-duplicated)
 *   · GFM tables, task lists and KaTeX are actually rendered
 *   · frontmatter is split off and parsed
 *   · raw HTML from the source cannot smuggle a <script>
 *
 *   node scripts/check-markdown-pipeline.mjs
 */
import { buildSync } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const workdir = mkdtempSync(join(tmpdir(), 'velox-md-'))
const outfile = join(workdir, 'pipeline.mjs')

try {
  buildSync({
    entryPoints: ['src/renderer/src/modules/editor/markdown/pipeline.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    outfile,
    logLevel: 'silent'
  })

  const { buildMarkdownAst } = await import(pathToFileURL(outfile).href)

  const failures = []
  const check = (label, condition) => {
    if (!condition) {
      failures.push(label)
    }
  }

  const flatten = (node, out = []) => {
    out.push(node)

    for (const child of node.children ?? []) {
      flatten(child, out)
    }

    return out
  }

  /* 1. headings + anchors + de-duplication */
  {
    const { hast } = buildMarkdownAst('# Title\n\n## Same\n\n## Same\n\n### 结构 `code`\n')
    const nodes = flatten(hast)
    const headings = nodes.filter((node) => /^h[1-6]$/.test(node.tagName ?? ''))
    const ids = headings.map((node) => node.properties?.id)

    check('headings rendered', headings.length === 4)
    check(
      'heading ids assigned',
      ids.every((id) => typeof id === 'string' && id.length > 0)
    )
    check('duplicate headings de-duplicated', new Set(ids).size === ids.length)
    check(
      'heading anchor attribute present',
      headings.every((node) => typeof node.properties?.['data-heading-anchor'] === 'string')
    )
  }

  /* 2. GFM table + task list */
  {
    const { hast } = buildMarkdownAst('| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n')
    const nodes = flatten(hast)

    check(
      'table rendered',
      nodes.some((node) => node.tagName === 'table')
    )
    check(
      'table header rendered',
      nodes.some((node) => node.tagName === 'th')
    )
    check(
      'task list checkbox rendered',
      nodes.some((node) => node.tagName === 'input')
    )
  }

  /* 3. KaTeX + frontmatter */
  {
    const { hast, frontmatter } = buildMarkdownAst(
      '---\ntitle: 测试\ntags:\n  - a\n  - b\n---\n\n$E = mc^2$\n'
    )
    const nodes = flatten(hast)

    check('frontmatter parsed', frontmatter.length === 2)
    check('frontmatter title', frontmatter[0]?.key === 'title' && frontmatter[0]?.value === '测试')
    check(
      'frontmatter list',
      Array.isArray(frontmatter[1]?.value) && frontmatter[1].value.length === 2
    )
    check(
      'katex rendered',
      nodes.some((node) => String(node.properties?.className ?? '').includes('katex'))
    )
  }

  /* 4. sanitisation: inline script must not survive */
  {
    const { hast } = buildMarkdownAst('Hello <script>alert(1)</script> <b>bold</b>\n')
    const nodes = flatten(hast)

    check('script tag stripped', !nodes.some((node) => node.tagName === 'script'))
    check(
      'safe inline tag kept',
      nodes.some((node) => node.tagName === 'b')
    )
  }

  /* 5. 结构化文档：不应抛错且能处理长文 */
  {
    const long = Array.from(
      { length: 400 },
      (_, i) => `## 段 ${i}\n\n正文 ${i} 内容 with **bold**\n`
    ).join('\n')
    const started = Date.now()
    const { hast } = buildMarkdownAst(long)

    check('long document parsed', flatten(hast).length > 1000)
    console.log(`  长文解析: 400 段 / ${Date.now() - started} ms`)
  }

  if (failures.length > 0) {
    console.error(`\n✖ Markdown 管线检查失败（${failures.length} 项）：`)
    for (const failure of failures) {
      console.error(`  - ${failure}`)
    }
    process.exit(1)
  }

  console.log('✓ Markdown 管线检查通过（标题锚点 / GFM / KaTeX / frontmatter / 消毒）')
} finally {
  rmSync(workdir, { recursive: true, force: true })
}
