import type {
  UpdateWorkspaceStateInput,
  WorkspaceStateRecord
} from '../database/repositories/workspace-state-repository'
import { WorkspaceStateRepository } from '../database/repositories/workspace-state-repository'

export class WorkspaceStateService {
  constructor(private readonly workspaceStateRepository: WorkspaceStateRepository) {}

  get(workspacePath: string): WorkspaceStateRecord | null {
    return this.workspaceStateRepository.get(workspacePath) ?? null
  }

  update(input: UpdateWorkspaceStateInput): WorkspaceStateRecord {
    return this.workspaceStateRepository.update(input)
  }
}
