import pino, { type DestinationStream, type Logger } from 'pino'

import { appConfig } from './config.js'

export function createLogger(destination?: DestinationStream): Logger {
  return pino({
    level: appConfig.logLevel,
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
  }, destination ?? pino.destination({ dest: 2, sync: true }))
}

export const logger = createLogger()
