import {
  defaultEditorPreferences,
  normalizeEditorMode,
  type EditorPreferences,
  type EditorPreferencesPatch
} from '../../shared/preferences'
import type { ExportPreferences } from '../../shared/export'
import { PreferencesRepository } from '../database/repositories/preferences-repository'

const editorPreferencesKey = 'editorPreferences'
const excludedEditorPreferenceKeys = new Set<keyof EditorPreferences>(['export'])

function pickKnownProperties<T extends object>(
  source: Partial<T> | undefined,
  defaults: T,
  excludedKeys: ReadonlySet<keyof T> = new Set()
): Partial<T> {
  if (!source) {
    return {}
  }

  return Object.fromEntries(
    (Object.keys(defaults) as Array<keyof T>)
      .filter((key) => !excludedKeys.has(key) && key in source)
      .map((key) => [key, source[key]])
  ) as Partial<T>
}

export class PreferencesService {
  constructor(private readonly preferencesRepository: PreferencesRepository) {}

  getEditorPreferences(): EditorPreferences {
    const stored = this.preferencesRepository.get<Partial<EditorPreferences>>(editorPreferencesKey)
    const hasExistingPreferences = stored !== undefined

    // Filter out unknown keys from stored preferences to avoid carrying over legacy settings
    const cleanStored = pickKnownProperties(
      stored,
      defaultEditorPreferences,
      excludedEditorPreferenceKeys
    )

    // Filter out unknown keys from stored export preferences
    const cleanExport: Partial<ExportPreferences> = pickKnownProperties(
      stored?.export,
      defaultEditorPreferences.export
    )

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
