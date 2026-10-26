import { useCallback, useEffect, useRef, useState } from 'react'
import type { TabDocument } from '../../features/tabs/types'
import type { TabState } from '../../features/tabs/types'
import { Toast } from '../../ui'

export type ExternalNoticeState =
  | { kind: 'synced' }
  | { kind: 'conflict'; pendingContent: string }
  | { kind: 'removed' }

interface ExternalDocumentsOptions {
  tabs: TabState[]
  applyExternalContent: (path: string, content: string) => void
  markTabMissing: (path: string, missing: boolean) => void
  updateTabDocument: (tabId: string, document: Partial<TabDocument>) => void
  onDocumentSaved: () => void
}

interface ExternalDocumentsState {
  notices: Record<string, ExternalNoticeState>
  clearNotice: (path: string) => void
  resolveConflict: (path: string, mode: 'reload' | 'keep') => void
  saveMissing: (path: string) => Promise<void>
}

/**
 * Keeps open buffers in sync with the disk.
 *
 * The main process already decides *that* a file changed; this hook decides what
 * to do about it: replace a clean buffer silently, raise a conflict for a dirty
 * one, or flag a tab whose file disappeared. It also keeps the main-process
 * watcher set aligned with the open tabs.
 */
export function useExternalDocuments({
  tabs,
  applyExternalContent,
  markTabMissing,
  updateTabDocument,
  onDocumentSaved
}: ExternalDocumentsOptions): ExternalDocumentsState {
  const [notices, setNotices] = useState<Record<string, ExternalNoticeState>>({})
  const tabsRef = useRef(tabs)

  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])

  const clearNotice = useCallback((path: string): void => {
    setNotices((previous) => {
      if (!(path in previous)) {
        return previous
      }

      const next = { ...previous }
      delete next[path]
      return next
    })
  }, [])

  useEffect(() => {
    const offChange = window.api.document.onExternalChange((change) => {
      if (!tabsRef.current.some((item) => item.document.path === change.path)) {
        return
      }

      void (async () => {
        const result = await window.api.document.reloadFromDisk(change.path)

        if (!result.ok || result.data === null) {
          return
        }

        const content = result.data
        const latest = tabsRef.current.find((item) => item.document.path === change.path)

        if (!latest || latest.document.content === content) {
          return
        }

        if (latest.document.dirty) {
          setNotices((previous) => ({
            ...previous,
            [change.path]: { kind: 'conflict', pendingContent: content }
          }))
          return
        }

        applyExternalContent(change.path, content)
        setNotices((previous) => ({ ...previous, [change.path]: { kind: 'synced' } }))
      })()
    })

    const offRemoval = window.api.document.onExternalRemoval((removal) => {
      if (!tabsRef.current.some((item) => item.document.path === removal.path)) {
        return
      }

      markTabMissing(removal.path, true)
      setNotices((previous) => ({ ...previous, [removal.path]: { kind: 'removed' } }))
    })

    return () => {
      offChange()
      offRemoval()
    }
  }, [applyExternalContent, markTabMissing])

  // Keep the main-process watcher set aligned with the open tabs.
  const watchedPathsRef = useRef<string[]>([])

  useEffect(() => {
    const currentPaths = tabs
      .map((tab) => tab.document.path)
      .filter((path): path is string => typeof path === 'string' && path.length > 0)

    for (const previous of watchedPathsRef.current) {
      if (!currentPaths.includes(previous)) {
        void window.api.document.unwatch(previous)
      }
    }

    watchedPathsRef.current = currentPaths
  }, [tabs])

  const resolveConflict = useCallback(
    (path: string, mode: 'reload' | 'keep'): void => {
      const notice = notices[path]

      if (!notice) {
        return
      }

      if (mode === 'reload' && notice.kind === 'conflict') {
        applyExternalContent(path, notice.pendingContent)
        setNotices((previous) => ({ ...previous, [path]: { kind: 'synced' } }))
        return
      }

      clearNotice(path)
    },
    [applyExternalContent, clearNotice, notices]
  )

  const saveMissing = useCallback(
    async (path: string): Promise<void> => {
      const tab = tabsRef.current.find((item) => item.document.path === path)

      if (!tab) {
        return
      }

      const result = await window.api.document.saveAs({
        defaultPath: path,
        content: tab.document.content
      })

      if (result.ok && result.data) {
        updateTabDocument(tab.id, {
          path: result.data.path,
          title: result.data.title,
          content: result.data.content,
          dirty: false,
          updatedAt: result.data.updatedAt
        })
        markTabMissing(path, false)
        clearNotice(path)
        onDocumentSaved()
      } else if (!result.ok) {
        Toast.error(result.error.message)
      }
    },
    [clearNotice, markTabMissing, onDocumentSaved, updateTabDocument]
  )

  return { notices, clearNotice, resolveConflict, saveMissing }
}
