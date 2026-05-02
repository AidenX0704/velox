export interface HeadingAnchor {
  index: number
  line: number
  level: number
  text: string
  slug: string
}

export function collectHeadingAnchors(markdown: string): HeadingAnchor[] {
  const anchors: HeadingAnchor[] = []
  const usedSlugs = new Map<string, number>()
  const lines = markdown.split(/\r?\n/)
  let inFence = false
  let fenceMarker = ''

  lines.forEach((line, lineIndex) => {
    const fenceMatch = /^(\s*)(`{3,}|~{3,})/.exec(line)

    if (fenceMatch) {
      const marker = fenceMatch[2][0]

      if (!inFence) {
        inFence = true
        fenceMarker = marker
        return
      }

      if (marker === fenceMarker) {
        inFence = false
        fenceMarker = ''
      }

      return
    }

    if (inFence) {
      return
    }

    const headingMatch = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)

    if (!headingMatch) {
      return
    }

    const text = headingMatch[2].trim()
    const baseSlug = slugifyHeading(text) || `heading-${anchors.length + 1}`
    const usedCount = usedSlugs.get(baseSlug) ?? 0
    usedSlugs.set(baseSlug, usedCount + 1)

    anchors.push({
      index: anchors.length,
      line: lineIndex + 1,
      level: headingMatch[1].length,
      text,
      slug: usedCount > 0 ? `${baseSlug}-${usedCount + 1}` : baseSlug
    })
  })

  return anchors
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~[\](){}<>\\]/g, '')
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
