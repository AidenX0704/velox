export interface DocumentImageContext {
  currentPath?: string
  workspaceRoot?: string | null
}

const pendingImageRequests = new Map<string, Promise<string | null>>()

export function isLocalDocumentImageSource(src: string | undefined): boolean {
  const trimmedSource = src?.trim()

  if (!trimmedSource || trimmedSource.startsWith('//')) {
    return false
  }

  if (/^[a-z]:[\\/]/i.test(trimmedSource)) {
    return true
  }

  const protocolMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmedSource)
  return !protocolMatch || protocolMatch[1].toLowerCase() === 'file'
}

export function resolveDocumentImageSource(
  src: string,
  context: DocumentImageContext
): Promise<string | null> {
  if (!isLocalDocumentImageSource(src)) {
    return Promise.resolve(src)
  }

  const requestKey = [src, context.currentPath ?? '', context.workspaceRoot ?? ''].join('\0')
  const pendingRequest = pendingImageRequests.get(requestKey)

  if (pendingRequest) {
    return pendingRequest
  }

  const request = window.api.document
    .resolveImage({
      src,
      currentPath: context.currentPath,
      workspaceRoot: context.workspaceRoot ?? undefined
    })
    .then((result) => (result.ok ? result.data : null))
    .finally(() => {
      pendingImageRequests.delete(requestKey)
    })

  pendingImageRequests.set(requestKey, request)
  return request
}
