import { describe, expect, it, jest } from '@jest/globals'

import { gracefulShutdown } from '../../src/shutdown.js'

describe('gracefulShutdown', () => {
  it('closes sessions and waits for the HTTP server to close', async () => {
    const closeSessions = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
    const server = {
      close(callback: (error?: Error | null) => void) {
        callback(null)
        return this
      }
    }

    await gracefulShutdown({
      closeSessions,
      server: server as never,
      timeoutMs: 1000
    })

    expect(closeSessions).toHaveBeenCalled()
  })
})
