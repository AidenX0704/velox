import { Toast } from '@douyinfe/semi-ui'
import { getCodeLanguageMeta } from '../markdown/codeLanguage'
import { writeClipboardText } from '../services/clipboard'

export const codeBlockSelectors = {
  root: '.markdown-code-block',
  action: '[data-code-action]',
  editorLayer: '.markdown-code-editor-layer[data-raw-code]',
  rawCode: '[data-raw-code]'
} as const

export type CodeBlockAction = 'copy'

export function applyCodeBlockMeta(
  codeBlock: HTMLElement,
  languageLabel: HTMLElement,
  language?: string
): ReturnType<typeof getCodeLanguageMeta> {
  const languageMeta = getCodeLanguageMeta(language)
  codeBlock.dataset.language = languageMeta.displayName
  codeBlock.dataset.languageKind = languageMeta.kind
  languageLabel.textContent = languageMeta.displayName
  return languageMeta
}

export function readCodeBlockRawCode(codeBlock: HTMLElement): string | null {
  const editorLayer = codeBlock.querySelector<HTMLElement>(codeBlockSelectors.editorLayer)

  if (editorLayer) {
    return editorLayer.textContent ?? ''
  }

  const rawCodeElement = codeBlock.querySelector<HTMLElement>(codeBlockSelectors.rawCode)

  if (!rawCodeElement?.hasAttribute('data-raw-code')) {
    return null
  }

  const rawCode = rawCodeElement.dataset.rawCode ?? ''
  return decodeRawCode(rawCode)
}

export async function copyCodeBlock(codeBlock: HTMLElement): Promise<void> {
  const code = readCodeBlockRawCode(codeBlock)

  if (code === null) {
    Toast.error('未找到可复制的代码内容')
    return
  }

  try {
    await writeClipboardText(code)
    setCodeBlockCopied(codeBlock)
    Toast.success('代码已复制')
  } catch {
    Toast.error('复制失败')
  }
}

export function getCodeLineCount(code: string): number {
  if (!code) {
    return 1
  }

  return code.split(/\r\n|\r|\n/).length
}

export function renderCodeLineNumbers(lineCount: number): string {
  return Array.from({ length: Math.max(1, lineCount) }, (_, index) => String(index + 1)).join('\n')
}

function setCodeBlockCopied(codeBlock: HTMLElement): void {
  codeBlock.dataset.copyState = 'copied'
  window.setTimeout(() => {
    if (codeBlock.dataset.copyState === 'copied') {
      delete codeBlock.dataset.copyState
    }
  }, 1200)
}

function decodeRawCode(rawCode: string): string {
  try {
    return decodeURIComponent(rawCode)
  } catch {
    return rawCode
  }
}
