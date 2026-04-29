import { describe, expect, it } from '@jest/globals'
import { DropboxResponseError } from 'dropbox'

import { withDropboxRetry } from '../../src/dropbox/retry.js'

describe('withDropboxRetry', () => {
  it('retries 429 responses before succeeding', async () => {
    let attempts = 0

    const result = await withDropboxRetry(async () => {
      attempts += 1

      if (attempts < 2) {
        throw new DropboxResponseError(429, new Headers({ 'retry-after': '0' }), {
          error_summary: 'too_many_requests',
          error: {
            '.tag': 'too_many_requests'
          }
        })
      }

      return 'ok'
    })

    expect(result).toBe('ok')
    expect(attempts).toBe(2)
  })
})
