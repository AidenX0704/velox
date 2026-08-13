import type {
  AppError,
  DocumentData,
  Result,
  SaveDocumentAsInput,
  SaveDocumentInput
} from '../../../../shared/types'
import type { TabDocument, TabState } from './types'

export type CloseTabDecision = 'save' | 'discard' | 'cancel'
export type CloseTabAction = 'persist' | 'discard' | 'keep'

export type PersistBeforeCloseOutcome =
  | { kind: 'saved'; document: DocumentData }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: AppError }

export type ReconcileSavedTabOutcome = 'closed' | 'changed' | 'missing'

export interface SavedTabSnapshot {
  path?: string
  content: string
}

interface DocumentPersistence {
  save: (input: SaveDocumentInput) => Promise<Result<DocumentData>>
  saveAs: (input: SaveDocumentAsInput) => Promise<Result<DocumentData | null>>
}

export function getCloseTabAction(decision: CloseTabDecision): CloseTabAction {
  if (decision === 'save') return 'persist'
  if (decision === 'discard') return 'discard'
  return 'keep'
}

export async function persistTabBeforeClose(
  document: TabDocument,
  persistence: DocumentPersistence
): Promise<PersistBeforeCloseOutcome> {
  let result: Result<DocumentData | null>

  try {
    result = document.path
      ? await persistence.save({ path: document.path, content: document.content })
      : await persistence.saveAs({ content: document.content })
  } catch (error) {
    return { kind: 'failed', error: toAppError(error) }
  }

  if (!result.ok) {
    return { kind: 'failed', error: result.error }
  }

  if (!result.data) {
    return { kind: 'cancelled' }
  }

  return { kind: 'saved', document: result.data }
}

export function reconcileSavedTab(
  tabs: TabState[],
  tabId: string,
  snapshot: SavedTabSnapshot,
  savedDocument: DocumentData
): { tabs: TabState[]; outcome: ReconcileSavedTabOutcome; closedIndex?: number } {
  const index = tabs.findIndex((tab) => tab.id === tabId)

  if (index === -1) {
    return { tabs, outcome: 'missing' }
  }

  const tab = tabs[index]
  // 只有标签仍与发起保存时的快照一致，才允许关闭；否则会丢失保存期间的新修改。
  const contentChanged = tab.document.content !== snapshot.content
  const pathChanged = tab.document.path !== snapshot.path

  if (contentChanged || pathChanged) {
    // 并发重命名时不能用旧保存结果覆盖新路径；普通新编辑则只同步 Save As 得到的路径元数据。
    const nextDocument: TabDocument = pathChanged
      ? { ...tab.document, dirty: true }
      : {
          ...tab.document,
          path: savedDocument.path,
          title: savedDocument.title,
          updatedAt: savedDocument.updatedAt,
          dirty: true
        }

    return {
      tabs: tabs.map((item) => (item.id === tabId ? { ...item, document: nextDocument } : item)),
      outcome: 'changed'
    }
  }

  return {
    tabs: tabs.filter((item) => item.id !== tabId),
    outcome: 'closed',
    closedIndex: index
  }
}

function toAppError(error: unknown): AppError {
  if (error instanceof Error) {
    return {
      code: 'DOCUMENT_SAVE_FAILED',
      message: error.message
    }
  }

  return {
    code: 'DOCUMENT_SAVE_FAILED',
    message: '保存文档失败',
    details: error
  }
}
