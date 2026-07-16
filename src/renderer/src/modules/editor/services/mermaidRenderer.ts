export type MermaidColorMode = 'light' | 'dark'

export interface MermaidRenderResult {
  svg: string
  diagramType: string
}

let renderSequence = Promise.resolve()
let diagramId = 0

export function isMermaidLanguage(language?: string): boolean {
  const normalized = String(language ?? '')
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()

  return normalized === 'mermaid' || normalized === 'mmd'
}

export function getMermaidColorMode(): MermaidColorMode {
  return document.documentElement.dataset.colorMode === 'dark' ? 'dark' : 'light'
}

export async function renderMermaidDiagram(
  definition: string,
  colorMode: MermaidColorMode = getMermaidColorMode()
): Promise<MermaidRenderResult> {
  const source = definition.trim()

  if (!source) {
    throw new Error('图表内容为空')
  }

  const renderTask = renderSequence.then(async () => {
    const { default: mermaid } = await import('mermaid')
    const accentColor = getThemeAccentColor()

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      htmlLabels: false,
      theme: 'base',
      darkMode: colorMode === 'dark',
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif",
      themeVariables: createThemeVariables(colorMode, accentColor),
      flowchart: {
        useMaxWidth: true,
        curve: 'basis'
      }
    })

    await mermaid.parse(source)

    const result = await mermaid.render(`velox-mermaid-${++diagramId}`, source)

    return {
      svg: result.svg,
      diagramType: result.diagramType
    }
  })

  renderSequence = renderTask.then(
    () => undefined,
    () => undefined
  )

  return renderTask
}

export function getMermaidErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const firstLine = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  return firstLine || '无法解析图表，请检查 Mermaid 语法。'
}

function getThemeAccentColor(): string {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim()

  return /^#[\da-f]{6}$/i.test(color) ? color : '#1677ff'
}

function createThemeVariables(
  colorMode: MermaidColorMode,
  accentColor: string
): Record<string, string> {
  if (colorMode === 'dark') {
    return {
      background: '#171a20',
      primaryColor: '#252b36',
      primaryTextColor: '#f1f5f9',
      primaryBorderColor: accentColor,
      secondaryColor: '#202a2d',
      secondaryTextColor: '#e2e8f0',
      secondaryBorderColor: '#3b4b52',
      tertiaryColor: '#29263a',
      tertiaryTextColor: '#e9e5ff',
      tertiaryBorderColor: '#514b73',
      lineColor: '#94a3b8',
      textColor: '#e2e8f0',
      mainBkg: '#252b36',
      nodeBorder: accentColor,
      clusterBkg: '#1d222b',
      clusterBorder: '#475569',
      edgeLabelBackground: '#171a20',
      noteBkgColor: '#312f24',
      noteTextColor: '#f8fafc',
      noteBorderColor: '#766d45'
    }
  }

  return {
    background: '#ffffff',
    primaryColor: '#f1f6ff',
    primaryTextColor: '#172033',
    primaryBorderColor: accentColor,
    secondaryColor: '#eef8f4',
    secondaryTextColor: '#17372d',
    secondaryBorderColor: '#8bb9a9',
    tertiaryColor: '#f7f4ff',
    tertiaryTextColor: '#332a4c',
    tertiaryBorderColor: '#b9add8',
    lineColor: '#64748b',
    textColor: '#27364b',
    mainBkg: '#f1f6ff',
    nodeBorder: accentColor,
    clusterBkg: '#f8fafc',
    clusterBorder: '#cbd5e1',
    edgeLabelBackground: '#ffffff',
    noteBkgColor: '#fff9db',
    noteTextColor: '#3f3a24',
    noteBorderColor: '#d6c875'
  }
}
