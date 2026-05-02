import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { ZodError, type ZodType } from 'zod'
import { fail, ok, toAppError, VeloxError } from '../shared/errors'
import { logger } from '../services/log-service'

type IpcHandler<TInput, TOutput> = (
  input: TInput,
  event: IpcMainInvokeEvent
) => Promise<TOutput> | TOutput

export function registerIpcHandler<TInput, TOutput>(
  channel: string,
  schema: ZodType<TInput>,
  handler: IpcHandler<TInput, TOutput>
): void {
  ipcMain.handle(channel, async (event, payload: unknown) => {
    try {
      const input = schema.parse(payload)
      const data = await handler(input, event)

      return ok(data)
    } catch (error) {
      const appError = toAppError(normalizeIpcError(error))
      logger.error(`IPC failed: ${channel}`, appError)

      return fail(appError)
    }
  })
}

function normalizeIpcError(error: unknown): unknown {
  if (error instanceof ZodError) {
    return new VeloxError('INVALID_IPC_PAYLOAD', 'Invalid IPC payload', error.flatten())
  }

  return error
}
