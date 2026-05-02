import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { NodeView } from 'prosemirror-view'
import { applyCodeBlockMeta } from '../../rendering/codeBlockModel'
import { applyCodeLayerLanguage, createCodeBlockShell } from '../../rendering/codeBlockDom'
import { highlightCodeSync } from '../../rendering/codeHighlight'

export function createCodeBlockNodeView(initialNode: ProseMirrorNode): NodeView {
  let currentNode = initialNode
  const shell = createCodeBlockShell({ extraClassName: 'preview-edit-code-block', foldable: false })
  const highlightLayer = document.createElement('code')
  const contentDOM = document.createElement('code')

  highlightLayer.className = 'markdown-code-highlight-layer hljs'
  highlightLayer.setAttribute('aria-hidden', 'true')
  contentDOM.className = 'markdown-code-editor-layer hljs'
  contentDOM.dataset.rawCode = ''
  contentDOM.spellcheck = false
  contentDOM.setAttribute('autocorrect', 'off')
  contentDOM.setAttribute('autocomplete', 'off')
  contentDOM.setAttribute('autocapitalize', 'off')
  contentDOM.setAttribute('translate', 'no')

  shell.copyButton.addEventListener('mousedown', stopCodeButtonMouseDown)
  shell.pre.append(highlightLayer, contentDOM)

  updateCodeBlockDom(shell.dom, shell.languageLabel, highlightLayer, contentDOM, currentNode)

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
      updateCodeBlockDom(shell.dom, shell.languageLabel, highlightLayer, contentDOM, currentNode)
      return true
    }
  }
}

function updateCodeBlockDom(
  dom: HTMLElement,
  languageLabel: HTMLElement,
  highlightLayer: HTMLElement,
  contentDOM: HTMLElement,
  node: ProseMirrorNode
): void {
  const languageMeta = applyCodeBlockMeta(dom, languageLabel, getCodeBlockLanguage(node))
  applyCodeLayerLanguage(highlightLayer, 'markdown-code-highlight-layer', languageMeta)
  highlightLayer.innerHTML = highlightCodeSync(node.textContent, languageMeta.highlightLanguage)
  applyCodeLayerLanguage(contentDOM, 'markdown-code-editor-layer', languageMeta)
  contentDOM.dataset.rawCode = encodeURIComponent(node.textContent)
  contentDOM.style.setProperty('--code-language', languageMeta.displayName)
}

function getCodeBlockLanguage(node: ProseMirrorNode): string {
  const params = String(node.attrs.params ?? '').trim()
  return params.split(/\s+/)[0] || 'text'
}

function stopCodeButtonMouseDown(event: Event): void {
  event.stopPropagation()
}
