const safeProtocols = new Set(['http:', 'https:', 'mailto:'])
const externalProtocolPattern = /^[a-z][a-z0-9+.-]*:/i

export interface EditorDocumentLinkPreview {
  path: string
  title: string
  anchor?: string
  excerpt: string
  lineCount: number
  truncated: boolean
}

export interface EditorLinkNavigationOptions {
  currentPath?: string
  workspaceRoot?: string | null
  onOpenDocument?: (path: string, anchor?: string) => boolean | void | Promise<boolean | void>
  onError?: (message: string) => void
}

export interface ResolvedEditorDocumentLink {
  path: string
  anchor?: string
}

export function openEditorLink(
  href: string,
  root: HTMLElement,
  options: EditorLinkNavigationOptions = {}
): boolean {
  if (!href) {
    return false
  }

  if (href.startsWith('#')) {
    return scrollToAnchor(href, root)
  }

  if (isLocalDocumentHref(href)) {
    void openDocumentLink(href, options)
    return true
  }

  let url: URL

  try {
    url = new URL(href, window.location.href)
  } catch {
    return false
  }

  if (!safeProtocols.has(url.protocol)) {
    return false
  }

  window.open(url.href, '_blank', 'noopener,noreferrer')
  return true
}

export function isLocalDocumentHref(href: string): boolean {
  const trimmedHref = href.trim()

  return (
    !!trimmedHref && !trimmedHref.startsWith('//') && !externalProtocolPattern.test(trimmedHref)
  )
}

export async function previewDocumentLink(
  href: string,
  options: EditorLinkNavigationOptions = {}
): Promise<EditorDocumentLinkPreview | null> {
  const result = await window.api.document.previewLink({
    href,
    currentPath: options.currentPath,
    workspaceRoot: options.workspaceRoot ?? undefined
  })

  if (!result.ok) {
    options.onError?.(result.error.message)
    return null
  }

  return result.data
}

export async function resolveDocumentLink(
  href: string,
  options: EditorLinkNavigationOptions = {}
): Promise<ResolvedEditorDocumentLink | null> {
  const result = await window.api.document.resolveLink({
    href,
    currentPath: options.currentPath,
    workspaceRoot: options.workspaceRoot ?? undefined
  })

  if (!result.ok) {
    options.onError?.(result.error.message)
    return null
  }

  return result.data
}

export function scrollToEditorAnchor(anchor: string, root: HTMLElement): boolean {
  const href = anchor.startsWith('#') ? anchor : `#${anchor}`
  return scrollToAnchor(href, root)
}

async function openDocumentLink(href: string, options: EditorLinkNavigationOptions): Promise<void> {
  if (!options.onOpenDocument) {
    return
  }

  const result = await window.api.document.resolveLink({
    href,
    currentPath: options.currentPath,
    workspaceRoot: options.workspaceRoot ?? undefined
  })

  if (!result.ok) {
    options.onError?.(result.error.message)
    return
  }

  if (result.data) {
    await options.onOpenDocument(result.data.path, result.data.anchor)
  }
}

function scrollToAnchor(href: string, root: HTMLElement): boolean {
  const id = normalizeAnchor(href.slice(1))

  if (!id) {
    return false
  }

  const target =
    root.querySelector<HTMLElement>(`#${cssEscape(id)}`) ??
    root.querySelector<HTMLElement>(`[data-heading-anchor="${cssEscape(id)}"]`)

  if (!target) {
    return false
  }

  target.scrollIntoView({ block: 'start', behavior: 'smooth' })
  return true
}

function cssEscape(value: string): string {
  if (window.CSS?.escape) {
    return window.CSS.escape(value)
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

function normalizeAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor)
  } catch {
    return anchor
  }
}
