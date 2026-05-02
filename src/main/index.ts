import { createApp } from './bootstrap/create-app'
import { logger } from './services/log-service'

createApp().catch((error) => {
  logger.error('Failed to start Velox', error)
})
