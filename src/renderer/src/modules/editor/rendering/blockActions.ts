import {
  codeBlockSelectors,
  copyCodeBlock,
  toggleCodeBlockFold,
  toggleCodeBlockWrap
} from './codeBlockModel'

export function handleCodeBlockAction(actionButton: HTMLButtonElement): boolean {
  const codeBlock = actionButton.closest<HTMLElement>(codeBlockSelectors.root)

  if (!codeBlock) {
    return false
  }

  if (actionButton.dataset.codeAction === 'copy') {
    void copyCodeBlock(codeBlock)
    return true
  }

  if (actionButton.dataset.codeAction === 'fold') {
    toggleCodeBlockFold(codeBlock, actionButton)
    return true
  }

  if (actionButton.dataset.codeAction === 'wrap') {
    toggleCodeBlockWrap(codeBlock, actionButton)
    return true
  }

  return false
}

export function getCodeBlockActionButton(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof HTMLElement
    ? target.closest<HTMLButtonElement>(codeBlockSelectors.action)
    : null
}
