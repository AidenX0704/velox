import { codeBlockSelectors, copyCodeBlock } from './codeBlockModel'

export function handleCodeBlockAction(actionButton: HTMLButtonElement): boolean {
  const codeBlock = actionButton.closest<HTMLElement>(codeBlockSelectors.root)

  if (!codeBlock) {
    return false
  }

  if (actionButton.dataset.codeAction === 'copy') {
    void copyCodeBlock(codeBlock)
    return true
  }

  return false
}

export function getCodeBlockActionButton(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof HTMLElement
    ? target.closest<HTMLButtonElement>(codeBlockSelectors.action)
    : null
}
