import type { VeloxAPI } from '../shared/types'

declare global {
  interface Window {
    api: VeloxAPI
  }
}

export {}
