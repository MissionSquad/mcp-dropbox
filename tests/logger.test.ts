import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { createLogger } from '../src/logger.js'

describe('logger redaction', () => {
  it('redacts tokens from structured logs', async () => {
    const stream = new PassThrough()
    const chunks: string[] = []

    stream.on('data', chunk => {
      chunks.push(chunk.toString())
    })

    const logger = createLogger(stream)
    logger.info({ accessToken: 'secret-token' }, 'test')

    await new Promise(resolve => {
      stream.end(resolve)
    })

    const output = chunks.join('')
    expect(output).toContain('[REDACTED]')
    expect(output).not.toContain('secret-token')
  })
})
