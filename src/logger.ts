import pino, { type DestinationStream, type Logger } from 'pino'

import { config } from './config.js'

export function createLogger(destination?: DestinationStream): Logger {
  return pino({
    level: config.logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.x-dropbox-access-token',
        'authorization',
        'x-dropbox-access-token',
        'accessToken',
        'refreshToken'
      ],
      censor: '[REDACTED]'
    }
  }, destination)
}

export const logger = createLogger()
