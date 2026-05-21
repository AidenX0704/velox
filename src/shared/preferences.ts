import type { ExportPreferences } from './export'

export type EditorMode = 'source' | 'split' | 'preview-edit'
export type PreviewEditWidthMode = 'wide' | 'standard' | 'narrow'
export type AppearanceMode = 'system' | 'light' | 'dark'

export const themeColorPresetIds = [
  'indigo',
  'blue',
  'cyan',
  'emerald',
  'amber',
  'rose',
  'slate'
] as const

export type ThemeColorPresetId = (typeof themeColorPresetIds)[number]
export type ThemeColorSelection = ThemeColorPresetId | 'custom'

export interface ThemeColorPreset {
  id: ThemeColorPresetId
  label: string
  color: string
}

export const themeColorPresets: ThemeColorPreset[] = [
  { id: 'indigo', label: '靛蓝', color: '#1677ff' },
  { id: 'blue', label: '蓝色', color: '#1677ff' },
  { id: 'cyan', label: '青色', color: '#0891b2' },
  { id: 'emerald', label: '绿松', color: '#059669' },
  { id: 'amber', label: '琥珀', color: '#d97706' },
  { id: 'rose', label: '玫红', color: '#e11d48' },
  { id: 'slate', label: '石墨', color: '#475569' }
]

export interface ShortcutOverride {
  [actionId: string]: string
}

export interface EditorPreferences {
  showSidebar: boolean
  showLineNumbers: boolean
  wordWrap: boolean
  editorFontSize: number
  editorLineHeight: number
  previewFontSize: number
  previewLineHeight: number
  previewMaxWidth: number
  previewCentered: boolean
  previewEditWidthMode: PreviewEditWidthMode
  splitScrollSync: boolean
  customPreviewCss: string
  appearanceMode: AppearanceMode
  themeColorPreset: ThemeColorSelection
  customThemeColor: string
  defaultMode: EditorMode
  hasSeenWelcome: boolean
  shortcutOverrides: ShortcutOverride
  export: ExportPreferences
}

export type EditorPreferencesPatch = Partial<Omit<EditorPreferences, 'export'>> & {
  export?: Partial<ExportPreferences>
}

export const defaultEditorPreferences: EditorPreferences = {
  showSidebar: true,
  showLineNumbers: true,
  wordWrap: true,
  editorFontSize: 15,
  editorLineHeight: 1.72,
  previewFontSize: 16,
  previewLineHeight: 1.82,
  previewMaxWidth: 920,
  previewCentered: false,
  previewEditWidthMode: 'standard',
  splitScrollSync: true,
  customPreviewCss: '',
  appearanceMode: 'system',
  themeColorPreset: 'blue',
  customThemeColor: '#1677ff',
  defaultMode: 'split',
  hasSeenWelcome: false,
  shortcutOverrides: {},
  export: {
    includeCustomCss: true,
    imageFormat: 'png',
    imageScale: 2,
    pdfPageSize: 'A4',
    defaultFormat: 'pdf'
  }
}
