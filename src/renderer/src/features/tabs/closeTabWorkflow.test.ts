import assert from 'node:assert/strict'
import type { AppError, DocumentData, Result } from '../../../../shared/types'
import { getCloseTabAction, persistTabBeforeClose, reconcileSavedTab } from './closeTabWorkflow'
import type { TabDocument, TabState } from './types'

const untitledDocument: TabDocument = {
  title: 'undefined.md',
  content: 'draft content',
  dirty: true
}

const savedDocument: DocumentData = {
  path: '/workspace/draft.md',
  title: 'draft.md',
  content: untitledDocument.content,
  dirty: false,
  updatedAt: '2026-08-13T00:00:00.000Z'
}

assert.equal(getCloseTabAction('cancel'), 'keep', 'dismissing the prompt must keep the tab')
assert.equal(
  getCloseTabAction('discard'),
  'discard',
  'only an explicit discard decision may skip saving'
)
assert.equal(getCloseTabAction('save'), 'persist')

await assertCancelledSaveAsDoesNotPersist()
await assertSaveFailureIsReported()
await assertRejectedSaveIsReported()
await assertSuccessfulSaveReturnsDocument()
assertSuccessfulSaveClosesUnchangedTab()
assertEditsQueuedDuringSaveKeepTabOpen()
assertPathChangeDuringSaveIsNotOverwritten()
assertMissingTabIsSafe()

console.log('save-before-close workflow passed: 11 scenarios')

async function assertCancelledSaveAsDoesNotPersist(): Promise<void> {
  const calls: string[] = []
  const outcome = await runPersistence({
    document: untitledDocument,
    result: { ok: true, data: null },
    calls
  })

  assert.deepEqual(outcome, { kind: 'cancelled' })
  assert.deepEqual(calls, ['saveAs:draft content'])
}

async function assertSaveFailureIsReported(): Promise<void> {
  const error: AppError = { code: 'EACCES', message: 'Permission denied' }
  const calls: string[] = []
  const outcome = await runPersistence({
    document: { ...untitledDocument, path: '/workspace/readonly.md' },
    result: { ok: false, error },
    calls
  })

  assert.deepEqual(outcome, { kind: 'failed', error })
  assert.deepEqual(calls, ['save:/workspace/readonly.md:draft content'])
}

async function assertRejectedSaveIsReported(): Promise<void> {
  const outcome = await runPersistence({
    document: { ...untitledDocument, path: '/workspace/rejected.md' },
    rejection: new Error('IPC unavailable'),
    calls: []
  })

  assert.deepEqual(outcome, {
    kind: 'failed',
    error: { code: 'DOCUMENT_SAVE_FAILED', message: 'IPC unavailable' }
  })
}

async function assertSuccessfulSaveReturnsDocument(): Promise<void> {
  const outcome = await runPersistence({
    document: untitledDocument,
    result: { ok: true, data: savedDocument },
    calls: []
  })

  assert.deepEqual(outcome, { kind: 'saved', document: savedDocument })
}

function assertSuccessfulSaveClosesUnchangedTab(): void {
  const tab = createTab(untitledDocument)
  const result = reconcileSavedTab(
    [tab],
    tab.id,
    { path: untitledDocument.path, content: untitledDocument.content },
    savedDocument
  )

  assert.equal(result.outcome, 'closed')
  assert.equal(result.closedIndex, 0)
  assert.deepEqual(result.tabs, [])
}

function assertEditsQueuedDuringSaveKeepTabOpen(): void {
  const currentDocument = {
    ...untitledDocument,
    content: `${untitledDocument.content}\nnew text while saving`
  }
  const tab = createTab(currentDocument)
  const result = reconcileSavedTab(
    [tab],
    tab.id,
    { path: untitledDocument.path, content: untitledDocument.content },
    savedDocument
  )

  assert.equal(result.outcome, 'changed')
  assert.equal(result.tabs.length, 1)
  assert.deepEqual(result.tabs[0].document, {
    ...currentDocument,
    path: savedDocument.path,
    title: savedDocument.title,
    updatedAt: savedDocument.updatedAt,
    dirty: true
  })
}

function assertPathChangeDuringSaveIsNotOverwritten(): void {
  const originalDocument = { ...untitledDocument, path: '/workspace/original.md' }
  const renamedDocument = { ...originalDocument, path: '/workspace/renamed.md' }
  const tab = createTab(renamedDocument)
  const result = reconcileSavedTab(
    [tab],
    tab.id,
    { path: originalDocument.path, content: originalDocument.content },
    { ...savedDocument, path: originalDocument.path }
  )

  assert.equal(result.outcome, 'changed')
  assert.deepEqual(result.tabs[0].document, renamedDocument)
}

function assertMissingTabIsSafe(): void {
  const tabs = [createTab(untitledDocument)]
  const result = reconcileSavedTab(
    tabs,
    'missing-tab',
    { path: untitledDocument.path, content: untitledDocument.content },
    savedDocument
  )

  assert.equal(result.outcome, 'missing')
  assert.equal(result.tabs, tabs, 'missing tabs must preserve the existing state reference')
}

async function runPersistence({
  document,
  result,
  rejection,
  calls
}: {
  document: TabDocument
  result?: Result<DocumentData | null>
  rejection?: Error
  calls: string[]
}): ReturnType<typeof persistTabBeforeClose> {
  const persist = async (): Promise<Result<DocumentData | null>> => {
    if (rejection) throw rejection
    assert.ok(result)
    return result
  }

  return persistTabBeforeClose(document, {
    save: async (input) => {
      calls.push(`save:${input.path}:${input.content}`)
      const saveResult = await persist()
      assert.ok(!saveResult.ok || saveResult.data, 'save cannot return a cancellation')
      return saveResult as Result<DocumentData>
    },
    saveAs: async (input) => {
      calls.push(`saveAs:${input.content}`)
      return persist()
    }
  })
}

function createTab(document: TabDocument): TabState {
  return {
    id: 'tab-1',
    document,
    editorMode: 'preview-edit',
    cursorLine: 1,
    cursorColumn: 1,
    scrollTop: 0,
    pinned: false
  }
}
