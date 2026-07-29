import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'velox-document-image-check-'))
const outfile = join(temporaryDirectory, 'document-image-check.mjs')

try {
  await build({
    entryPoints: ['src/main/services/document-image.test.ts'],
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
