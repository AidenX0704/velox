import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'
import { commonCodeLanguages, getCodeLanguageMeta } from '../../markdown/codeLanguage'
import { createCodeBlockShell } from '../../rendering/codeBlockDom'
import { highlightCodeSync } from '../../rendering/codeHighlight'

export function createCodeBlockNodeView(
  initialNode: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined
): NodeView {
  let currentNode = initialNode
  const shell = createCodeBlockShell({ extraClassName: 'preview-edit-code-block', foldable: false })
  const languageSelect = createLanguageSelect(getCodeBlockLanguage(currentNode))
  const highlightLayer = document.createElement('code')
  const contentDOM = document.createElement('code')

  highlightLayer.className = 'markdown-code-highlight-layer hljs'
  highlightLayer.setAttribute('aria-hidden', 'true')
  highlightLayer.contentEditable = 'false'
  contentDOM.className = 'markdown-code-editor-layer'
  contentDOM.dataset.rawCode = ''
  contentDOM.spellcheck = false
  contentDOM.setAttribute('autocorrect', 'off')
  contentDOM.setAttribute('autocomplete', 'off')
  contentDOM.setAttribute('autocapitalize', 'off')
  contentDOM.setAttribute('translate', 'no')

  shell.languageLabel.replaceWith(languageSelect)
  shell.copyButton.addEventListener('mousedown', stopCodeButtonMouseDown)
  languageSelect.addEventListener('change', () => {
    const position = getPos()

    if (position === undefined) {
      return
    }

    const language = normalizeSelectedLanguage(languageSelect.value)
    // IMPORTANT: Dispatch transaction to update the underlying document model
    view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...currentNode.attrs, params: language }))
    view.focus()
  })
  shell.pre.append(highlightLayer, contentDOM)
  contentDOM.addEventListener('scroll', () => {
    highlightLayer.style.transform = `translate(${-contentDOM.scrollLeft}px, ${-contentDOM.scrollTop}px)`
  })

  updateCodeBlockDom(shell.dom, languageSelect, highlightLayer, contentDOM, currentNode)

  return {
    dom: shell.dom,
    contentDOM,
    stopEvent(event) {
      if (!(event.target instanceof HTMLElement)) {
        return false
      }

      return Boolean(event.target.closest('.markdown-code-toolbar'))
    },
    update(nextNode) {
      if (nextNode.type !== initialNode.type) {
        return false
      }

      currentNode = nextNode
      updateCodeBlockDom(shell.dom, languageSelect, highlightLayer, contentDOM, currentNode)
      return true
    }
  }
}

function updateCodeBlockDom(
  dom: HTMLElement,
  languageSelect: HTMLSelectElement,
  highlightLayer: HTMLElement,
  contentDOM: HTMLElement,
  node: ProseMirrorNode
): void {
  const language = getCodeBlockLanguage(node)
  const languageMeta = getCodeLanguageMeta(language)
  
  // Update UI metadata
  dom.dataset.language = languageMeta.displayName
  dom.dataset.languageKind = languageMeta.kind
  
  // Sync select value
  languageSelect.value = getSelectLanguageValue(language)
  
  // Apply highlighting
  highlightLayer.innerHTML = highlightCodeSync(node.textContent, languageMeta.highlightLanguage)
  
  // Sync content metadata
  contentDOM.dataset.rawCode = encodeURIComponent(node.textContent)
  contentDOM.style.setProperty('--code-language', languageMeta.displayName)
}

function getCodeBlockLanguage(node: ProseMirrorNode): string {
  const params = String(node.attrs.params ?? '').trim()
  return params.split(/\s+/)[0] || 'text'
}

function createLanguageSelect(language: string): HTMLSelectElement {
  const select = document.createElement('select')
  select.className = 'markdown-code-language markdown-code-language-select'
  select.title = '切换代码语言'
  select.contentEditable = 'false'
  select.setAttribute('aria-label', '切换代码语言')
  const normalizedLanguage = normalizeSelectedLanguage(language)
  const languageOptions = commonCodeLanguages.includes(
    normalizedLanguage as (typeof commonCodeLanguages)[number]
  )
    ? commonCodeLanguages
    : [normalizedLanguage, ...commonCodeLanguages]

  for (const optionLanguage of languageOptions) {
    const option = document.createElement('option')
    const meta = getCodeLanguageMeta(optionLanguage)
    option.value = optionLanguage
    option.textContent = meta.displayName
    select.append(option)
  }

  select.value = getSelectLanguageValue(language)
  return select
}

function getSelectLanguageValue(language: string): string {
  const normalized = normalizeSelectedLanguage(language)
  return normalized || 'text'
}

function normalizeSelectedLanguage(language: string): string {
  const normalized = language.trim().toLowerCase()
  return normalized === 'text' || normalized === 'plaintext' ? 'text' : normalized
}

function stopCodeButtonMouseDown(event: Event): void {
  event.stopPropagation()
}
