import type { CodeLanguageMeta } from '../markdown/codeLanguage'

export interface CodeBlockShell {
  dom: HTMLElement
  toolbar: HTMLElement
  languageLabel: HTMLElement
  actions: HTMLElement
  copyButton: HTMLButtonElement
  foldButton: HTMLButtonElement
  pre: HTMLElement
}

interface CreateCodeBlockShellOptions {
  extraClassName?: string
  foldable?: boolean
}

export function createCodeBlockShell(options: CreateCodeBlockShellOptions = {}): CodeBlockShell {
  const dom = document.createElement('figure')
  const toolbar = document.createElement('figcaption')
  const languageLabel = document.createElement('span')
  const actions = document.createElement('span')
  const copyButton = document.createElement('button')
  const foldButton = document.createElement('button')
  const pre = document.createElement('pre')

  dom.className = ['markdown-code-block', options.extraClassName].filter(Boolean).join(' ')
  toolbar.className = 'markdown-code-toolbar'
  toolbar.contentEditable = 'false'
  languageLabel.className = 'markdown-code-language'
  actions.className = 'markdown-code-actions'
  copyButton.className = 'markdown-code-action markdown-code-action-copy'
  copyButton.type = 'button'
  copyButton.dataset.codeAction = 'copy'
  copyButton.title = '复制代码'
  copyButton.setAttribute('aria-label', '复制代码')
  copyButton.append(document.createElement('span'))
  copyButton.querySelector('span')!.textContent = '复制'
  foldButton.className = 'markdown-code-action markdown-code-action-fold'
  foldButton.type = 'button'
  foldButton.dataset.codeAction = 'fold'
  foldButton.title = '折叠代码块'
  foldButton.setAttribute('aria-label', '折叠代码块')
  foldButton.setAttribute('aria-pressed', 'false')
  foldButton.append(document.createElement('span'))
  foldButton.querySelector('span')!.textContent = '折叠'
  pre.className = 'markdown-code-pre'

  actions.append(copyButton)

  if (options.foldable !== false) {
    actions.append(foldButton)
  }
  toolbar.append(languageLabel, actions)
  dom.append(toolbar, pre)

  return {
    dom,
    toolbar,
    languageLabel,
    actions,
    copyButton,
    foldButton,
    pre
  }
}

export function applyCodeLayerLanguage(
  element: HTMLElement,
  baseClassName: string,
  meta: CodeLanguageMeta
): void {
  element.className = `${baseClassName} hljs language-${meta.cssLanguage}`
}
