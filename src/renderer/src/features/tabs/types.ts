import type { EditorMode } from '../../modules/editor/model/types'

export interface TabDocument {
  path?: string
  title: string
  content: string
  dirty: boolean
  updatedAt?: string
  kind?: 'markdown' | 'image'
  imageSource?: string
}

export interface TabState {
  id: string
  document: TabDocument
  editorMode: EditorMode
  cursorLine: number
  cursorColumn: number
  scrollTop: number
  pinned: boolean
  /** Bumped whenever the buffer was replaced from disk, so editors resync. */
  externalRevision?: number
  /** Set when the file disappeared from disk while the tab stayed open. */
  missingOnDisk?: boolean
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
