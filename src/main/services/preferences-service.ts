import {
  defaultEditorPreferences,
  normalizeEditorMode,
  type EditorPreferences,
  type EditorPreferencesPatch
} from '../../shared/preferences'
import { PreferencesRepository } from '../database/repositories/preferences-repository'

const editorPreferencesKey = 'editorPreferences'

export class PreferencesService {
  constructor(private readonly preferencesRepository: PreferencesRepository) {}

  getEditorPreferences(): EditorPreferences {
    const stored = this.preferencesRepository.get<Partial<EditorPreferences>>(editorPreferencesKey)
    const hasExistingPreferences = stored !== undefined

    const preferences = {
      ...defaultEditorPreferences,
      hasSeenWelcome: hasExistingPreferences,
      ...stored,
      export: {
        ...defaultEditorPreferences.export,
        ...stored?.export
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
