import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ResolveDocumentImageInput } from '../../shared/types'

const maxDocumentImageSize = 25 * 1024 * 1024
const imageMimeTypes = new Map<string, string>([
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
])

export async function resolveDocumentImage(
  input: ResolveDocumentImageInput
): Promise<string | null> {
  const imagePath = resolveDocumentImagePath(input)

  if (!imagePath) {
    return null
  }

  const mimeType = imageMimeTypes.get(extname(imagePath).toLowerCase())

  if (!mimeType) {
    return null
  }

  try {
    const imageRealPath = await realpath(imagePath)
    const imageStats = await stat(imageRealPath)

    if (!imageStats.isFile() || imageStats.size > maxDocumentImageSize) {
      return null
    }

    if (shouldRestrictToWorkspace(input)) {
      const workspaceRealPath = await realpath(input.workspaceRoot!)

      if (!isPathInside(imageRealPath, workspaceRealPath)) {
        return null
      }
    }

    const image = await readFile(imageRealPath)
    return `data:${mimeType};base64,${image.toString('base64')}`
  } catch {
    return null
  }
}

function resolveDocumentImagePath(input: ResolveDocumentImageInput): string | null {
  const imageSource = parseLocalImageSource(input.src)

  if (!imageSource) {
    return null
  }

  if (isAbsolute(imageSource)) {
    return resolve(imageSource)
  }

  const basePath = input.currentPath ? dirname(input.currentPath) : input.workspaceRoot
  return basePath ? resolve(basePath, imageSource) : null
}

function parseLocalImageSource(src: string): string | null {
  const trimmedSource = src.trim()

  if (!trimmedSource || trimmedSource.startsWith('//')) {
    return null
  }

  const withoutSuffix = stripQueryAndFragment(trimmedSource)

  if (!withoutSuffix) {
    return null
  }

  if (/^file:/i.test(withoutSuffix)) {
    try {
      return fileURLToPath(withoutSuffix)
    } catch {
      return null
    }
  }

  const isWindowsAbsolutePath = /^[a-z]:[\\/]/i.test(withoutSuffix)

  if (!isWindowsAbsolutePath && /^[a-z][a-z0-9+.-]*:/i.test(withoutSuffix)) {
    return null
  }

  try {
    return decodeURIComponent(withoutSuffix)
  } catch {
    return withoutSuffix
  }
}

function stripQueryAndFragment(src: string): string {
  const queryIndex = src.indexOf('?')
  const fragmentIndex = src.indexOf('#')
  const suffixIndexes = [queryIndex, fragmentIndex].filter((index) => index >= 0)
  const endIndex = suffixIndexes.length > 0 ? Math.min(...suffixIndexes) : src.length

  return src.slice(0, endIndex)
}

function shouldRestrictToWorkspace(input: ResolveDocumentImageInput): boolean {
  if (!input.workspaceRoot) {
    return false
  }

  return (
    !input.currentPath || isPathInside(resolve(input.currentPath), resolve(input.workspaceRoot))
  )
}

function isPathInside(targetPath: string, rootPath: string): boolean {
  const relativePath = relative(rootPath, targetPath)

  return (
    relativePath === '' ||
    (!!relativePath &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  )
}
