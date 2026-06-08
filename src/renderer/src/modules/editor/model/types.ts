import type { EditorPreferences } from '../../../../../shared/preferences'

export type EditorMode = 'source' | 'preview-edit'

export interface CursorPosition {
  line: number
  column: number
}

export interface EditorSession {
  cursor: CursorPosition
}

export type MarkdownEditorPreferences = EditorPreferences

export const editorModeLabels: Record<EditorMode, string> = {
  source: '源码',
  'preview-edit': '预览'
}
