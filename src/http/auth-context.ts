import type { NextFunction, Request, Response } from 'express'

import { createJsonRpcErrorPayload } from '../errors/mcp-server-error.js'
import { logger } from '../logger.js'
import type { RequestContext } from './request-context.js'

export interface AuthenticatedRequest extends Request {
  requestContext?: RequestContext
  requestId?: string
}

function readAuthorizationHeader(request: Request): string | undefined {
  const header = request.header('authorization')

  if (!header) {
    return undefined
  }

  const [scheme, token] = header.split(' ', 2)

  if (scheme !== 'Bearer' || !token) {
    return undefined
  }

  return token.trim()
}

function readFallbackHeader(request: Request): string | undefined {
  const header = request.header('x-dropbox-access-token')
  return header?.trim() || undefined
}

function readOptionalHeader(request: Request, name: string): string | undefined {
  const header = request.header(name)
  return header?.trim() || undefined
}

function readOptionalEnv(name: 'DROPBOX_SELECT_USER' | 'DROPBOX_SELECT_ADMIN'): string | undefined {
  const value = process.env[name]
  return value?.trim() || undefined
}

export function authContextMiddleware(request: AuthenticatedRequest, response: Response, next: NextFunction): void {
  const accessToken = readAuthorizationHeader(request) ?? readFallbackHeader(request)
  const requestId = request.requestId ?? 'unknown'

  if (!accessToken) {
    logger.warn(
      {
        requestId,
        method: request.method,
        path: request.path
      },
      'Rejected MCP request without Dropbox access token'
    )

    response.status(401).json(
      createJsonRpcErrorPayload(-32600, 'Missing Dropbox access token', {
        code: 'missing_dropbox_access_token',
        acceptedHeaders: ['Authorization: Bearer <token>', 'X-Dropbox-Access-Token: <token>']
      })
    )
    return
  }

  request.requestContext = {
    accessToken,
    requestId,
    selectUser: readOptionalHeader(request, 'x-dropbox-select-user') ?? readOptionalEnv('DROPBOX_SELECT_USER'),
    selectAdmin: readOptionalHeader(request, 'x-dropbox-select-admin') ?? readOptionalEnv('DROPBOX_SELECT_ADMIN')
  }
  next()
}
