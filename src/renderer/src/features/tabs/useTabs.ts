import { useCallback, useRef, useState } from 'react'
import type { EditorMode } from '../../modules/editor/model/types'
import type { TabDocument, TabState } from './types'

let tabIdCounter = 0

function generateTabId(): string {
  return `tab-${++tabIdCounter}-${Date.now()}`
}

function createTabState(
  document: TabDocument,
  editorMode: EditorMode = 'split',
  pinned = false
): TabState {
  return {
    id: generateTabId(),
    document,
    editorMode,
    cursorLine: 1,
    cursorColumn: 1,
    pinned
  }
}

const welcomeContent = `# Welcome to Velox

Velox 是一个正在构建中的类 Typora Markdown 编辑器。

- 支持源码模式
- 支持源码 / 预览分栏
- 支持基础预览模式

从左上角打开 Markdown 文件，或直接开始编写。
`

function createWelcomeDocument(): TabDocument {
  return {
    title: 'Welcome.md',
    content: welcomeContent,
    dirty: false
  }
}

export function useTabs(): {
  tabs: TabState[]
  activeTabId: string | null
  activeTab: TabState | null
  setActiveTabId: (id: string | null) => void
  setEditorMode: (mode: EditorMode) => void
  setContent: (content: string) => void
  setCursorPosition: (line: number, column: number) => void
  addTab: (document: TabDocument, editorMode?: EditorMode, pinned?: boolean) => string
  closeTab: (tabId: string, options?: { force?: boolean }) => boolean
  closeOtherTabs: (tabId: string, options?: { force?: boolean }) => void
  closeAllTabs: (options?: { force?: boolean }) => void
  closeSavedTabs: () => void
  pinTab: (tabId: string) => void
  unpinTab: (tabId: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  switchToNextTab: () => void
  switchToPreviousTab: () => void
  switchToTabByIndex: (index: number) => void
  updateTabDocument: (tabId: string, document: Partial<TabDocument>) => void
  findTabByPath: (path: string) => TabState | undefined
} {
  const [tabs, setTabs] = useState<TabState[]>(() => {
    const welcomeTab = createTabState(createWelcomeDocument())
    return [welcomeTab]
  })
  const [activeTabId, setActiveTabId] = useState<string | null>(() => tabs[0]?.id ?? null)
  const activeTabIdRef = useRef(activeTabId)

  const updateActiveTabId = useCallback((id: string | null) => {
    activeTabIdRef.current = id
    setActiveTabId(id)
  }, [])

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null

  const findTabByPath = useCallback(
    (path: string): TabState | undefined => {
      return tabs.find((t) => t.document.path === path)
    },
    [tabs]
  )

  const addTab = useCallback(
    (document: TabDocument, editorMode: EditorMode = 'split', pinned = false): string => {
      const existing = document.path
        ? tabs.find((t) => t.document.path === document.path)
        : undefined
      if (existing) {
        updateActiveTabId(existing.id)
        return existing.id
      }

      const newTab = createTabState(document, editorMode, pinned)
      setTabs((prev) => [...prev, newTab])
      updateActiveTabId(newTab.id)
      return newTab.id
    },
    [tabs, updateActiveTabId]
  )

  const closeTab = useCallback(
    (tabId: string, options?: { force?: boolean }): boolean => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return false

      if (tab.document.dirty && !options?.force) {
        return false
      }

      setTabs((prev) => {
        const index = prev.findIndex((t) => t.id === tabId)
        const next = prev.filter((t) => t.id !== tabId)

        if (next.length === 0) {
          updateActiveTabId(null)
          return []
        }

        if (activeTabIdRef.current === tabId) {
          const nextIndex = Math.min(index, next.length - 1)
          updateActiveTabId(next[nextIndex].id)
        }

        return next
      })

      return true
    },
    [tabs, updateActiveTabId]
  )

  const closeOtherTabs = useCallback(
    (tabId: string, options?: { force?: boolean }): void => {
      setTabs((prev) => {
        const target = prev.find((t) => t.id === tabId)
        if (!target) return prev

        const unsavedOthers = prev.filter((t) => t.id !== tabId && t.document.dirty)
        if (unsavedOthers.length > 0 && !options?.force) {
          return prev
        }

        updateActiveTabId(tabId)
        return [target]
      })
    },
    [updateActiveTabId]
  )

  const closeAllTabs = useCallback(
    (options?: { force?: boolean }): void => {
      const unsaved = tabs.filter((t) => t.document.dirty)
      if (unsaved.length > 0 && !options?.force) return

      setTabs([])
      updateActiveTabId(null)
    },
    [tabs, updateActiveTabId]
  )

  const closeSavedTabs = useCallback((): void => {
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.document.dirty || t.pinned)

      if (remaining.length === 0) {
        updateActiveTabId(null)
        return []
      }

      if (!remaining.find((t) => t.id === activeTabIdRef.current)) {
        updateActiveTabId(remaining[0].id)
      }

      return remaining
    })
  }, [updateActiveTabId])

  const pinTab = useCallback((tabId: string): void => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, pinned: true } : t)))
  }, [])

  const unpinTab = useCallback((tabId: string): void => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, pinned: false } : t)))
  }, [])

  const reorderTabs = useCallback((fromIndex: number, toIndex: number): void => {
    setTabs((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const switchToNextTab = useCallback((): void => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === activeTabIdRef.current)
      if (index === -1) return prev
      const nextIndex = (index + 1) % prev.length
      updateActiveTabId(prev[nextIndex].id)
      return prev
    })
  }, [updateActiveTabId])

  const switchToPreviousTab = useCallback((): void => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === activeTabIdRef.current)
      if (index === -1) return prev
      const nextIndex = (index - 1 + prev.length) % prev.length
      updateActiveTabId(prev[nextIndex].id)
      return prev
    })
  }, [updateActiveTabId])

  const switchToTabByIndex = useCallback(
    (index: number): void => {
      if (index >= 0 && index < tabs.length) {
        updateActiveTabId(tabs[index].id)
      }
    },
    [tabs, updateActiveTabId]
  )

  const setEditorMode = useCallback((mode: EditorMode): void => {
    const targetTabId = activeTabIdRef.current
    if (!targetTabId) return
    setTabs((prev) => prev.map((t) => (t.id === targetTabId ? { ...t, editorMode: mode } : t)))
  }, [])

  const setContent = useCallback((content: string): void => {
    const targetTabId = activeTabIdRef.current
    if (!targetTabId) return
    setTabs((prev) =>
      prev.map((t) =>
        t.id === targetTabId
          ? {
              ...t,
              document: {
                ...t.document,
                content,
                dirty: t.document.content !== content ? true : t.document.dirty
              }
            }
          : t
      )
    )
  }, [])

  const setCursorPosition = useCallback((line: number, column: number): void => {
    const targetTabId = activeTabIdRef.current
    if (!targetTabId) return
    setTabs((prev) =>
      prev.map((t) => (t.id === targetTabId ? { ...t, cursorLine: line, cursorColumn: column } : t))
    )
  }, [])

  const updateTabDocument = useCallback((tabId: string, document: Partial<TabDocument>): void => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              document: { ...t.document, ...document },
              dirty: document.dirty !== undefined ? document.dirty : t.document.dirty
            }
          : t
      )
    )
  }, [])

  return {
    tabs,
    activeTabId,
    activeTab,
    setActiveTabId: updateActiveTabId,
    setEditorMode,
    setContent,
    setCursorPosition,
    addTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    closeSavedTabs,
    pinTab,
    unpinTab,
    reorderTabs,
    switchToNextTab,
    switchToPreviousTab,
    switchToTabByIndex,
    updateTabDocument,
    findTabByPath
  }
}
