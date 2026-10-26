import type { WorkspaceSearchResult } from '../../../../shared/types'
import {
  findTextSearchMatches,
  normalizeSearchQuery
} from '../../modules/editor/services/documentSearch'
import type { TitleBarSearchResult } from '../TitleBar'

export const MAX_TITLEBAR_SEARCH_RESULTS = 80

function compactSnippetPart(value: string): string {
  return value.replace(/\s+/g, ' ')
}

function buildSearchResultSnippet(
  content: string,
  from: number,
  to: number
): Pick<TitleBarSearchResult, 'before' | 'match' | 'after'> {
  const lineStart = content.lastIndexOf('\n', Math.max(0, from - 1)) + 1
  const nextLineBreak = content.indexOf('\n', to)
  const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak
  const beforeStart = Math.max(lineStart, from - 42)
  const afterEnd = Math.min(lineEnd, to + 58)

  return {
    before: `${beforeStart > lineStart ? '...' : ''}${compactSnippetPart(
      content.slice(beforeStart, from)
    )}`,
    match: compactSnippetPart(content.slice(from, to)),
    after: `${compactSnippetPart(content.slice(to, afterEnd))}${afterEnd < lineEnd ? '...' : ''}`
  }
}

/** In-document matches, flattened for the title bar result list. */
export function buildTitlebarSearchResults(
  content: string,
  query: string,
  caseSensitive: boolean
): { totalCount: number; items: TitleBarSearchResult[] } {
  const normalizedQuery = normalizeSearchQuery(query)

  if (!normalizedQuery) {
    return { totalCount: 0, items: [] }
  }

  const matches = findTextSearchMatches(content, normalizedQuery, { caseSensitive })
  let currentLine = 1
  let scannedOffset = 0

  const items = matches.slice(0, MAX_TITLEBAR_SEARCH_RESULTS).map((match, index) => {
    let newlineOffset = content.indexOf('\n', scannedOffset)

    while (newlineOffset !== -1 && newlineOffset < match.from) {
      currentLine += 1
      scannedOffset = newlineOffset + 1
      newlineOffset = content.indexOf('\n', scannedOffset)
    }

    const lineStart = content.lastIndexOf('\n', Math.max(0, match.from - 1)) + 1

    return {
      id: `document-${index}-${currentLine}-${match.from}`,
      scope: 'document' as const,
      index,
      matchIndex: index,
      line: currentLine,
      column: match.from - lineStart + 1,
      ...buildSearchResultSnippet(content, match.from, match.to)
    }
  })

  return { totalCount: matches.length, items }
}

/** Workspace-wide matches, flattened to the same result shape. */
export function flattenWorkspaceSearchResults(
  result: WorkspaceSearchResult | null
): TitleBarSearchResult[] {
  if (!result) {
    return []
  }

  let globalIndex = 0
  const items: TitleBarSearchResult[] = []

  for (const file of result.files) {
    for (const match of file.matches) {
      items.push({
        id: `workspace-${globalIndex}-${file.path}-${match.index}`,
        scope: 'workspace',
        index: globalIndex,
        matchIndex: match.index,
        path: file.path,
        relativePath: file.relativePath,
        fileName: file.name,
        line: match.line,
        column: match.column,
        before: match.before,
        match: match.match,
        after: match.after
      })
      globalIndex += 1
    }
  }

  return items
}
