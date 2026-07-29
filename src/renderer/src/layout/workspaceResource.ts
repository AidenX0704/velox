const markdownResourcePattern = /\.(md|markdown|mdown|mkd|txt)$/i
const imageResourcePattern = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i

export type WorkspaceResourceKind = 'document' | 'image' | 'unsupported'

export function getWorkspaceResourceKind(path: string): WorkspaceResourceKind {
  if (markdownResourcePattern.test(path)) {
    return 'document'
  }

  if (imageResourcePattern.test(path)) {
    return 'image'
  }

  return 'unsupported'
}

export function isWorkspaceImageResource(path: string): boolean {
  return getWorkspaceResourceKind(path) === 'image'
}
