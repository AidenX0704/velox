import type { CodeLanguageMeta } from '../markdown/codeLanguage'

export interface CodeBlockShell {
  dom: HTMLElement
  toolbar: HTMLElement
  toolbarTitle: HTMLElement
  languageLabel: HTMLElement
  actions: HTMLElement
  copyButton: HTMLButtonElement
  pre: HTMLElement
  lineNumbers: HTMLElement
  content: HTMLElement
}

interface CreateCodeBlockShellOptions {
  extraClassName?: string
}

export function createCodeBlockShell(options: CreateCodeBlockShellOptions = {}): CodeBlockShell {
  const dom = document.createElement('figure')
  const toolbar = document.createElement('figcaption')
  const toolbarTitle = document.createElement('span')
  const languageLabel = document.createElement('span')
  const actions = document.createElement('span')
  const copyButton = document.createElement('button')
  const pre = document.createElement('pre')
  const lineNumbers = document.createElement('span')
  const content = document.createElement('span')

  dom.className = ['markdown-code-block', options.extraClassName].filter(Boolean).join(' ')
  toolbar.className = 'markdown-code-toolbar'
  toolbar.contentEditable = 'false'
  toolbarTitle.className = 'markdown-code-title'
  languageLabel.className = 'markdown-code-language'
  actions.className = 'markdown-code-actions'
  copyButton.className = 'markdown-code-action markdown-code-action-copy'
  copyButton.type = 'button'
  copyButton.dataset.codeAction = 'copy'
  copyButton.title = '复制代码'
  copyButton.setAttribute('aria-label', '复制代码')
  copyButton.append(document.createElement('span'))
  copyButton.querySelector('span')!.textContent = '复制'
  pre.className = 'markdown-code-pre'
  lineNumbers.className = 'markdown-code-line-numbers'
  lineNumbers.setAttribute('aria-hidden', 'true')
  content.className = 'markdown-code-content'

  toolbarTitle.append(languageLabel)
  actions.append(copyButton)
  pre.append(lineNumbers, content)
  toolbar.append(toolbarTitle, actions)
  dom.append(toolbar, pre)

  return {
    dom,
    toolbar,
    toolbarTitle,
    languageLabel,
    actions,
    copyButton,
    pre,
    lineNumbers,
    content
  }
}

export function applyCodeLayerLanguage(
  element: HTMLElement,
  baseClassName: string,
  meta: CodeLanguageMeta
): void {
  element.className = `${baseClassName} hljs language-${meta.cssLanguage}`
}
