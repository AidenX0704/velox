import log from 'electron-log/main'

log.initialize()

export const logger = log.scope('velox')

export function registerProcessLogging(): void {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error)
  })

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason)
  })
}
