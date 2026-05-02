import type {
  RecentFileRecord,
  RecentWorkspaceRecord
} from '../database/repositories/recent-repository'
import { RecentRepository } from '../database/repositories/recent-repository'

export class RecentService {
  constructor(private readonly recentRepository: RecentRepository) {}

  addFile(path: string): void {
    this.recentRepository.upsertFile(path)
  }

  addWorkspace(path: string): void {
    this.recentRepository.upsertWorkspace(path)
  }

  listFiles(): RecentFileRecord[] {
    return this.recentRepository.listFiles()
  }

  listWorkspaces(): RecentWorkspaceRecord[] {
    return this.recentRepository.listWorkspaces()
  }

  clear(): void {
    this.recentRepository.clear()
  }
}
