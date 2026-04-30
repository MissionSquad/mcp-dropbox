import { randomUUID } from 'node:crypto'
import http from 'node:http'
import type { RequestHandler } from 'express'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'
import { getOAuthProtectedResourceMetadataUrl, mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'

import { setAppContext } from './app-context.js'
import { appConfig, getMcpEndpointUrl } from './config.js'
import { DropboxAccountService } from './dropbox/account-service.js'
import { createOriginGuard } from './http/origin-guard.js'
import { logger } from './logger.js'
import { createMcpServer } from './mcp/create-server.js'
import { DropboxMcpOAuthProvider } from './oauth/provider.js'
import { AppDatabase } from './persistence/database.js'

interface SessionEntry {
  server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer
  transport: StreamableHTTPServerTransport
}

export interface RunningServer {
  app: ReturnType<typeof createMcpExpressApp>
  httpServer: http.Server
  database: AppDatabase
}

export async function createServer(): Promise<RunningServer> {
  const app = createMcpExpressApp({ host: appConfig.host })
  const database = new AppDatabase(appConfig.sqlitePath, appConfig.encryptionKey)
  await database.init()
  await database.cleanupExpiredState()

  const oauthProvider = new DropboxMcpOAuthProvider(database)
  const dropboxAccountService = new DropboxAccountService(database)

  setAppContext({
    database,
    oauthProvider,
    dropboxAccountService
  })

  const mcpEndpointUrl = getMcpEndpointUrl()
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(mcpEndpointUrl)

  app.use(
    mcpAuthRouter({
      provider: oauthProvider,
      issuerUrl: new URL(appConfig.oauthIssuerUrl),
      resourceServerUrl: mcpEndpointUrl,
      scopesSupported: ['mcp:tools'],
      resourceName: 'Dropbox MCP Server'
    })
  )

  const authMiddleware = requireBearerAuth({
    verifier: oauthProvider,
    requiredScopes: [],
    resourceMetadataUrl
  })

  const originGuard = createOriginGuard()
  const transports = new Map<string, SessionEntry>()

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true })
  })

  app.get('/oauth/dropbox/start', async (req, res, next) => {
    try {
      const nextUrl = typeof req.query.next === 'string' ? req.query.next : undefined

      if (!nextUrl) {
        res.status(400).send('Missing next URL')
        return
      }

      const authorizationUrl = await oauthProvider.startDropboxAuthorization(nextUrl)
      res.redirect(302, authorizationUrl.toString())
    } catch (error) {
      next(error)
    }
  })

  app.get('/oauth/dropbox/callback', async (req, res, next) => {
    try {
      await oauthProvider.handleDropboxCallback(
        {
          code: typeof req.query.code === 'string' ? req.query.code : undefined,
          state: typeof req.query.state === 'string' ? req.query.state : undefined,
          error: typeof req.query.error === 'string' ? req.query.error : undefined,
          errorDescription:
            typeof req.query.error_description === 'string' ? req.query.error_description : undefined
        },
        res
      )
    } catch (error) {
      next(error)
    }
  })

  const postHandler: RequestHandler = async (req, res) => {
    const sessionId = typeof req.headers['mcp-session-id'] === 'string' ? req.headers['mcp-session-id'] : undefined

    try {
      let entry = sessionId ? transports.get(sessionId) : undefined

      if (!entry) {
        if (sessionId || !isInitializeRequest(req.body)) {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided'
            },
            id: null
          })
          return
        }

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: initializedSessionId => {
            transports.set(initializedSessionId, {
              server,
              transport
            })
          }
        })

        transport.onclose = () => {
          const currentSessionId = transport.sessionId
          if (currentSessionId) {
            transports.delete(currentSessionId)
          }
        }

        const server = createMcpServer()
        await server.connect(transport)

        entry = {
          server,
          transport
        }
      }

      await entry.transport.handleRequest(req, res, req.body)
    } catch (error) {
      logger.error({ err: error }, 'Error handling MCP POST request')
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        })
      }
    }
  }

  const getHandler: RequestHandler = async (req, res) => {
    const sessionId = typeof req.headers['mcp-session-id'] === 'string' ? req.headers['mcp-session-id'] : undefined

    if (!sessionId) {
      res.status(400).send('Invalid or missing session ID')
      return
    }

    const entry = transports.get(sessionId)

    if (!entry) {
      res.status(400).send('Invalid or missing session ID')
      return
    }

    await entry.transport.handleRequest(req, res)
  }

  const deleteHandler: RequestHandler = async (req, res) => {
    const sessionId = typeof req.headers['mcp-session-id'] === 'string' ? req.headers['mcp-session-id'] : undefined

    if (!sessionId) {
      res.status(400).send('Invalid or missing session ID')
      return
    }

    const entry = transports.get(sessionId)

    if (!entry) {
      res.status(400).send('Invalid or missing session ID')
      return
    }

    await entry.transport.handleRequest(req, res)
  }

  app.post(appConfig.mcpPath, originGuard, authMiddleware, postHandler)
  app.get(appConfig.mcpPath, originGuard, authMiddleware, getHandler)
  app.delete(appConfig.mcpPath, originGuard, authMiddleware, deleteHandler)

  app.use((error: Error, _req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], _next: Parameters<RequestHandler>[2]) => {
    logger.error({ err: error }, 'Unhandled HTTP error')
    if (res.headersSent) {
      return
    }

    res.status(500).send(error.message)
  })

  const httpServer = http.createServer(app)

  return {
    app,
    httpServer,
    database
  }
}

