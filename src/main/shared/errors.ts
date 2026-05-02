import type { AppError, Result } from '../../shared/types'

export class VeloxError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'VeloxError'
    this.code = code
    this.details = details
  }
}

export function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

export function fail(error: AppError): Result<never> {
  return { ok: false, error }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof VeloxError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details
    }
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    details: error
  }
}
