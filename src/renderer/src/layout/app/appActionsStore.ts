import type { RecentFileRecord } from '../../../../shared/types'
import type { EditorMode } from '../../modules/editor/model/types'

export interface AppActions {
  openPath?: (path: string, options?: { mode?: EditorMode }) => Promise<boolean>
  loadWorkspace?: (path: string) => Promise<void>
  refreshRecent?: () => Promise<RecentFileRecord[]>
}

let actions: AppActions = {}

/**
 * A tiny external store for the handful of commands that must stay reachable
 * from long-lived listeners (drag & drop, menu commands) without re-subscribing.
 *
 * v1 kept three `useRef` mirrors for this (`openPathRef`, `loadWorkspaceRef`,
 * `refreshRecentRef`), which meant every call site had to remember to unwrap
 * `?.current?.()`. One store, one lookup, always the latest callback.
 */
export function setAppActions(next: AppActions): void {
  actions = next
}

export function getAppActions(): AppActions {
  return actions
}
