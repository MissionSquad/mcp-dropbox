import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

import * as clientFactory from '../../src/dropbox/client-factory.js'
import { createAuthenticatedClient, startTestServer, type TestServerHandle } from '../helpers/http-server.js'
import { buildDropboxResponse, createMockDropboxClient } from '../helpers/dropbox-mocks.js'

describe('File Operation Tools', () => {
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

  it('calls list_folder', async () => {
    mockClient.filesListFolder.mockResolvedValue(buildDropboxResponse({
      entries: [],
      cursor: 'cursor-1',
      has_more: false
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    const result = await client.callTool({
      name: 'list_folder',
      arguments: {
        path: ''
      }
    })
    const toolResult = result as { content: Array<{ type: string; text: string }> }

    expect(mockClient.filesListFolder).toHaveBeenCalledWith(expect.objectContaining({ path: '' }))
    expect(toolResult.content[0].type).toBe('text')
    await transport.terminateSession()
    await transport.close()
  })

  it('calls list_folder_continue', async () => {
    mockClient.filesListFolderContinue.mockResolvedValue(buildDropboxResponse({
      entries: [],
      cursor: 'cursor-2',
      has_more: false
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'list_folder_continue',
      arguments: {
        cursor: 'cursor-1'
      }
    })

    expect(mockClient.filesListFolderContinue).toHaveBeenCalledWith({ cursor: 'cursor-1' })
    await transport.terminateSession()
    await transport.close()
  })

  it('calls get_metadata', async () => {
    mockClient.filesGetMetadata.mockResolvedValue(buildDropboxResponse({
      '.tag': 'file',
      name: 'test.txt'
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'get_metadata',
      arguments: {
        path: '/test.txt'
      }
    })

    expect(mockClient.filesGetMetadata).toHaveBeenCalledWith(expect.objectContaining({ path: '/test.txt' }))
    await transport.terminateSession()
    await transport.close()
  })

  it('calls create_folder', async () => {
    mockClient.filesCreateFolderV2.mockResolvedValue(buildDropboxResponse({
      metadata: {
        '.tag': 'folder',
        name: 'folder'
      }
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'create_folder',
      arguments: {
        path: '/folder'
      }
    })

    expect(mockClient.filesCreateFolderV2).toHaveBeenCalledWith({ path: '/folder', autorename: undefined })
    await transport.terminateSession()
    await transport.close()
  })

  it('calls delete', async () => {
    mockClient.filesDeleteV2.mockResolvedValue(buildDropboxResponse({
      metadata: {
        '.tag': 'deleted',
        name: 'old.txt'
      }
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'delete',
      arguments: {
        path: '/old.txt'
      }
    })

    expect(mockClient.filesDeleteV2).toHaveBeenCalledWith({ path: '/old.txt', parent_rev: undefined })
    await transport.terminateSession()
    await transport.close()
  })

  it('polls delete_batch until complete', async () => {
    mockClient.filesDeleteBatch.mockResolvedValue(buildDropboxResponse({
      '.tag': 'async_job_id',
      async_job_id: 'job-1'
    }))
    mockClient.filesDeleteBatchCheck.mockResolvedValue(buildDropboxResponse({
      '.tag': 'complete',
      entries: []
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'delete_batch',
      arguments: {
        entries: [{ path: '/old.txt' }]
      }
    })

    expect(mockClient.filesDeleteBatch).toHaveBeenCalled()
    expect(mockClient.filesDeleteBatchCheck).toHaveBeenCalledWith({ async_job_id: 'job-1' })
    await transport.terminateSession()
    await transport.close()
  })

  it('calls move', async () => {
    mockClient.filesMoveV2.mockResolvedValue(buildDropboxResponse({
      metadata: {
        '.tag': 'file',
        name: 'moved.txt'
      }
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'move',
      arguments: {
        from_path: '/a.txt',
        to_path: '/b.txt'
      }
    })

    expect(mockClient.filesMoveV2).toHaveBeenCalledWith(expect.objectContaining({
      from_path: '/a.txt',
      to_path: '/b.txt'
    }))
    await transport.terminateSession()
    await transport.close()
  })

  it('polls move_batch until complete', async () => {
    mockClient.filesMoveBatchV2.mockResolvedValue(buildDropboxResponse({
      '.tag': 'async_job_id',
      async_job_id: 'job-2'
    }))
    mockClient.filesMoveBatchCheckV2.mockResolvedValue(buildDropboxResponse({
      '.tag': 'complete',
      entries: []
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'move_batch',
      arguments: {
        entries: [{ from_path: '/a.txt', to_path: '/b.txt' }]
      }
    })

    expect(mockClient.filesMoveBatchCheckV2).toHaveBeenCalledWith({ async_job_id: 'job-2' })
    await transport.terminateSession()
    await transport.close()
  })

  it('calls copy', async () => {
    mockClient.filesCopyV2.mockResolvedValue(buildDropboxResponse({
      metadata: {
        '.tag': 'file',
        name: 'copy.txt'
      }
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'copy',
      arguments: {
        from_path: '/a.txt',
        to_path: '/copy/a.txt'
      }
    })

    expect(mockClient.filesCopyV2).toHaveBeenCalledWith(expect.objectContaining({
      from_path: '/a.txt',
      to_path: '/copy/a.txt'
    }))
    await transport.terminateSession()
    await transport.close()
  })

  it('polls copy_batch until complete', async () => {
    mockClient.filesCopyBatchV2.mockResolvedValue(buildDropboxResponse({
      '.tag': 'async_job_id',
      async_job_id: 'job-3'
    }))
    mockClient.filesCopyBatchCheckV2.mockResolvedValue(buildDropboxResponse({
      '.tag': 'complete',
      entries: []
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'copy_batch',
      arguments: {
        entries: [{ from_path: '/a.txt', to_path: '/copy/a.txt' }]
      }
    })

    expect(mockClient.filesCopyBatchCheckV2).toHaveBeenCalledWith({ async_job_id: 'job-3' })
    await transport.terminateSession()
    await transport.close()
  })
})
