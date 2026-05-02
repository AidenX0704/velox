import { defaultEditorPreferences, type EditorPreferences } from '../../shared/preferences'
import { PreferencesRepository } from '../database/repositories/preferences-repository'

const editorPreferencesKey = 'editorPreferences'

export class PreferencesService {
  constructor(private readonly preferencesRepository: PreferencesRepository) {}

  getEditorPreferences(): EditorPreferences {
    const stored = this.preferencesRepository.get<Partial<EditorPreferences>>(editorPreferencesKey)
    const hasExistingPreferences = stored !== undefined

    return {
      ...defaultEditorPreferences,
      hasSeenWelcome: hasExistingPreferences,
      ...stored
    }
  }

  updateEditorPreferences(patch: Partial<EditorPreferences>): EditorPreferences {
    const next = {
      ...this.getEditorPreferences(),
      ...patch
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
