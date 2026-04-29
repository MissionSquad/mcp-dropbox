import { PassThrough } from 'node:stream'

import { describe, expect, it } from '@jest/globals'

import { createLogger } from '../src/logger.js'

describe('logger redaction', () => {
  it('redacts Dropbox bearer tokens from structured logs', async () => {
    const stream = new PassThrough()
    const chunks: string[] = []

    stream.on('data', chunk => {
      chunks.push(chunk.toString())
    })

    const logger = createLogger(stream)

    logger.info({
      authorization: 'Bearer secret-token',
      accessToken: 'secret-token'
    }, 'test')

    await new Promise(resolve => {
      stream.end(resolve)
    })

    const output = chunks.join('')

    expect(output).toContain('[REDACTED]')
    expect(output).not.toContain('secret-token')
  })
})
