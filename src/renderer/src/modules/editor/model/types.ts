import type { EditorPreferences } from '../../../../../shared/preferences'

export type EditorMode = 'source' | 'split' | 'preview-edit'

export interface CursorPosition {
  line: number
  column: number
}

export interface EditorSession {
  cursor: CursorPosition
  splitRatio: number
}

export type MarkdownEditorPreferences = EditorPreferences

export const editorModeLabels: Record<EditorMode, string> = {
  source: '源码',
  split: '分栏',
  'preview-edit': '预览编辑'
}
