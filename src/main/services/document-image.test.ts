import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveDocumentImage } from './document-image'

const fixtureRoot = await mkdtemp(join(tmpdir(), 'velox-document-image-'))

try {
  const workspaceRoot = join(fixtureRoot, '工作区')
  const documentPath = join(workspaceRoot, '文章', 'CRUDETL.md')
  const relativeImageSource = 'assest/CRUDETL工程师的末日从NL2SQL到ChatBI/1.png'
  const imagePath = join(workspaceRoot, '文章', relativeImageSource)
  const outsideImagePath = join(fixtureRoot, 'outside.png')
  const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  await mkdir(join(workspaceRoot, '文章', 'assest', 'CRUDETL工程师的末日从NL2SQL到ChatBI'), {
    recursive: true
  })
  await Promise.all([
    writeFile(documentPath, `![alt text](${relativeImageSource})`),
    writeFile(imagePath, imageBytes),
    writeFile(outsideImagePath, imageBytes)
  ])

  const relativeResult = await resolveDocumentImage({
    src: relativeImageSource,
    currentPath: documentPath,
    workspaceRoot
  })
  assertImageData(relativeResult, imageBytes)

  const encodedResult = await resolveDocumentImage({
    src: `${encodeURI(relativeImageSource)}?raw=1#preview`,
    currentPath: documentPath,
    workspaceRoot
  })
  assertImageData(encodedResult, imageBytes)

  const fileUrlResult = await resolveDocumentImage({
    src: pathToFileURL(imagePath).href,
    currentPath: documentPath,
    workspaceRoot
  })
  assertImageData(fileUrlResult, imageBytes)

  assert.equal(
    await resolveDocumentImage({
      src: outsideImagePath,
      currentPath: documentPath,
      workspaceRoot
    }),
    null,
    'workspace documents must not read images outside the workspace'
  )

  assertImageData(await resolveDocumentImage({ src: outsideImagePath }), imageBytes)
  assert.equal(await resolveDocumentImage({ src: 'https://example.com/image.png' }), null)
  assert.equal(
    await resolveDocumentImage({ src: relativeImageSource, currentPath: undefined }),
    null
  )
} finally {
  await rm(fixtureRoot, { recursive: true, force: true })
}

function assertImageData(value: string | null, expectedBytes: Buffer): void {
  if (!value) {
    assert.fail('expected a PNG data URL')
  }

  assert.ok(value.startsWith('data:image/png;base64,'), 'expected a PNG data URL')
  assert.deepEqual(Buffer.from(value.slice(value.indexOf(',') + 1), 'base64'), expectedBytes)
}
