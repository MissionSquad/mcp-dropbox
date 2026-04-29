#!/usr/bin/env node
import { logger } from './logger.js'
import { config } from './config.js'
import { closeSessions, startServer } from './server.js'
import { gracefulShutdown } from './shutdown.js'

async function main(): Promise<void> {
  const server = await startServer()

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutting down Dropbox MCP server')

    await gracefulShutdown({
      closeSessions,
      server,
      timeoutMs: config.shutdownTimeoutMs
    })

    process.exit(0)
  }

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch(error => {
      logger.error({ err: error }, 'SIGINT shutdown failed')
      process.exit(1)
    })
  })

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch(error => {
      logger.error({ err: error }, 'SIGTERM shutdown failed')
      process.exit(1)
    })
  })
}

main().catch(error => {
  logger.error(
    {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    },
    'Fatal server error'
  )

  process.exit(1)
})
