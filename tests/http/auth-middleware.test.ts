import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import request from 'supertest'

import { createApp, closeSessions } from '../../src/server.js'

describe('HTTP Auth Middleware', () => {
  const app = createApp()

  beforeAll(async () => {
    await closeSessions()
  })

  afterAll(async () => {
    await closeSessions()
  })

  it('returns 200 from healthz', async () => {
    const response = await request(app).get('/healthz')
    expect(response.status).toBe(200)
    expect(response.text).toBe('OK')
  })

  it('rejects missing Dropbox tokens', async () => {
    const response = await request(app)
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 'initialize',
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'auth-test',
            version: '0.1.0'
          }
        }
      })

    expect(response.status).toBe(401)
    expect(response.body.error.data.code).toBe('missing_dropbox_access_token')
    expect(response.headers['x-request-id']).toBeDefined()
  })

  it('rejects invalid origins', async () => {
    const response = await request(app)
      .post('/mcp')
      .set('origin', 'https://evil.example')
      .set('authorization', 'Bearer token')
      .send({})

    expect(response.status).toBe(403)
    expect(response.body.error.data.code).toBe('invalid_origin')
  })
})
