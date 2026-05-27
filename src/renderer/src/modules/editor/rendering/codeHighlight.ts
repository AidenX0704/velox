import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { bundledLanguages, codeToHtml } from 'shiki/bundle/web'

const highlightedHtmlCache = new Map<string, Promise<string>>()

export function highlightCodeSync(code: string, language: string): string {
  try {
    const highlightedCode =
      language === 'plaintext' ? escapeHtml(code) : hljs.highlight(code, { language }).value
    return highlightedCode || '&#8203;'
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
  highlightedHtmlCache.set(cacheKey, promise)
  return promise
}

async function highlightCodeWithShiki(code: string, language: string): Promise<string> {
  if (!isShikiLanguage(language)) {
    return renderPlainCodeBlock(code)
  }

  try {
    const isDark =
      document.documentElement.dataset.colorMode === 'dark' ||
      document.body.classList.contains('dark') ||
      document.body.getAttribute('theme-mode') === 'dark'
    const theme = isDark ? 'github-dark' : 'github-light'

    const html = await codeToHtml(code || ' ', {
      lang: language,
      theme: theme
    })

    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['class', 'style']
    })
  } catch (error) {
    console.error('Shiki highlighting failed:', error)
    return renderPlainCodeBlock(code)
  }
}

function renderPlainCodeBlock(code: string): string {
  return `<pre class="shiki markdown-code-fallback"><code>${escapeHtml(code)}</code></pre>`
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
