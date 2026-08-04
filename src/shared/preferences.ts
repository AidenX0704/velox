import type { ExportPreferences } from './export'

export type EditorMode = 'source' | 'preview-edit'
export type LegacyEditorMode = EditorMode | 'split'
export type PreviewEditWidthMode = 'wide' | 'standard' | 'narrow'
export type AppearanceMode = 'system' | 'light' | 'dark'
export type UiDensity = 'compact' | 'default' | 'comfortable'
export type BackupProvider = 'local' | 'webdav' | 's3' | 'onedrive' | 'google-drive' | 'dropbox'
export type BackupTrigger = 'manual' | 'on-save' | 'interval'
export type BackupConflictStrategy = 'keep-both' | 'local-wins' | 'remote-wins'

export interface BackupTarget {
  id: string
  name: string
  provider: BackupProvider
  enabled: boolean
  remotePath: string
  endpoint: string
  bucket: string
  region: string
  clientId: string
  tenantId: string
}

export interface BackupPreferences {
  enabled: boolean
  trigger: BackupTrigger
  intervalMinutes: number
  retentionCount: number
  conflictStrategy: BackupConflictStrategy
  includeAttachments: boolean
  excludePatterns: string
  targets: BackupTarget[]
}

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
  showCodeBlockLineNumbers: boolean
  wordWrap: boolean
  editorFontSize: number
  editorLineHeight: number
  previewFontSize: number
  previewLineHeight: number
  previewMaxWidth: number
  previewCentered: boolean
  previewEditWidthMode: PreviewEditWidthMode
  customPreviewCss: string
  appearanceMode: AppearanceMode
  uiDensity: UiDensity
  backup: BackupPreferences
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
  showCodeBlockLineNumbers: false,
  wordWrap: true,
  editorFontSize: 15,
  editorLineHeight: 1.72,
  previewFontSize: 16,
  previewLineHeight: 1.72,
  previewMaxWidth: 920,
  previewCentered: false,
  previewEditWidthMode: 'standard',
  customPreviewCss: '',
  appearanceMode: 'system',
  uiDensity: 'default',
  backup: {
    enabled: false,
    trigger: 'manual',
    intervalMinutes: 30,
    retentionCount: 10,
    conflictStrategy: 'keep-both',
    includeAttachments: true,
    excludePatterns: '.git\nnode_modules\n.DS_Store',
    targets: []
  },
  themeColorPreset: 'blue',
  customThemeColor: '#1677ff',
  defaultMode: 'preview-edit',
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

export function normalizeEditorMode(mode?: LegacyEditorMode | null): EditorMode {
  return mode === 'source' ? 'source' : 'preview-edit'
}
