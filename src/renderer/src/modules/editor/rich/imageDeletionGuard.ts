import type { Command } from 'prosemirror-state'
import { NodeSelection, Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { Decoration, DecorationSet } from 'prosemirror-view'

interface ImageDeletionGuardState {
  armedPosition: number | null
  imageParagraphDecorations: DecorationSet
}

const imageDeletionGuardKey = new PluginKey<ImageDeletionGuardState>('imageDeletionGuard')

export function createImageDeletionGuardPlugin(): Plugin<ImageDeletionGuardState> {
  return new Plugin<ImageDeletionGuardState>({
    key: imageDeletionGuardKey,
    state: {
      init: (_config, state) => ({
        armedPosition: null,
        imageParagraphDecorations: createImageParagraphDecorations(state.doc)
      }),
      apply(transaction, current) {
        const armedPosition = transaction.getMeta(imageDeletionGuardKey) as
          | number
          | null
          | undefined
        const imageParagraphDecorations = transaction.docChanged
          ? createImageParagraphDecorations(transaction.doc)
          : current.imageParagraphDecorations

        if (armedPosition !== undefined) {
          return { armedPosition, imageParagraphDecorations }
        }

        if (transaction.docChanged || transaction.selectionSet) {
          return { armedPosition: null, imageParagraphDecorations }
        }

        return current
      }
    },
    props: {
      decorations(state) {
        const guardState = imageDeletionGuardKey.getState(state)

        if (!guardState) {
          return null
        }

        const { armedPosition, imageParagraphDecorations } = guardState

        if (armedPosition === null) {
          return imageParagraphDecorations
        }

        const node = state.doc.nodeAt(armedPosition)

        if (!node || node.type !== state.schema.nodes.image) {
          return imageParagraphDecorations
        }

        return imageParagraphDecorations.add(state.doc, [
          Decoration.node(armedPosition, armedPosition + node.nodeSize, {
            class: 'image-delete-armed',
            'data-delete-armed': 'true'
          })
        ])
      },
      handleKeyDown(view, event) {
        if (event.isComposing || (event.key !== 'Backspace' && event.key !== 'Delete')) {
          return false
        }

        const direction = event.key === 'Backspace' ? -1 : 1
        return guardImageDeletion(direction, !event.repeat)(view.state, view.dispatch, view)
      }
    }
  })
}

function createImageParagraphDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, position) => {
    if (
      node.type.name === 'paragraph' &&
      node.childCount === 1 &&
      node.firstChild?.type.name === 'image'
    ) {
      decorations.push(
        Decoration.node(position, position + node.nodeSize, {
          class: 'markdown-image-paragraph'
        })
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export function guardImageDeletion(direction: -1 | 1, allowConfirmedDeletion = true): Command {
  return (state, dispatch) => {
    const { selection } = state
    const imageType = state.schema.nodes.image

    if (!imageType) {
      return false
    }

    if (selection instanceof NodeSelection && selection.node.type === imageType) {
      const armedPosition = imageDeletionGuardKey.getState(state)?.armedPosition

      if (armedPosition === selection.from) {
        if (!allowConfirmedDeletion) {
          return true
        }

        if (dispatch) {
          dispatch(state.tr.deleteSelection().setMeta(imageDeletionGuardKey, null).scrollIntoView())
        }

        return true
      }

      if (dispatch) {
        dispatch(state.tr.setMeta(imageDeletionGuardKey, selection.from))
      }

      return true
    }

    if (!(selection instanceof TextSelection) || !selection.empty || !selection.$cursor) {
      return false
    }

    const adjacentNode =
      direction === -1 ? selection.$cursor.nodeBefore : selection.$cursor.nodeAfter

    if (!adjacentNode || adjacentNode.type !== imageType) {
      return false
    }

    const imagePosition = direction === -1 ? selection.from - adjacentNode.nodeSize : selection.from

    if (dispatch) {
      dispatch(
        state.tr
          .setSelection(NodeSelection.create(state.doc, imagePosition))
          .setMeta(imageDeletionGuardKey, imagePosition)
          .scrollIntoView()
      )
    }

    return true
  }
}
