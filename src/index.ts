#!/usr/bin/env node

import { FastMCP } from '@missionsquad/fastmcp'

import { logger } from './logger.js'
import { routeConsoleStdoutToStderr } from './stdio-safe-console.js'
import { registerAccountTools } from './tools/account.js'
import { registerFileOperationTools } from './tools/file-operations.js'
import { registerRevisionTools } from './tools/revisions.js'
import { registerSearchTools } from './tools/search.js'
import { registerSharingTools } from './tools/sharing.js'
import { registerUploadDownloadTools } from './tools/upload-download.js'

routeConsoleStdoutToStderr()

const server = new FastMCP<undefined>({
  name: 'mcp-dropbox',
  version: '0.2.1'
})

registerFileOperationTools(server)
registerUploadDownloadTools(server)
registerSearchTools(server)
registerRevisionTools(server)
registerSharingTools(server)
registerAccountTools(server)

async function main(): Promise<void> {
  await server.start({ transportType: 'stdio' })
  logger.info('mcp-dropbox server started successfully')
}

async function shutdown(exitCode: number): Promise<void> {
  try {
    await server.stop()
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
