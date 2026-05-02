import { useCallback, useEffect, useRef, useState } from 'react'
import { Toast } from '@douyinfe/semi-ui'
import { defaultEditorPreferences, type EditorPreferences } from '../../../../shared/preferences'

export function useEditorSettings(): {
  settings: EditorPreferences
  loading: boolean
  updateSettings: (patch: Partial<EditorPreferences>) => void
  resetSettings: () => Promise<void>
} {
  const [settings, setSettings] = useState<EditorPreferences>(defaultEditorPreferences)
  const [loading, setLoading] = useState(true)
  const persistTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    window.api.preferences.getEditor().then((result) => {
      if (cancelled) {
        return
      }

      if (result.ok) {
        setSettings(result.data)
      } else {
        Toast.error(result.error.message)
      }

      setLoading(false)
    })

    return () => {
      cancelled = true
      window.clearTimeout(persistTimerRef.current)
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<EditorPreferences>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }

      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = window.setTimeout(() => {
        window.api.preferences.updateEditor(next).then((result) => {
          if (!result.ok) {
            Toast.error(result.error.message)
          }
        })
      }, 180)

      return next
    })
  }, [])

  const resetSettings = useCallback(async () => {
    const result = await window.api.preferences.resetEditor()

    if (result.ok) {
      setSettings(result.data)
      Toast.success('设置已恢复默认')
    } else {
      Toast.error(result.error.message)
    }
  }, [])

  return {
    settings,
    loading,
    updateSettings,
    resetSettings
  }
}
