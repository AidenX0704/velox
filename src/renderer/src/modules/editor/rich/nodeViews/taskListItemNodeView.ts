import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView } from 'prosemirror-view'

export function createTaskListItemNodeView(
  initialNode: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined
): NodeView {
  let currentNode = initialNode
  const dom = document.createElement('li')
  const checkbox = document.createElement('input')
  const contentDOM = document.createElement('div')

  checkbox.className = 'task-list-item-checkbox'
  checkbox.type = 'checkbox'
  checkbox.contentEditable = 'false'
  contentDOM.className = 'task-list-item-content'

  checkbox.addEventListener('change', () => {
    const pos = getPos()

    if (typeof pos !== 'number') {
      return
    }

    view.dispatch(
      view.state.tr.setNodeMarkup(pos, undefined, {
        ...currentNode.attrs,
        checked: checkbox.checked
      })
    )
  })
  checkbox.addEventListener('mousedown', (event) => {
    event.stopPropagation()
  })
  checkbox.addEventListener('click', (event) => {
    event.stopPropagation()
  })

  dom.append(checkbox, contentDOM)
  updateTaskListItemDom(dom, checkbox, currentNode)

  return {
    dom,
    contentDOM,
    update(nextNode) {
      if (nextNode.type !== initialNode.type) {
        return false
      }

      currentNode = nextNode
      updateTaskListItemDom(dom, checkbox, currentNode)
      return true
    },
    stopEvent(event) {
      return event.target === checkbox
    }
  }
}

function updateTaskListItemDom(
  dom: HTMLElement,
  checkbox: HTMLInputElement,
  node: ProseMirrorNode
): void {
  const checked = node.attrs.checked

  dom.classList.toggle('task-list-item', checked !== null)
  dom.toggleAttribute('data-task-checked', checked !== null)

  if (checked !== null) {
    dom.dataset.taskChecked = String(Boolean(checked))
  } else {
    delete dom.dataset.taskChecked
  }

  checkbox.checked = checked === true
  checkbox.hidden = checked === null
  checkbox.tabIndex = checked === null ? -1 : 0
}
