import type { NextFunction, Request, Response } from 'express'

import { config } from '../config.js'
import { createJsonRpcErrorPayload } from '../errors/mcp-server-error.js'
import { logger } from '../logger.js'

function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(origin)
}

function isAllowedOrigin(origin: string): boolean {
  if (config.allowedOrigins.includes(origin)) {
    return true
  }

  return isLocalOrigin(origin)
}

export function originGuardMiddleware(request: Request, response: Response, next: NextFunction): void {
  const origin = request.header('origin')
  const requestId = response.getHeader('x-request-id')

  if (!origin) {
    next()
    return
  }

  if (!isAllowedOrigin(origin)) {
    logger.warn(
      {
        requestId,
        method: request.method,
        path: request.path,
        origin
      },
      'Rejected MCP request from invalid origin'
    )

    response.status(403).json(
      createJsonRpcErrorPayload(-32600, 'Forbidden origin', {
        code: 'invalid_origin'
      })
    )
    return
  }

  next()
}
