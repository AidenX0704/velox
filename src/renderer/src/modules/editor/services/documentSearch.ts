export interface TextSearchMatch {
  from: number
  to: number
}

export function normalizeSearchQuery(query?: string): string {
  return query?.trim() ?? ''
}

export function findTextSearchMatches(text: string, query?: string): TextSearchMatch[] {
  const normalizedQuery = normalizeSearchQuery(query)

  if (!normalizedQuery) {
    return []
  }

  const matches: TextSearchMatch[] = []
  const lowerText = text.toLocaleLowerCase()
  const lowerQuery = normalizedQuery.toLocaleLowerCase()
  let searchFrom = 0

  while (searchFrom <= lowerText.length - lowerQuery.length) {
    const from = lowerText.indexOf(lowerQuery, searchFrom)

    if (from === -1) {
      break
    }

    matches.push({ from, to: from + normalizedQuery.length })
    searchFrom = from + normalizedQuery.length
  }

  return matches
}
