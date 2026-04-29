import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

import * as clientFactory from '../../src/dropbox/client-factory.js'
import { createAuthenticatedClient, startTestServer, type TestServerHandle } from '../helpers/http-server.js'
import { buildDropboxResponse, createMockDropboxClient } from '../helpers/dropbox-mocks.js'

describe('Account Tools', () => {
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

  it('calls get_current_account', async () => {
    mockClient.usersGetCurrentAccount.mockResolvedValue(buildDropboxResponse({
      account_id: 'dbid:test',
      name: {
        display_name: 'Test User'
      }
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'get_current_account',
      arguments: {}
    })

    expect(mockClient.usersGetCurrentAccount).toHaveBeenCalled()
    await transport.terminateSession()
    await transport.close()
  })

  it('calls get_space_usage', async () => {
    mockClient.usersGetSpaceUsage.mockResolvedValue(buildDropboxResponse({
      used: 1024,
      allocation: {
        '.tag': 'individual',
        allocated: 4096
      }
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'get_space_usage',
      arguments: {}
    })

    expect(mockClient.usersGetSpaceUsage).toHaveBeenCalled()
    await transport.terminateSession()
    await transport.close()
  })
})
