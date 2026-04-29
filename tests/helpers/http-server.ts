import type { AddressInfo } from 'node:net'
import type { Server as HttpServer } from 'node:http'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { closeSessions, createApp } from '../../src/server.js'

export interface TestServerHandle {
  baseUrl: string
  server: HttpServer
  stop: () => Promise<void>
}

export async function startTestServer(): Promise<TestServerHandle> {
  const app = createApp()

  const server = await new Promise<HttpServer>((resolve, reject) => {
    const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer))
    httpServer.once('error', reject)
  })

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`

  return {
    baseUrl,
    server,
    stop: async () => {
      await closeSessions()
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
    }
  }
}

export async function createAuthenticatedClient(baseUrl: string, token = 'test-token') {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  })

  const client = new Client({
    name: 'dbx-mcp-test-client',
    version: '0.1.0'
  })

  await client.connect(transport)

  return {
    client,
    transport
  }
}
