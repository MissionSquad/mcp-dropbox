import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

import * as clientFactory from '../../src/dropbox/client-factory.js'
import { createAuthenticatedClient, startTestServer, type TestServerHandle } from '../helpers/http-server.js'
import { buildDropboxResponse, createMockDropboxClient } from '../helpers/dropbox-mocks.js'

describe('Revision Tools', () => {
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

  it('calls list_revisions', async () => {
    mockClient.filesListRevisions.mockResolvedValue(buildDropboxResponse({
      is_deleted: false,
      entries: []
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'list_revisions',
      arguments: {
        path: '/history.txt'
      }
    })

    expect(mockClient.filesListRevisions).toHaveBeenCalledWith(expect.objectContaining({ path: '/history.txt' }))
    await transport.terminateSession()
    await transport.close()
  })

  it('calls restore_revision', async () => {
    mockClient.filesRestore.mockResolvedValue(buildDropboxResponse({
      '.tag': 'file',
      name: 'history.txt'
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'restore_revision',
      arguments: {
        path: '/history.txt',
        rev: 'a1c10ce0dd78'
      }
    })

    expect(mockClient.filesRestore).toHaveBeenCalledWith({
      path: '/history.txt',
      rev: 'a1c10ce0dd78'
    })
    await transport.terminateSession()
    await transport.close()
  })
})
