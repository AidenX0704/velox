import type { CloseTabDecision } from '../features/tabs/closeTabWorkflow'

export interface CloseTabDecisionRequest {
  title: string
  resolve: (decision: CloseTabDecision) => void
}

let pendingRequest: CloseTabDecisionRequest | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function subscribeCloseTabDecision(listener: () => void): () => void {
  listeners.add(listener)

  return () => listeners.delete(listener)
}

export function getCloseTabDecisionRequest(): CloseTabDecisionRequest | null {
  return pendingRequest
}

/**
 * Asks the user how to close a dirty tab. Resolves `'cancel'` when another
 * request supersedes this one, so a caller's `finally` always runs.
 */
export function requestCloseTabDecision(title: string): Promise<CloseTabDecision> {
  return new Promise((resolve) => {
    const previous = pendingRequest

    pendingRequest = { title, resolve }
    emit()
    previous?.resolve('cancel')
  })
}

export function settleCloseTabDecision(decision: CloseTabDecision): void {
  const pending = pendingRequest

  if (!pending) {
    return
  }

  pendingRequest = null
  emit()
  pending.resolve(decision)
}
