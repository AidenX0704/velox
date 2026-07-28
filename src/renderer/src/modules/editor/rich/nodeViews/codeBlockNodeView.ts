import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'
import {
  commonCodeLanguages,
  getCodeLanguageMeta,
  type CodeLanguageMeta
} from '../../markdown/codeLanguage'
import { createCodeBlockShell } from '../../rendering/codeBlockDom'
import { highlightCodeSync } from '../../rendering/codeHighlight'
import { handleCodeBlockAction } from '../../rendering/blockActions'
import { renderCodeLineNumbers, getCodeLineCount } from '../../rendering/codeBlockModel'
import {
  getMermaidColorMode,
  getMermaidErrorMessage,
  isMermaidLanguage,
  renderMermaidDiagram
} from '../../services/mermaidRenderer'

export function createCodeBlockNodeView(
  initialNode: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined
): NodeView {
  let currentNode = initialNode
  const shell = createCodeBlockShell({ extraClassName: 'preview-edit-code-block' })
  const languagePicker = createLanguagePicker(getCodeBlockLanguage(currentNode), (language) => {
    const position = getPos()

    if (position === undefined) {
      return
    }

    view.dispatch(
      view.state.tr.setNodeMarkup(position, undefined, { ...currentNode.attrs, params: language })
    )
    view.focus()
  })
  const highlightLayer = document.createElement('code')
  const contentDOM = document.createElement('code')
  const diagramPanel = document.createElement('div')
  const diagramCanvas = document.createElement('div')
  const diagramStatus = document.createElement('div')
  const diagramStatusTitle = document.createElement('strong')
  const diagramStatusMessage = document.createElement('span')
  const diagramToggleButton = document.createElement('button')
  const diagramToggleLabel = document.createElement('span')
  let lastRenderedCode = ''
  let lastRenderedHighlightLanguage = ''
  let diagramRenderTimer: number | undefined
  let diagramRenderRequest = 0

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
  diagramPanel.className = 'markdown-diagram-panel'
  diagramPanel.contentEditable = 'false'
  diagramPanel.hidden = true
  diagramPanel.setAttribute('aria-label', 'Mermaid 图表预览')
  diagramCanvas.className = 'markdown-diagram-canvas'
  diagramCanvas.setAttribute('role', 'img')
  diagramStatus.className = 'markdown-diagram-panel-status'
  diagramStatusTitle.textContent = '正在渲染图表…'
  diagramStatus.append(diagramStatusTitle, diagramStatusMessage)
  diagramPanel.append(diagramCanvas, diagramStatus)
  diagramToggleButton.className = 'markdown-code-action markdown-code-action-diagram'
  diagramToggleButton.type = 'button'
  diagramToggleButton.hidden = true
  diagramToggleButton.append(diagramToggleLabel)

  shell.languageLabel.replaceWith(languagePicker.dom)
  shell.actions.insertBefore(diagramToggleButton, shell.toggleWrapButton)
  shell.foldButton.addEventListener('click', handleCodeActionClick)
  shell.foldButton.addEventListener('mousedown', stopCodeButtonMouseDown)
  shell.copyButton.addEventListener('click', handleCodeActionClick)
  shell.copyButton.addEventListener('mousedown', stopCodeButtonMouseDown)
  shell.toggleWrapButton.addEventListener('click', handleCodeActionClick)
  shell.toggleWrapButton.addEventListener('mousedown', stopCodeButtonMouseDown)
  diagramToggleButton.addEventListener('click', handleDiagramToggleClick)
  diagramToggleButton.addEventListener('mousedown', stopCodeButtonMouseDown)
  shell.content.append(highlightLayer, contentDOM)
  shell.dom.insertBefore(diagramPanel, shell.pre)
  const syncRenderedCode = (): void => {
    const code = contentDOM.textContent ?? ''
    const language = getCodeBlockLanguage(currentNode)
    const languageMeta = getCodeLanguageMeta(language)
    const lineCount = getCodeLineCount(code)

    contentDOM.dataset.rawCode = encodeURIComponent(code)
    contentDOM.style.setProperty('--code-language', languageMeta.displayName)
    shell.dom.dataset.lineCount = String(lineCount)
    shell.lineNumbers.textContent = renderCodeLineNumbers(lineCount)

    if (
      code !== lastRenderedCode ||
      languageMeta.highlightLanguage !== lastRenderedHighlightLanguage
    ) {
      lastRenderedCode = code
      lastRenderedHighlightLanguage = languageMeta.highlightLanguage
      highlightLayer.innerHTML = highlightCodeSync(code, languageMeta.highlightLanguage)
    }

    scheduleDiagramRender(code, language)
  }
  const contentObserver = new MutationObserver(syncRenderedCode)
  contentObserver.observe(contentDOM, {
    characterData: true,
    childList: true,
    subtree: true
  })
  contentDOM.addEventListener('scroll', () => {
    highlightLayer.style.transform = `translate(${-contentDOM.scrollLeft}px, ${-contentDOM.scrollTop}px)`
  })
  shell.content.addEventListener('scroll', () => {
    contentDOM.scrollLeft = shell.content.scrollLeft
    contentDOM.scrollTop = shell.content.scrollTop
    highlightLayer.style.transform = `translate(${-shell.content.scrollLeft}px, ${-shell.content.scrollTop}px)`
  })
  const themeObserver = new MutationObserver(() => {
    scheduleDiagramRender(contentDOM.textContent ?? '', getCodeBlockLanguage(currentNode), 0)
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-color-mode', 'style']
  })

  updateCodeBlockDom(
    shell.dom,
    shell.lineNumbers,
    languagePicker,
    highlightLayer,
    contentDOM,
    currentNode
  )

  return {
    dom: shell.dom,
    contentDOM,
    stopEvent(event) {
      if (!(event.target instanceof HTMLElement)) {
        return false
      }

      return Boolean(event.target.closest('.markdown-code-toolbar, .markdown-code-language-menu'))
    },
    update(nextNode) {
      if (nextNode.type !== initialNode.type) {
        return false
      }

      currentNode = nextNode
      updateCodeBlockDom(
        shell.dom,
        shell.lineNumbers,
        languagePicker,
        highlightLayer,
        contentDOM,
        currentNode
      )
      syncRenderedCode()
      return true
    },
    ignoreMutation(mutation) {
      if (mutation.type === 'selection') {
        return false
      }

      const target = mutation.target

      if (!(target instanceof Node)) {
        return true
      }

      if (target === contentDOM || contentDOM.contains(target)) {
        return mutation.type === 'attributes'
      }

      return true
    },
    destroy() {
      diagramRenderRequest += 1
      window.clearTimeout(diagramRenderTimer)
      themeObserver.disconnect()
      contentObserver.disconnect()
      shell.foldButton.removeEventListener('click', handleCodeActionClick)
      shell.copyButton.removeEventListener('click', handleCodeActionClick)
      shell.toggleWrapButton.removeEventListener('click', handleCodeActionClick)
      diagramToggleButton.removeEventListener('click', handleDiagramToggleClick)
      diagramToggleButton.removeEventListener('mousedown', stopCodeButtonMouseDown)
      languagePicker.destroy()
    }
  }

  function handleCodeActionClick(event: Event): void {
    event.preventDefault()
    event.stopPropagation()

    if (event.currentTarget instanceof HTMLButtonElement) {
      handleCodeBlockAction(event.currentTarget)
    }
  }

  function handleDiagramToggleClick(event: Event): void {
    event.preventDefault()
    event.stopPropagation()

    const nextView = shell.dom.dataset.diagramView === 'source' ? 'preview' : 'source'
    setDiagramView(nextView)
    view.focus()
  }

  function setDiagramView(nextView: 'preview' | 'source'): void {
    shell.dom.dataset.diagramView = nextView
    diagramToggleButton.title = nextView === 'preview' ? '查看 Mermaid 源码' : '查看渲染图表'
    diagramToggleButton.setAttribute('aria-label', diagramToggleButton.title)
    diagramToggleLabel.textContent = nextView === 'preview' ? '查看源码' : '查看图表'
    shell.toggleWrapButton.hidden = nextView === 'preview'
  }

  function scheduleDiagramRender(code: string, language: string, delay = 260): void {
    const isDiagram = isMermaidLanguage(language)
    const wasDiagram = shell.dom.dataset.diagram === 'true'

    shell.dom.dataset.diagram = String(isDiagram)
    diagramPanel.hidden = !isDiagram
    diagramToggleButton.hidden = !isDiagram

    if (isDiagram) {
      setDiagramView(wasDiagram ? getDiagramView(shell.dom) : 'preview')
    } else {
      shell.dom.removeAttribute('data-diagram-view')
      shell.toggleWrapButton.hidden = false
    }

    window.clearTimeout(diagramRenderTimer)

    if (!isDiagram) {
      diagramRenderRequest += 1
      diagramCanvas.replaceChildren()
      diagramPanel.removeAttribute('data-diagram-type')
      diagramPanel.dataset.diagramState = 'idle'
      return
    }

    const requestId = ++diagramRenderRequest
    diagramPanel.dataset.diagramState = diagramCanvas.childElementCount > 0 ? 'updating' : 'loading'
    diagramStatusTitle.textContent = '正在渲染图表…'
    diagramStatusMessage.textContent = ''

    diagramRenderTimer = window.setTimeout(() => {
      void renderMermaidDiagram(code, getMermaidColorMode()).then(
        (result) => {
          if (requestId !== diagramRenderRequest) {
            return
          }

          diagramCanvas.innerHTML = result.svg
          diagramPanel.dataset.diagramState = 'ready'
          diagramPanel.dataset.diagramType = result.diagramType
        },
        (error) => {
          if (requestId !== diagramRenderRequest) {
            return
          }

          diagramCanvas.replaceChildren()
          diagramPanel.dataset.diagramState = 'error'
          diagramPanel.removeAttribute('data-diagram-type')
          diagramStatusTitle.textContent = '图表渲染失败'
          diagramStatusMessage.textContent = getMermaidErrorMessage(error)
        }
      )
    }, delay)
  }
}

