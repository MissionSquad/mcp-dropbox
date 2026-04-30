import type { Request, Response, NextFunction, RequestHandler } from 'express'

import { appConfig } from '../config.js'

function resolveAllowedOrigins(): string[] {
  if (appConfig.allowedOrigins.length > 0) {
    return appConfig.allowedOrigins
  }

  return [new URL(appConfig.publicBaseUrl).origin]
}

export function createOriginGuard(): RequestHandler {
  const allowedOrigins = new Set(resolveAllowedOrigins())

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin

    if (!origin) {
      next()
      return
    }

    if (!allowedOrigins.has(origin)) {
      res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32003,
          message: 'Invalid Origin header'
        },
        id: null
      })
      return
    }

    next()
  }
}

