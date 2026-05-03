import { z } from 'zod'
import { themeColorPresetIds } from '../../shared/preferences'

const nonEmptyString = z.string().min(1)

export const schemas = {
  empty: z.undefined(),
  settingsPatch: z
    .object({
      editor: z
        .object({
          fontSize: z.number().int().min(10).max(48).optional(),
          autosaveInterval: z.number().int().min(500).max(60000).optional(),
          wordWrap: z.boolean().optional()
        })
        .optional(),
      appearance: z
        .object({
          theme: z.enum(['system', 'light', 'dark']).optional()
        })
        .optional(),
      workspace: z
        .object({
          recentFiles: z.array(nonEmptyString).optional(),
          recentFolders: z.array(nonEmptyString).optional(),
          lastOpenedFolder: nonEmptyString.optional()
        })
        .optional()
    })
    .strict(),

  editorPreferencesPatch: z
    .object({
      showSidebar: z.boolean().optional(),
      showLineNumbers: z.boolean().optional(),
      wordWrap: z.boolean().optional(),
      editorFontSize: z.number().int().min(12).max(24).optional(),
      editorLineHeight: z.number().min(1.3).max(2.2).optional(),
      previewFontSize: z.number().int().min(13).max(24).optional(),
      previewLineHeight: z.number().min(1.4).max(2.4).optional(),
      previewMaxWidth: z.number().int().min(680).max(1280).optional(),
      previewCentered: z.boolean().optional(),
      previewEditWidthMode: z.enum(['wide', 'standard', 'narrow']).optional(),
      splitScrollSync: z.boolean().optional(),
      customPreviewCss: z.string().max(12000).optional(),
      appearanceMode: z.enum(['system', 'light', 'dark']).optional(),
      themeColorPreset: z.enum([...themeColorPresetIds, 'custom']).optional(),
      customThemeColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      defaultMode: z.enum(['source', 'split', 'preview-edit']).optional(),
      hasSeenWelcome: z.boolean().optional(),
      shortcutOverrides: z.record(z.string(), z.string()).optional()
    })
    .strict(),
  workspaceState: z
    .object({
      workspacePath: nonEmptyString,
      expandedPaths: z.array(nonEmptyString).optional(),
      selectedPath: nonEmptyString.optional(),
      sidebarVisible: z.boolean().optional()
    })
    .strict(),
  documentSession: z
    .object({
      path: nonEmptyString,
      mode: z.enum(['source', 'split', 'preview-edit']).optional(),
      cursorLine: z.number().int().min(1).optional(),
      cursorColumn: z.number().int().min(1).optional(),
      scrollTop: z.number().min(0).optional()
    })
    .strict(),
  path: nonEmptyString,
  saveDocument: z
    .object({
      path: nonEmptyString,
      content: z.string()
    })
    .strict(),
  saveDocumentAs: z
    .object({
      defaultPath: nonEmptyString.optional(),
      content: z.string()
    })
    .strict(),
  resolveDocumentLink: z
    .object({
      href: nonEmptyString,
      currentPath: nonEmptyString.optional(),
      workspaceRoot: nonEmptyString.optional()
    })
    .strict(),
  url: z.url()
}

export type SettingsPatchInput = z.infer<typeof schemas.settingsPatch>
export type SaveDocumentInput = z.infer<typeof schemas.saveDocument>
export type SaveDocumentAsInput = z.infer<typeof schemas.saveDocumentAs>
export type ResolveDocumentLinkInput = z.infer<typeof schemas.resolveDocumentLink>
export type EditorPreferencesPatchInput = z.infer<typeof schemas.editorPreferencesPatch>
export type WorkspaceStateInput = z.infer<typeof schemas.workspaceState>
export type DocumentSessionInput = z.infer<typeof schemas.documentSession>
