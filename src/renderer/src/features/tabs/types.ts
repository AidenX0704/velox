import type { EditorMode } from '../../modules/editor/model/types'

export interface TabDocument {
  path?: string
  title: string
  content: string
  dirty: boolean
  updatedAt?: string
}

export interface TabState {
  id: string
  document: TabDocument
  editorMode: EditorMode
  cursorLine: number
  cursorColumn: number
  scrollTop: number
  pinned: boolean
}

export interface TabBarProps {
  tabs: TabState[]
  activeTabId: string | null
  onSelect: (tabId: string) => void
  onClose: (tabId: string) => void
  onCloseOthers: (tabId: string) => void
  onCloseAll: () => void
  onCloseSaved: () => void
  onPin: (tabId: string) => void
  onUnpin: (tabId: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onNewTab: () => void
}
