#!/usr/bin/env node

import { createServer } from './server.js'
import { logger } from './logger.js'
import { appConfig } from './config.js'
import { shutdownHttpServer } from './shutdown.js'

let runningServer: Awaited<ReturnType<typeof createServer>> | undefined

async function main(): Promise<void> {
  runningServer = await createServer()
  runningServer.httpServer.listen(appConfig.port, appConfig.host, () => {
    logger.info(
      {
        port: appConfig.port,
        host: appConfig.host,
        publicBaseUrl: appConfig.publicBaseUrl,
        mcpPath: appConfig.mcpPath
      },
      'mcp-dropbox HTTP server started successfully'
    )
  })
}

async function shutdown(exitCode: number): Promise<void> {
  try {
    if (runningServer) {
      await shutdownHttpServer(runningServer.httpServer)
      await runningServer.database.close()
    }
  } finally {
    process.exit(exitCode)
  }
}

process.on('SIGINT', () => {
  void shutdown(0)
})

process.on('SIGTERM', () => {
  void shutdown(0)
})

process.on('uncaughtException', error => {
  logger.error({ err: error }, 'Uncaught exception')
  void shutdown(1)
})

process.on('unhandledRejection', error => {
  logger.error({ err: error }, 'Unhandled rejection')
  void shutdown(1)
})

void main().catch(error => {
  logger.error({ err: error }, 'Fatal startup error')
  void shutdown(1)
})
