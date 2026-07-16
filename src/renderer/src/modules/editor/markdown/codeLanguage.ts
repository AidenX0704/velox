export interface CodeLanguageMeta {
  displayName: string
  highlightLanguage: string
  cssLanguage: string
  kind: string
}

export const commonCodeLanguages = [
  'text',
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'rust',
  'kotlin',
  'swift',
  'cpp',
  'c',
  'csharp',
  'html',
  'css',
  'json',
  'yaml',
  'markdown',
  'sql',
  'bash',
  'powershell',
  'dockerfile',
  'diff',
  'mermaid'
] as const

const languageAliases: Record<string, string> = {
  text: 'plaintext',
  cjs: 'javascript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  ps: 'powershell',
  ps1: 'powershell',
  yml: 'yaml',
  md: 'markdown',
  htm: 'xml',
  html: 'xml',
  svg: 'xml',
  vue: 'xml',
  patch: 'diff',
  mmd: 'mermaid'
}

const displayNames: Record<string, string> = {
  bash: 'shell',
  plaintext: 'text',
  typescript: 'ts',
  javascript: 'js',
  xml: 'html'
}

export function getCodeLanguageMeta(language?: string): CodeLanguageMeta {
  const requestedLanguage = normalizeLanguageName(language)
  const aliasedLanguage = languageAliases[requestedLanguage] ?? requestedLanguage
  // Use aliasedLanguage directly for highlighting, Shiki and HLJS fallbacks are handled in the rendering layer
  const highlightLanguage = aliasedLanguage || 'plaintext'
  const displayName = requestedLanguage || displayNames[highlightLanguage] || highlightLanguage

  return {
    displayName,
    highlightLanguage,
    cssLanguage: toCssIdentifier(highlightLanguage),
    kind: getLanguageKind(aliasedLanguage || highlightLanguage)
  }
}

function normalizeLanguageName(language?: string): string {
  return String(language ?? '')
    .trim()
    .split(/\s+/)[0]
    .replace(/^\./, '')
    .toLowerCase()
}

function toCssIdentifier(language: string): string {
  return language.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'plaintext'
}

function getLanguageKind(language: string): string {
  if (language === 'mermaid') {
    return 'diagram'
  }

  if (['javascript', 'typescript', 'python', 'ruby', 'php', 'lua', 'perl'].includes(language)) {
    return 'script'
  }

  if (['xml', 'html', 'vue', 'svg'].includes(language)) {
    return 'markup'
  }

  if (['css', 'scss', 'sass', 'less'].includes(language)) {
    return 'style'
  }

  if (['json', 'yaml', 'toml', 'ini', 'properties', 'dockerfile'].includes(language)) {
    return 'config'
  }

  if (['bash', 'shell', 'zsh', 'powershell', 'bat', 'cmd'].includes(language)) {
    return 'terminal'
  }

  if (['sql', 'graphql'].includes(language)) {
    return 'data'
  }

  if (['diff', 'patch'].includes(language)) {
    return 'diff'
  }

  if (['markdown', 'md'].includes(language)) {
    return 'prose'
  }

  if (
    [
      'c',
      'cpp',
      'csharp',
      'dart',
      'go',
      'java',
      'kotlin',
      'objectivec',
      'rust',
      'scala',
      'swift'
    ].includes(language)
  ) {
    return 'programming'
  }

  return 'plain'
}
