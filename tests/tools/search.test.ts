import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

import * as clientFactory from '../../src/dropbox/client-factory.js'
import { createAuthenticatedClient, startTestServer, type TestServerHandle } from '../helpers/http-server.js'
import { buildDropboxResponse, createMockDropboxClient } from '../helpers/dropbox-mocks.js'

describe('Search Tools', () => {
  let serverHandle: TestServerHandle
  let mockClient: ReturnType<typeof createMockDropboxClient>

  beforeAll(async () => {
    serverHandle = await startTestServer()
  })

  afterAll(async () => {
    await serverHandle.stop()
  })

  beforeEach(() => {
    mockClient = createMockDropboxClient()
    jest.spyOn(clientFactory, 'createDropboxClient').mockReturnValue(mockClient as never)
  })

  it('calls search', async () => {
    mockClient.filesSearchV2.mockResolvedValue(buildDropboxResponse({
      matches: [],
      has_more: false
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'search',
      arguments: {
        query: 'report'
      }
    })

    expect(mockClient.filesSearchV2).toHaveBeenCalled()
    await transport.terminateSession()
    await transport.close()
  })

  it('calls deprecated search_file_db alias', async () => {
    mockClient.filesSearchV2.mockResolvedValue(buildDropboxResponse({
      matches: [],
      has_more: false
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'search_file_db',
      arguments: {
        query: 'legacy'
      }
    })

    expect(mockClient.filesSearchV2).toHaveBeenCalled()
    await transport.terminateSession()
    await transport.close()
  })

  it('calls search_continue', async () => {
    mockClient.filesSearchContinueV2.mockResolvedValue(buildDropboxResponse({
      matches: [],
      has_more: false
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'search_continue',
      arguments: {
        cursor: 'cursor-1'
      }
    })

    expect(mockClient.filesSearchContinueV2).toHaveBeenCalledWith({ cursor: 'cursor-1' })
    await transport.terminateSession()
    await transport.close()
  })
})
