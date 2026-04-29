import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import nock from 'nock'

import { createAuthenticatedClient, startTestServer, type TestServerHandle } from '../helpers/http-server.js'

describe('HTTP MCP Integration', () => {
  let serverHandle: TestServerHandle

  beforeAll(async () => {
    serverHandle = await startTestServer()
  })

  afterAll(async () => {
    nock.cleanAll()
    await serverHandle.stop()
  })

  it('connects over Streamable HTTP and calls list_folder through Dropbox network mocks', async () => {
    nock('https://api.dropboxapi.com')
      .post('/2/files/list_folder')
      .reply(200, {
        entries: [],
        cursor: 'cursor-1',
        has_more: false
      })

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl, 'integration-token')
    const tools = await client.listTools()
    const result = await client.callTool({
      name: 'list_folder',
      arguments: {
        path: ''
      }
    })
    const toolResult = result as { content: Array<{ type: string; text: string }> }

    expect(tools.tools.some(tool => tool.name === 'list_folder')).toBe(true)
    expect(toolResult.content[0].type).toBe('text')
    await transport.terminateSession()
    await transport.close()
  })
})
