import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { NodeView } from 'prosemirror-view'
import {
  isLocalDocumentImageSource,
  resolveDocumentImageSource,
  type DocumentImageContext
} from '../../services/documentImage'

export interface ResolvableImageNodeView extends NodeView {
  refreshSource: () => void
}

export function createImageNodeView(
  initialNode: ProseMirrorNode,
  getContext: () => DocumentImageContext,
  onDestroy?: (nodeView: ResolvableImageNodeView) => void
): ResolvableImageNodeView {
  let currentNode = initialNode
  let resolveRequest = 0
  let destroyed = false
  const dom = document.createElement('img')

  dom.loading = 'lazy'
  dom.decoding = 'async'

  const refreshSource = (): void => {
    const src = String(currentNode.attrs.src ?? '')
    const request = ++resolveRequest

    dom.dataset.markdownImageSource = src

    if (!src) {
      dom.removeAttribute('src')
      dom.dataset.imageState = 'error'
      return
    }

    if (!isLocalDocumentImageSource(src)) {
      dom.src = src
      delete dom.dataset.imageState
      return
    }

    dom.removeAttribute('src')
    dom.dataset.imageState = 'loading'

    void resolveDocumentImageSource(src, getContext()).then((resolvedSrc) => {
      if (destroyed || request !== resolveRequest) {
        return
      }

      if (resolvedSrc) {
        dom.src = resolvedSrc
        dom.dataset.imageState = 'loaded'
      } else {
        dom.removeAttribute('src')
        dom.dataset.imageState = 'error'
      }
    })
  }

  const updateAttributes = (): void => {
    const alt = String(currentNode.attrs.alt ?? '')
    const title = currentNode.attrs.title

    dom.alt = alt

    if (title) {
      dom.title = String(title)
    } else {
      dom.removeAttribute('title')
    }
  }

  const nodeView: ResolvableImageNodeView = {
    dom,
    refreshSource,
    update(nextNode) {
      if (nextNode.type !== initialNode.type) {
        return false
      }

      const sourceChanged = nextNode.attrs.src !== currentNode.attrs.src
      currentNode = nextNode
      updateAttributes()

      if (sourceChanged) {
        refreshSource()
      }

      return true
    },
    ignoreMutation() {
      return true
    },
    destroy() {
      destroyed = true
      resolveRequest += 1
      onDestroy?.(nodeView)
    }
  }

  updateAttributes()
  refreshSource()
  return nodeView
}
