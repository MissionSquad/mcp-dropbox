import { DropboxResponseError } from 'dropbox'

import { appConfig } from '../config.js'

function readRetryAfter(error: DropboxResponseError<unknown>): number {
  const retryAfterHeader = error.headers?.get?.('retry-after')

  if (!retryAfterHeader) {
    return 0
  }

  const parsed = Number.parseInt(retryAfterHeader, 10)

  if (Number.isNaN(parsed)) {
    return 0
  }

  return parsed * 1000
}

function wait(durationMs: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, durationMs)
  })
}

export async function withDropboxRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0

  while (true) {
    try {
      return await operation()
    } catch (error) {
      attempt += 1

      if (!(error instanceof DropboxResponseError) || error.status !== 429 || attempt >= appConfig.dropboxRetryMaxAttempts) {
        throw error
      }

      const retryAfterMs = readRetryAfter(error)
      const exponentialDelayMs = appConfig.dropboxRetryBaseDelayMs * 2 ** (attempt - 1)

      await wait(retryAfterMs + exponentialDelayMs)
    }
  }
}
