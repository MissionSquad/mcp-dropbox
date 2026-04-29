import express from 'express'
import type { Server as HttpServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { isInitializeRequest, type RequestId } from '@modelcontextprotocol/sdk/types.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { config } from './config.js'
import { createJsonRpcErrorPayload } from './errors/mcp-server-error.js'
import { authContextMiddleware, type AuthenticatedRequest } from './http/auth-context.js'
import { originGuardMiddleware } from './http/origin-guard.js'
import { requestIdMiddleware } from './http/request-id.js'
import { runWithRequestContext } from './http/request-context.js'
import { logger } from './logger.js'
import { createMcpServer } from './mcp/create-server.js'

interface SessionEntry {
  server: McpServer
  transport: StreamableHTTPServerTransport
}

const sessions = new Map<string, SessionEntry>()

function getSessionId(request: Request): string | undefined {
  const header = request.header('mcp-session-id')
  return header?.trim() || undefined
}

function getRequestLogger(requestId: string) {
  return logger.child({ requestId })
}

async function withContext<T>(
  request: AuthenticatedRequest,
  operation: () => Promise<T>
): Promise<T> {
  const context = request.requestContext

  if (!context) {
    throw new Error('Missing request context')
  }

  return runWithRequestContext(context, operation)
}

async function createSession(): Promise<SessionEntry> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
  })
  const server = createMcpServer()

  transport.onclose = () => {
    const sessionId = transport.sessionId

    if (sessionId) {
      sessions.delete(sessionId)
    }
  }

  await server.connect(transport)

  return { server, transport }
}

async function handlePost(request: AuthenticatedRequest, response: Response): Promise<void> {
  const sessionId = getSessionId(request)
  const requestId = request.requestContext?.requestId ?? randomUUID()
  const requestLogger = getRequestLogger(requestId)
  const startedAt = Date.now()

  await withContext(request, async () => {
    let session = sessionId ? sessions.get(sessionId) : undefined

    if (!session) {
      if (sessionId) {
        response.status(404).json(
          createJsonRpcErrorPayload(-32000, 'Session not found', {
            code: 'session_not_found'
          })
        )
        return
      }

      if (!isInitializeRequest(request.body)) {
        response.status(400).json(
          createJsonRpcErrorPayload(-32600, 'Initialization required', {
            code: 'missing_session_initialization'
          })
        )
        return
      }

      session = await createSession()
    }

    await session.transport.handleRequest(request, response, request.body)

    const initializedSessionId = session.transport.sessionId

    if (initializedSessionId && !sessions.has(initializedSessionId)) {
      sessions.set(initializedSessionId, session)
    }

    requestLogger.info(
      {
        method: request.method,
        path: request.path,
        sessionId: initializedSessionId,
        latencyMs: Date.now() - startedAt
      },
      'Handled MCP POST request'
    )
  })
}

async function handleGet(request: AuthenticatedRequest, response: Response): Promise<void> {
  const sessionId = getSessionId(request)
  const requestId = request.requestId ?? randomUUID()
  const requestLogger = getRequestLogger(requestId)
  const startedAt = Date.now()

  if (!sessionId) {
    response.status(400).json(
      createJsonRpcErrorPayload(-32600, 'Missing session ID', {
        code: 'missing_session_id'
      })
    )
    return
  }

  const session = sessions.get(sessionId)

  if (!session) {
    response.status(404).json(
      createJsonRpcErrorPayload(-32000, 'Session not found', {
        code: 'session_not_found'
      })
    )
    return
  }

  await withContext(request, async () => {
    await session.transport.handleRequest(request, response)

    requestLogger.info(
      {
        method: request.method,
        path: request.path,
        sessionId,
        latencyMs: Date.now() - startedAt
      },
      'Handled MCP GET request'
    )
  })
}

async function handleDelete(request: AuthenticatedRequest, response: Response): Promise<void> {
  const sessionId = getSessionId(request)
  const requestId = request.requestId ?? randomUUID()
  const requestLogger = getRequestLogger(requestId)
  const startedAt = Date.now()

  if (!sessionId) {
    response.status(400).json(
      createJsonRpcErrorPayload(-32600, 'Missing session ID', {
        code: 'missing_session_id'
      })
    )
    return
  }

  const session = sessions.get(sessionId)

  if (!session) {
    response.status(404).json(
      createJsonRpcErrorPayload(-32000, 'Session not found', {
        code: 'session_not_found'
      })
    )
    return
  }

  await withContext(request, async () => {
    await session.transport.handleRequest(request, response)

    requestLogger.info(
      {
        method: request.method,
        path: request.path,
        sessionId,
        latencyMs: Date.now() - startedAt
      },
      'Handled MCP DELETE request'
    )
  })
}

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '400mb' }))

  app.get(config.healthPath, (_request, response) => {
    response.status(200).send('OK')
  })

  app.use(config.mcpPath, requestIdMiddleware, originGuardMiddleware, authContextMiddleware)

  app.post(config.mcpPath, (request, response, next) => {
    handlePost(request as AuthenticatedRequest, response).catch(next)
  })

  app.get(config.mcpPath, (request, response, next) => {
    handleGet(request as AuthenticatedRequest, response).catch(next)
  })

  app.delete(config.mcpPath, (request, response, next) => {
    handleDelete(request as AuthenticatedRequest, response).catch(next)
  })

  app.use((error: unknown, _request: Request, response: Response, _next: unknown) => {
    logger.error({ err: error }, 'Unhandled HTTP error')

    if (response.headersSent) {
      return
    }

    response.status(500).json(
      createJsonRpcErrorPayload(-32603, 'Internal server error', {
        code: 'internal_server_error'
      })
    )
  })

  return app
}

export async function startServer(): Promise<HttpServer> {
  const app = createApp()

  const server = await new Promise<HttpServer>((resolve, reject) => {
    const httpServer = app.listen(config.port, () => resolve(httpServer))
    httpServer.once('error', reject)
  })

  logger.info(
    {
      port: config.port,
      mcpPath: config.mcpPath,
      healthPath: config.healthPath
    },
    'Dropbox MCP server listening'
  )

  return server
}

export async function closeSessions(): Promise<void> {
  for (const [sessionId, session] of sessions.entries()) {
    await session.transport.close()
    await session.server.close()
    sessions.delete(sessionId)
  }
}
