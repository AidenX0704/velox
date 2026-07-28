import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { bundledLanguages, codeToHtml } from 'shiki/bundle/web'

const highlightedHtmlCache = new Map<string, Promise<string>>()
const maxHighlightCacheEntries = 160
const autoDetectLanguages = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'java',
  'go',
  'rust',
  'cpp',
  'csharp',
  'xml',
  'css',
  'json',
  'yaml',
  'bash',
  'sql',
  'markdown',
  'diff'
].filter((language) => Boolean(hljs.getLanguage(language)))

export function highlightCodeSync(code: string, language: string): string {
  if (!code) {
    return '&#8203;'
  }

  try {
    if (language !== 'plaintext' && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value || '&#8203;'
    }

    // Unlabelled fences are common in notes. A small language set gives useful
    // highlighting without running the full auto detector on every edit.
    if (code.length <= 30_000) {
      return hljs.highlightAuto(code, autoDetectLanguages).value || '&#8203;'
    }

    return escapeHtml(code)
  } catch {
    return escapeHtml(code) || '&#8203;'
  }
}

export function highlightCodeToHtml(code: string, language: string): Promise<string> {
  const cacheKey = `${language}\u0000${code}`
  const cached = highlightedHtmlCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const promise = highlightCodeWithShiki(code, language)

  if (highlightedHtmlCache.size >= maxHighlightCacheEntries) {
    const oldestKey = highlightedHtmlCache.keys().next().value

    if (oldestKey !== undefined) {
      highlightedHtmlCache.delete(oldestKey)
    }
  }

  highlightedHtmlCache.set(cacheKey, promise)
  return promise
}

async function highlightCodeWithShiki(code: string, language: string): Promise<string> {
  if (!isShikiLanguage(language)) {
    return renderHighlightJsCodeBlock(code, language)
  }

  try {
    const html = await codeToHtml(code || ' ', {
      lang: language,
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      defaultColor: false
    })

    return sanitizeHighlightedHtml(html)
  } catch (error) {
    console.error('Shiki highlighting failed:', error)
    return renderHighlightJsCodeBlock(code, language)
  }
}

function renderHighlightJsCodeBlock(code: string, language: string): string {
  const highlightedCode = highlightCodeSync(code, language)
  const html = `<pre class="markdown-code-fallback"><code class="hljs">${highlightedCode}</code></pre>`
  return sanitizeHighlightedHtml(html)
}

function sanitizeHighlightedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['class', 'style', 'tabindex']
  })
}

function isShikiLanguage(language: string): boolean {
  return Object.hasOwn(bundledLanguages, language)
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
