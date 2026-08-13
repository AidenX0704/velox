import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'velox-tab-close-'))
const outfile = join(temporaryDirectory, 'tab-close-check.mjs')

try {
  await build({
    entryPoints: ['src/renderer/src/features/tabs/closeTabWorkflow.test.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    sourcemap: 'inline',
    logLevel: 'silent'
  })

  await import(pathToFileURL(outfile).href)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