function getDiagramView(dom: HTMLElement): 'preview' | 'source' {
  return dom.dataset.diagramView === 'source' ? 'source' : 'preview'
}

function updateCodeBlockDom(
  dom: HTMLElement,
  lineNumbers: HTMLElement,
  languagePicker: CodeLanguagePicker,
  highlightLayer: HTMLElement,
  contentDOM: HTMLElement,
  node: ProseMirrorNode
): void {
  const language = getCodeBlockLanguage(node)
  const languageMeta = getCodeLanguageMeta(language)

  // Update UI metadata
  dom.dataset.language = languageMeta.displayName
  dom.dataset.languageKind = languageMeta.kind
  dom.dataset.lineCount = String(getCodeLineCount(node.textContent))

  // Sync language picker
  languagePicker.setValue(getSelectLanguageValue(language), languageMeta)

  // Apply highlighting
  highlightLayer.innerHTML = highlightCodeSync(node.textContent, languageMeta.highlightLanguage)

  // Sync content metadata
  contentDOM.dataset.rawCode = encodeURIComponent(node.textContent)
  contentDOM.style.setProperty('--code-language', languageMeta.displayName)
  lineNumbers.textContent = renderCodeLineNumbers(getCodeLineCount(node.textContent))
}

function getCodeBlockLanguage(node: ProseMirrorNode): string {
  const params = String(node.attrs.params ?? '').trim()
  return params.split(/\s+/)[0] || 'text'
}

