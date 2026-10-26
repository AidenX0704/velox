import { Toast } from '../../../ui'
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
    // The checkmark is the visual confirmation; a toast on top of it is double
    // feedback. Screen readers still need a signal, so use a live region.
    announceToScreenReader('代码已复制')
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

const copiedTimers = new WeakMap<HTMLElement, number>()

/** Visually hidden live region shared by all silent confirmations. */
function announceToScreenReader(message: string): void {
  let region = document.getElementById('velox-live-region')

  if (!region) {
    region = document.createElement('div')
    region.id = 'velox-live-region'
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', 'polite')
    region.style.cssText =
      'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0'
    document.body.append(region)
  }

  region.textContent = message
}

function setCodeBlockCopied(codeBlock: HTMLElement): void {
  codeBlock.dataset.copyState = 'copied'
  window.clearTimeout(copiedTimers.get(codeBlock))
  // Rule 10: feedback retracts itself after 2.5s (the CSS fade is tuned to the
  // same duration, so the icon never snaps back while still visible).
  copiedTimers.set(
    codeBlock,
    window.setTimeout(() => {
      if (codeBlock.dataset.copyState === 'copied') {
        delete codeBlock.dataset.copyState
      }

      copiedTimers.delete(codeBlock)
    }, 2500)
  )
}

function decodeRawCode(rawCode: string): string {
  try {
    return decodeURIComponent(rawCode)
  } catch {
    return rawCode
  }
}
