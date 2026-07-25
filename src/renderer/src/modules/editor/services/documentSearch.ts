export interface TextSearchMatch {
  from: number
  to: number
}

export interface TextSearchOptions {
  caseSensitive?: boolean
}

export function normalizeSearchQuery(query?: string): string {
  return query?.trim() ?? ''
}

export function findTextSearchMatches(
  text: string,
  query?: string,
  options: TextSearchOptions = {}
): TextSearchMatch[] {
  const normalizedQuery = normalizeSearchQuery(query)

  if (!normalizedQuery) {
    return []
  }

  const matches: TextSearchMatch[] = []
  const searchableText = options.caseSensitive ? text : text.toLocaleLowerCase()
  const searchableQuery = options.caseSensitive
    ? normalizedQuery
    : normalizedQuery.toLocaleLowerCase()
  let searchFrom = 0

  while (searchFrom <= searchableText.length - searchableQuery.length) {
    const from = searchableText.indexOf(searchableQuery, searchFrom)

    if (from === -1) {
      break
    }

    matches.push({ from, to: from + normalizedQuery.length })
    searchFrom = from + normalizedQuery.length
  }

  return matches
}

export function replaceTextSearchMatches(
  text: string,
  matches: TextSearchMatch[],
  replacement: string
): string {
  if (matches.length === 0) {
    return text
  }

  let nextText = text

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    nextText = `${nextText.slice(0, match.from)}${replacement}${nextText.slice(match.to)}`
  }

  return nextText
}
