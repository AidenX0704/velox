import { useCallback, useEffect, useRef, useState } from 'react'
import type { UpdaterStatus } from '../../../../shared/types'
import { Toast } from '../../ui'

export type UpdaterDialogKind = 'available' | 'downloaded' | null

interface UpdaterState {
  status: UpdaterStatus | null
  dialog: UpdaterDialogKind
  setDialog: (dialog: UpdaterDialogKind) => void
  handleStatus: (status: UpdaterStatus) => void
  check: () => Promise<void>
  download: () => Promise<void>
  install: () => Promise<void>
}

/**
 * Owns the updater handshake: live status, the two one-shot prompts (available /
 * downloaded) and the manual-check toast behaviour. Prompts are de-duplicated by
 * version so a repeating IPC broadcast cannot reopen the same dialog.
 */
export function useUpdaterState(): UpdaterState {
  const [status, setStatus] = useState<UpdaterStatus | null>(null)
  const [dialog, setDialog] = useState<UpdaterDialogKind>(null)
  const manualCheckRef = useRef(false)
  const availablePromptRef = useRef<string | undefined>(undefined)
  const installPromptRef = useRef<string | undefined>(undefined)

  const handleStatus = useCallback((next: UpdaterStatus): void => {
    setStatus(next)

    if (next.state === 'available') {
      manualCheckRef.current = false

      const version = next.version ?? next.updatedAt

      if (availablePromptRef.current === version) {
        return
      }

      availablePromptRef.current = version
      setDialog('available')
      return
    }

    if (next.state === 'downloading') {
      setDialog(null)
      return
    }

    if (next.state === 'downloaded') {
      const version = next.version ?? next.updatedAt

      if (installPromptRef.current === version) {
        return
      }

      installPromptRef.current = version
      setDialog('downloaded')
      return
    }

    if (next.state === 'not-available' && manualCheckRef.current) {
      manualCheckRef.current = false
      Toast.success(next.message)
      return
    }

    if (next.state === 'error' && manualCheckRef.current) {
      manualCheckRef.current = false
      Toast.error(next.error || next.message)
    }
  }, [])

  const check = useCallback(async (): Promise<void> => {
    manualCheckRef.current = true
    availablePromptRef.current = undefined
    installPromptRef.current = undefined
    Toast.info('正在检查更新')

    const result = await window.api.updater.checkForUpdates()

    if (!result.ok) {
      manualCheckRef.current = false
      Toast.error(result.error.message)
      return
    }

    handleStatus(result.data)
  }, [handleStatus])

  const download = useCallback(async (): Promise<void> => {
    setDialog(null)

    const result = await window.api.updater.downloadUpdate()

    if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [])

  const install = useCallback(async (): Promise<void> => {
    setDialog(null)

    const result = await window.api.updater.quitAndInstall()

    if (!result.ok) {
      Toast.error(result.error.message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void window.api.updater.getStatus().then((result) => {
      if (!cancelled && result.ok) {
        handleStatus(result.data)
      }
    })

    const unsubscribe = window.api.updater.onStatusChange(handleStatus)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [handleStatus])

  return { status, dialog, setDialog, handleStatus, check, download, install }
}
