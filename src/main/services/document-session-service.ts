import type {
  DocumentSessionRecord,
  UpdateDocumentSessionInput
} from '../database/repositories/document-session-repository'
import { DocumentSessionRepository } from '../database/repositories/document-session-repository'

export class DocumentSessionService {
  constructor(private readonly documentSessionRepository: DocumentSessionRepository) {}

  get(path: string): DocumentSessionRecord | null {
    return this.documentSessionRepository.get(path) ?? null
  }

  getLast(): DocumentSessionRecord | null {
    return this.documentSessionRepository.getLast() ?? null
  }

  update(input: UpdateDocumentSessionInput): DocumentSessionRecord {
    return this.documentSessionRepository.update(input)
  }
}
