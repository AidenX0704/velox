import DOMPurify from 'dompurify'
import { createHighlighterCoreSync, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import themeLight from 'shiki/themes/github-light.mjs'
import themeDark from 'shiki/themes/github-dark.mjs'

/**
 * One highlighter for the whole app.
 *
 * v1 shipped highlight.js (full build, ~190 grammars) *and* shiki (core +
 * bundled web languages + a 622 KB oniguruma wasm) — two engines, two visual
 * results, ~1.5 MB of avoidable payload on the editor path.
 *
 * Now: shiki core with the pure-JS regex engine (no wasm), grammars loaded on
 * demand per language, light/dark themes resolved through CSS variables.
 */

const languageLoaders: Record<string, () => Promise<{ default: unknown }>> = {
  bash: () => import('shiki/langs/bash.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  dart: () => import('shiki/langs/dart.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  dockerfile: () => import('shiki/langs/dockerfile.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  graphql: () => import('shiki/langs/graphql.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  ini: () => import('shiki/langs/ini.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  jsonc: () => import('shiki/langs/jsonc.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  less: () => import('shiki/langs/less.mjs'),
  lua: () => import('shiki/langs/lua.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  powershell: () => import('shiki/langs/powershell.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  scss: () => import('shiki/langs/scss.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs')
}

const languageAliases: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  htm: 'html',
  svg: 'xml',
  md: 'markdown',
  patch: 'diff',
  yml: 'yaml',
  rs: 'rust',
  py: 'python',
  ts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  kt: 'kotlin',
  docker: 'dockerfile',
  ps: 'powershell',
  ps1: 'powershell',
  xml: 'xml'
}

type HighlightEventListener = () => void

const listeners = new Set<HighlightEventListener>()
const loading = new Set<string>()
const loaded = new Set<string>()

let highlighter: HighlighterCore | null = null

function getHighlighter(): HighlighterCore {
  highlighter ??= createHighlighterCoreSync({
    themes: [themeLight, themeDark],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true })
  })

  return highlighter
}

/** Fires whenever a grammar finished loading, so views can re-render. */
export function onHighlightLanguagesChanged(listener: HighlightEventListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function normalizeHighlightLanguage(language?: string): string | null {
  const name = String(language ?? '')
    .trim()
    .split(/\s+/)[0]
    .replace(/^\./, '')
    .toLowerCase()

  if (!name || name === 'text' || name === 'plaintext' || name === 'plain') {
    return null
  }

  const aliased = languageAliases[name] ?? name

  return aliased in languageLoaders ? aliased : null
}

export function isHighlightLanguageReady(language?: string): boolean {
  const name = normalizeHighlightLanguage(language)

  return name === null || loaded.has(name)
}

async function ensureLanguage(language: string): Promise<boolean> {
  if (loaded.has(language)) {
    return true
  }

  const loader = languageLoaders[language]

  if (!loader) {
    return false
  }

  if (loading.has(language)) {
    return false
  }

  loading.add(language)

  try {
    const module = await loader()
    await getHighlighter().loadLanguage(module.default as never)
    loaded.add(language)
    listeners.forEach((listener) => listener())
    return true
  } catch (error) {
    console.error(`Failed to load syntax grammar: ${language}`, error)
    return false
  } finally {
    loading.delete(language)
  }
}

/** Synchronous highlight for the live editor surface. */
export function highlightCodeSync(code: string, language: string): string {
  if (!code) {
    return '&#8203;'
  }

  const name = normalizeHighlightLanguage(language)

  if (!name) {
    return escapeHtml(code)
  }

  if (!loaded.has(name)) {
    // Kick off the grammar; the node view re-renders when it arrives.
    void ensureLanguage(name)
    return escapeHtml(code)
  }

  try {
    return getHighlighter().codeToHtml(code, {
      lang: name,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false
    })
  } catch (error) {
    console.error('Shiki highlighting failed:', error)
    return escapeHtml(code)
  }
}

const htmlCache = new Map<string, Promise<string>>()
const maxHighlightCacheEntries = 160

export function highlightCodeToHtml(code: string, language: string): Promise<string> {
  const cacheKey = `${language}\u0000${code}`
  const cached = htmlCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const promise = highlightAsync(code, language)

  if (htmlCache.size >= maxHighlightCacheEntries) {
    const oldestKey = htmlCache.keys().next().value

    if (oldestKey !== undefined) {
      htmlCache.delete(oldestKey)
    }
  }

  htmlCache.set(cacheKey, promise)
  return promise
}

async function highlightAsync(code: string, language: string): Promise<string> {
  const name = normalizeHighlightLanguage(language)

  if (name) {
    await ensureLanguage(name)
  }

  const html = highlightCodeSync(code, language)

  return name ? sanitizeHighlightedHtml(html) : html
}

function sanitizeHighlightedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['class', 'style', 'tabindex']
  })
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
