import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const outfile = '.tmp/rich-markdown-check.mjs'

await mkdir('.tmp', { recursive: true })
await build({
  entryPoints: ['src/renderer/src/modules/editor/rich/markdownModel.test.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: 'inline',
  logLevel: 'silent'
})

await import(pathToFileURL(outfile).href)
