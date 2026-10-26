#!/usr/bin/env node
/**
 * Bundle budget guard — keeps the first-paint path from creeping back up.
 * Run after `npm run build`:  node scripts/check-startup-budget.mjs
 *
 * Budgets are expressed in KB of *raw* (uncompressed) bytes, because that is
 * what the renderer has to parse. They are deliberately set ~10% above the
 * current measurements so normal feature work does not trip them, but a
 * regression of a whole library will.
 */
import { readFileSync, statSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const RENDERER = 'out/renderer'
const BUDGETS = {
  initialJs: 900, // entry + preloaded chunks
  initialCss: 220,
  initialTotal: 1120,
  largestLazyChunk: 1100,
  largestWorkerChunk: 1600, // parsed off the UI thread, so it has its own ceiling // guards against a library being bundled whole
  totalDist: 16000
}

const kb = (bytes) => Math.round(bytes / 1024)
const failures = []
const rows = []

function sizeOf(file) {
  return statSync(file).size
}

const html = readFileSync(join(RENDERER, 'index.html'), 'utf8')
const entryScripts = [...html.matchAll(/<script[^>]+src="\.\/([^"]+)"/g)].map((m) => m[1])
const preloadScripts = [...html.matchAll(/rel="modulepreload"[^>]+href="\.\/([^"]+)"/g)].map(
  (m) => m[1]
)
const styles = [...html.matchAll(/rel="stylesheet"[^>]+href="\.\/([^"]+)"/g)].map((m) => m[1])

let initialJs = 0
for (const file of [...entryScripts, ...preloadScripts]) {
  const bytes = sizeOf(join(RENDERER, file))
  initialJs += bytes
  rows.push([`js  ${file}`, kb(bytes)])
}

let initialCss = 0
for (const file of styles) {
  const bytes = sizeOf(join(RENDERER, file))
  initialCss += bytes
  rows.push([`css ${file}`, kb(bytes)])
}

const initialTotal = initialJs + initialCss
rows.push(['—— initial total', kb(initialTotal)])

// gzip ratio is reported for context only; parsing cost tracks raw bytes.
const entryGzip = [...entryScripts, ...preloadScripts].reduce((sum, file) => {
  return sum + gzipSync(readFileSync(join(RENDERER, file))).length
}, 0)
rows.push(['—— entry gzip', kb(entryGzip)])

const assets = readdirSync(join(RENDERER, 'assets'))
const jsAssets = assets.filter((file) => file.endsWith('.js'))
const entryNames = new Set(
  [...entryScripts, ...preloadScripts].map((file) => file.split('/').pop())
)
// Mermaid ships one chunk per diagram type, each already lazy. They are not
// part of the editor path, so they do not count against the library budget.
const diagramChunk = /diagram|mermaid|cytoscape|cynefin|dagre|katex|shiki-lang/i
const browserWorker = /\.worker-|worker-.*\.js$/
// A worker chunk is parsed off the UI thread; budget it separately.
const workerJs = jsAssets.filter((file) => browserWorker.test(file))
const lazyJs = jsAssets.filter(
  (file) => !entryNames.has(file) && !diagramChunk.test(file) && !browserWorker.test(file)
)
const largestLazy = lazyJs
  .map((file) => ({ file, bytes: sizeOf(join(RENDERER, 'assets', file)) }))
  .sort((a, b) => b.bytes - a.bytes)[0]

function directorySize(directory) {
  let total = 0

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name)
    total += entry.isDirectory() ? directorySize(full) : sizeOf(full)
  }

  return total
}

const totalDist = directorySize(RENDERER)

const largestWorker = workerJs
  .map((file) => ({ file, bytes: sizeOf(join(RENDERER, 'assets', file)) }))
  .sort((a, b) => b.bytes - a.bytes)[0]

if (largestWorker) {
  rows.push([`js  ${largestWorker.file} (worker, off-thread)`, kb(largestWorker.bytes)])
}

if (largestLazy) {
  rows.push([`js  ${largestLazy.file} (largest lazy chunk)`, kb(largestLazy.bytes)])
}

rows.push(['—— dist total', kb(totalDist)])

function check(label, actual, budget) {
  if (actual > budget) {
    failures.push(`${label}: ${actual} KB > 预算 ${budget} KB`)
  }
}

check('首屏 JS', kb(initialJs), BUDGETS.initialJs)
check('首屏 CSS', kb(initialCss), BUDGETS.initialCss)
check('首屏合计', kb(initialTotal), BUDGETS.initialTotal)
if (largestWorker) {
  check('最大 worker chunk', kb(largestWorker.bytes), BUDGETS.largestWorkerChunk)
}

if (largestLazy) {
  check('最大懒加载 chunk', kb(largestLazy.bytes), BUDGETS.largestLazyChunk)
}
check('产物总量', kb(totalDist), BUDGETS.totalDist)

// Semi UI must never come back through a dependency chain.
const semiCss = assets.find((file) => /^semi-.*\.css$/.test(file))
if (semiCss) {
  failures.push(`检测到 Semi 样式表 ${semiCss}，依赖未清理干净`)
}

const width = Math.max(...rows.map(([label]) => label.length))
for (const [label, value] of rows) {
  console.log(`${label.padEnd(width)}  ${String(value).padStart(6)} KB`)
}

if (failures.length > 0) {
  console.error('\n✖ 启动预算超支：')
  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }
  process.exit(1)
}

console.log('\n✓ 启动预算通过')
