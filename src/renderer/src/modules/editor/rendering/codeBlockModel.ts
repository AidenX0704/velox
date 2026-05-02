import { Toast } from '@douyinfe/semi-ui'
import { getCodeLanguageMeta } from '../markdown/codeLanguage'
import { writeClipboardText } from '../services/clipboard'

export const codeBlockSelectors = {
  root: '.markdown-code-block',
  action: '[data-code-action]',
  editorLayer: '.markdown-code-editor-layer[data-raw-code]',
  rawCode: '[data-raw-code]'
} as const

export type CodeBlockAction = 'copy' | 'fold'

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
  const codeElement = codeBlock.querySelector<HTMLElement>(
    `${codeBlockSelectors.editorLayer}, ${codeBlockSelectors.rawCode}`
  )
  const rawCode = codeElement?.dataset.rawCode

  if (!rawCode) {
    return null
  }

  try {
    return decodeURIComponent(rawCode)
  } catch {
    return rawCode
  }
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

export function toggleCodeBlockFold(
  codeBlock: HTMLElement,
  actionButton?: HTMLButtonElement
): void {
  const collapsed = codeBlock.dataset.collapsed === 'true'
  const nextCollapsed = !collapsed
  codeBlock.dataset.collapsed = String(nextCollapsed)

  if (actionButton) {
    actionButton.title = nextCollapsed ? '展开代码块' : '折叠代码块'
    actionButton.setAttribute('aria-label', nextCollapsed ? '展开代码块' : '折叠代码块')
    actionButton.setAttribute('aria-pressed', String(nextCollapsed))
  }
}

function setCodeBlockCopied(codeBlock: HTMLElement): void {
  codeBlock.dataset.copyState = 'copied'
  window.setTimeout(() => {
    if (codeBlock.dataset.copyState === 'copied') {
      delete codeBlock.dataset.copyState
    }
  }, 1200)
}
