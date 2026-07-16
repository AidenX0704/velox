import {
  defaultEditorPreferences,
  normalizeEditorMode,
  type EditorPreferences,
  type EditorPreferencesPatch
} from '../../shared/preferences'
import type { ExportPreferences } from '../../shared/export'
import { PreferencesRepository } from '../database/repositories/preferences-repository'

const editorPreferencesKey = 'editorPreferences'

export class PreferencesService {
  constructor(private readonly preferencesRepository: PreferencesRepository) {}

  getEditorPreferences(): EditorPreferences {
    const stored = this.preferencesRepository.get<Partial<EditorPreferences>>(editorPreferencesKey)
    const hasExistingPreferences = stored !== undefined

    // Filter out unknown keys from stored preferences to avoid carrying over legacy settings
    const cleanStored: Partial<EditorPreferences> = {}
    if (stored) {
      for (const key of Object.keys(defaultEditorPreferences)) {
        if (key !== 'export' && key in stored) {
          ;(cleanStored as any)[key] = (stored as any)[key]
        }
      }
    }

    // Filter out unknown keys from stored export preferences
    const cleanExport: Partial<ExportPreferences> = {}
    if (stored?.export) {
      for (const key of Object.keys(defaultEditorPreferences.export)) {
        if (key in stored.export) {
          cleanExport[key] = (stored.export as any)[key]
        }
      }
    }

    const preferences = {
      ...defaultEditorPreferences,
      hasSeenWelcome: hasExistingPreferences,
      ...cleanStored,
      export: {
        ...defaultEditorPreferences.export,
        ...cleanExport
      }
    }

    return {
      ...preferences,
      defaultMode: normalizeEditorMode(preferences.defaultMode)
    }
  }

  updateEditorPreferences(patch: EditorPreferencesPatch): EditorPreferences {
    const current = this.getEditorPreferences()
    const next = {
      ...current,
      ...patch,
      defaultMode: normalizeEditorMode(patch.defaultMode ?? current.defaultMode),
      export: {
        ...current.export,
        ...patch.export
      }
    }

    this.preferencesRepository.set(editorPreferencesKey, next)

    return next
  }

  resetEditorPreferences(): EditorPreferences {
    const next = {
      ...defaultEditorPreferences,
      hasSeenWelcome: this.getEditorPreferences().hasSeenWelcome
    }

    this.preferencesRepository.set(editorPreferencesKey, next)
    return next
  }
}
