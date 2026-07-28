import type { CodeLanguageMeta } from '../markdown/codeLanguage'

export interface CodeBlockShell {
  dom: HTMLElement
  toolbar: HTMLElement
  toolbarTitle: HTMLElement
  languageLabel: HTMLElement
  actions: HTMLElement
  toggleWrapButton: HTMLButtonElement
  copyButton: HTMLButtonElement
  foldButton: HTMLButtonElement
  pre: HTMLElement
  lineNumbers: HTMLElement
  content: HTMLElement
}

interface CreateCodeBlockShellOptions {
  extraClassName?: string
  foldable?: boolean
}

export function createCodeBlockShell(options: CreateCodeBlockShellOptions = {}): CodeBlockShell {
  const dom = document.createElement('figure')
  const toolbar = document.createElement('figcaption')
  const toolbarTitle = document.createElement('span')
  const toolbarTitleMark = document.createElement('span')
  const languageLabel = document.createElement('span')
  const actions = document.createElement('span')
  const toggleWrapButton = document.createElement('button')
  const copyButton = document.createElement('button')
  const foldButton = document.createElement('button')
  const pre = document.createElement('pre')
  const lineNumbers = document.createElement('span')
  const content = document.createElement('span')

  dom.className = ['markdown-code-block', options.extraClassName].filter(Boolean).join(' ')
  toolbar.className = 'markdown-code-toolbar'
  toolbar.contentEditable = 'false'
  toolbarTitle.className = 'markdown-code-title'
  toolbarTitleMark.className = 'markdown-code-title-mark'
  toolbarTitleMark.setAttribute('aria-hidden', 'true')
  languageLabel.className = 'markdown-code-language'
  actions.className = 'markdown-code-actions'
  toggleWrapButton.className = 'markdown-code-action markdown-code-action-wrap'
  toggleWrapButton.type = 'button'
  toggleWrapButton.dataset.codeAction = 'wrap'
  toggleWrapButton.title = '自动换行'
  toggleWrapButton.setAttribute('aria-label', '自动换行')
  toggleWrapButton.setAttribute('aria-pressed', 'false')
  toggleWrapButton.append(document.createElement('span'))
  toggleWrapButton.querySelector('span')!.textContent = '自动换行'
  copyButton.className = 'markdown-code-action markdown-code-action-copy'
  copyButton.type = 'button'
  copyButton.dataset.codeAction = 'copy'
  copyButton.title = '复制代码'
  copyButton.setAttribute('aria-label', '复制代码')
  copyButton.append(document.createElement('span'))
  copyButton.querySelector('span')!.textContent = '复制'
  foldButton.className = 'markdown-code-title-fold markdown-code-action-fold'
  foldButton.type = 'button'
  foldButton.dataset.codeAction = 'fold'
  foldButton.title = '折叠代码块'
  foldButton.setAttribute('aria-label', '折叠代码块')
  foldButton.setAttribute('aria-pressed', 'false')
  foldButton.append(document.createElement('span'))
  foldButton.querySelector('span')!.textContent = '折叠'
  pre.className = 'markdown-code-pre'
  lineNumbers.className = 'markdown-code-line-numbers'
  lineNumbers.setAttribute('aria-hidden', 'true')
  content.className = 'markdown-code-content'

  toolbarTitle.append(foldButton, toolbarTitleMark, languageLabel)
  actions.append(toggleWrapButton, copyButton)

  if (options.foldable === false) {
    foldButton.hidden = true
  }
  pre.append(lineNumbers, content)
  toolbar.append(toolbarTitle, actions)
  dom.append(toolbar, pre)

  return {
    dom,
    toolbar,
    toolbarTitle,
    languageLabel,
    actions,
    toggleWrapButton,
    copyButton,
    foldButton,
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
