import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

import * as clientFactory from '../../src/dropbox/client-factory.js'
import { createAuthenticatedClient, startTestServer, type TestServerHandle } from '../helpers/http-server.js'
import { buildDropboxResponse, createMockDropboxClient } from '../helpers/dropbox-mocks.js'

describe('Upload and Download Tools', () => {
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

  it('calls upload_file with direct upload', async () => {
    mockClient.filesUpload.mockResolvedValue(buildDropboxResponse({
      '.tag': 'file',
      name: 'upload.txt'
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'upload_file',
      arguments: {
        path: '/upload.txt',
        content: Buffer.from('hello world').toString('base64')
      }
    })

    expect(mockClient.filesUpload).toHaveBeenCalled()
    await transport.terminateSession()
    await transport.close()
  })

  it('routes upload_file_chunked to direct upload for small files', async () => {
    mockClient.filesUpload.mockResolvedValue(buildDropboxResponse({
      '.tag': 'file',
      name: 'small.txt'
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'upload_file_chunked',
      arguments: {
        path: '/small.txt',
        content: Buffer.from('small').toString('base64')
      }
    })

    expect(mockClient.filesUpload).toHaveBeenCalled()
    expect(mockClient.filesUploadSessionStart).not.toHaveBeenCalled()
    await transport.terminateSession()
    await transport.close()
  })

  it('routes upload_file_chunked to session upload for large files', async () => {
    const largeBuffer = Buffer.alloc(151 * 1024 * 1024, 1)

    mockClient.filesUploadSessionStart.mockResolvedValue(buildDropboxResponse({
      session_id: 'session-1'
    }))
    mockClient.filesUploadSessionAppendV2.mockResolvedValue(buildDropboxResponse(undefined))
    mockClient.filesUploadSessionFinish.mockResolvedValue(buildDropboxResponse({
      '.tag': 'file',
      name: 'large.bin'
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'upload_file_chunked',
      arguments: {
        path: '/large.bin',
        content: largeBuffer.toString('base64'),
        chunk_size_bytes: 8 * 1024 * 1024
      }
    })

    expect(mockClient.filesUploadSessionStart).toHaveBeenCalled()
    expect(mockClient.filesUploadSessionFinish).toHaveBeenCalled()
    await transport.terminateSession()
    await transport.close()
  })

  it('calls download_file and returns base64 output', async () => {
    mockClient.filesDownload.mockResolvedValue(buildDropboxResponse({
      '.tag': 'file',
      name: 'download.txt',
      content_hash: 'hash-1',
      fileBinary: Buffer.from('downloaded')
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    const result = await client.callTool({
      name: 'download_file',
      arguments: {
        path: '/download.txt'
      }
    })
    const toolResult = result as { content: Array<{ type: string; text: string }> }

    expect(toolResult.content[0].type).toBe('text')
    expect(mockClient.filesDownload).toHaveBeenCalledWith({ path: '/download.txt' })
    await transport.terminateSession()
    await transport.close()
  })
})