interface CodeLanguagePicker {
  dom: HTMLElement
  setValue: (language: string, meta: CodeLanguageMeta) => void
  destroy: () => void
}

function createLanguagePicker(
  language: string,
  onSelect: (language: string) => void
): CodeLanguagePicker {
  const root = document.createElement('span')
  const trigger = document.createElement('button')
  const triggerText = document.createElement('span')
  const menu = document.createElement('div')
  const search = document.createElement('div')
  const searchInput = document.createElement('input')
  const list = document.createElement('div')
  const normalizedLanguage = normalizeSelectedLanguage(language)
  const languageOptions = commonCodeLanguages.includes(
    normalizedLanguage as (typeof commonCodeLanguages)[number]
  )
    ? commonCodeLanguages
    : [normalizedLanguage, ...commonCodeLanguages]
  let currentLanguage = getSelectLanguageValue(language)
  let isOpen = false

  root.className = 'markdown-code-language-picker'
  root.contentEditable = 'false'
  trigger.className = 'markdown-code-language markdown-code-language-trigger'
  trigger.type = 'button'
  trigger.title = '切换代码语言'
  trigger.setAttribute('aria-label', '切换代码语言')
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  trigger.append(triggerText)
  menu.className = 'markdown-code-language-menu'
  menu.hidden = true
  search.className = 'markdown-code-language-search'
  searchInput.type = 'search'
  searchInput.placeholder = '搜索'
  searchInput.setAttribute('aria-label', '搜索代码语言')
  list.className = 'markdown-code-language-list'
  list.setAttribute('role', 'listbox')
  search.append(searchInput)
  menu.append(search, list)
  root.append(trigger, menu)

  const close = (): void => {
    isOpen = false
    menu.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    searchInput.value = ''
    renderOptions('')
  }

  const open = (): void => {
    isOpen = true
    menu.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    renderOptions(searchInput.value)
    window.requestAnimationFrame(() => searchInput.focus())
  }

  const toggle = (): void => {
    if (isOpen) {
      close()
      return
    }

    open()
  }

  const handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!root.contains(event.target as Node | null)) {
      close()
    }
  }

  const renderOptions = (query: string): void => {
    const normalizedQuery = query.trim().toLowerCase()
    const filteredLanguages = languageOptions.filter((optionLanguage) => {
      const meta = getCodeLanguageMeta(optionLanguage)
      return (
        optionLanguage.includes(normalizedQuery) ||
        meta.displayName.toLowerCase().includes(normalizedQuery)
      )
    })

    list.replaceChildren()

    for (const optionLanguage of filteredLanguages) {
      const meta = getCodeLanguageMeta(optionLanguage)
      const option = document.createElement('button')
      option.className = 'markdown-code-language-option'
      option.type = 'button'
      option.dataset.value = optionLanguage
      option.setAttribute('role', 'option')
      option.setAttribute('aria-selected', String(optionLanguage === currentLanguage))
      option.textContent = meta.displayName
      option.addEventListener('click', () => {
        currentLanguage = optionLanguage
        onSelect(optionLanguage)
        close()
      })
      list.append(option)
    }

    if (filteredLanguages.length === 0) {
      const empty = document.createElement('span')
      empty.className = 'markdown-code-language-empty'
      empty.textContent = '没有匹配的语言'
      list.append(empty)
    }
  }

  trigger.addEventListener('click', toggle)
  searchInput.addEventListener('input', () => renderOptions(searchInput.value))
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      trigger.focus()
    }
  })
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  renderOptions('')

  return {
    dom: root,
    setValue(nextLanguage, meta) {
      currentLanguage = nextLanguage
      triggerText.textContent = meta.displayName
      renderOptions(searchInput.value)
    },
    destroy() {
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
    }
  }
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
