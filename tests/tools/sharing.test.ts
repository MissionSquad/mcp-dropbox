import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

import * as clientFactory from '../../src/dropbox/client-factory.js'
import { createAuthenticatedClient, startTestServer, type TestServerHandle } from '../helpers/http-server.js'
import { buildDropboxResponse, createMockDropboxClient } from '../helpers/dropbox-mocks.js'

describe('Sharing Tools', () => {
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

  it('calls create_shared_link', async () => {
    mockClient.sharingCreateSharedLinkWithSettings.mockResolvedValue(buildDropboxResponse({
      url: 'https://www.dropbox.com/scl/fi/example/file.txt?dl=0',
      name: 'file.txt',
      link_permissions: {
        resolved_visibility: {
          '.tag': 'public'
        }
      }
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    const result = await client.callTool({
      name: 'create_shared_link',
      arguments: {
        path: '/file.txt'
      }
    })
    const toolResult = result as { content: Array<{ type: string; text: string }> }

    expect(mockClient.sharingCreateSharedLinkWithSettings).toHaveBeenCalled()
    expect(toolResult.content[0].type).toBe('text')
    await transport.terminateSession()
    await transport.close()
  })

  it('calls get_temporary_link', async () => {
    mockClient.filesGetTemporaryLink.mockResolvedValue(buildDropboxResponse({
      metadata: {
        '.tag': 'file',
        name: 'file.txt'
      },
      link: 'https://dl.dropboxusercontent.com/apitl/1/example'
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'get_temporary_link',
      arguments: {
        path: '/file.txt'
      }
    })

    expect(mockClient.filesGetTemporaryLink).toHaveBeenCalledWith({ path: '/file.txt' })
    await transport.terminateSession()
    await transport.close()
  })

  it('calls list_shared_links', async () => {
    mockClient.sharingListSharedLinks.mockResolvedValue(buildDropboxResponse({
      links: [],
      has_more: false
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'list_shared_links',
      arguments: {}
    })

    expect(mockClient.sharingListSharedLinks).toHaveBeenCalled()
    await transport.terminateSession()
    await transport.close()
  })

  it('calls revoke_shared_link', async () => {
    mockClient.sharingRevokeSharedLink.mockResolvedValue(buildDropboxResponse(undefined))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'revoke_shared_link',
      arguments: {
        url: 'https://www.dropbox.com/s/example'
      }
    })

    expect(mockClient.sharingRevokeSharedLink).toHaveBeenCalledWith({ url: 'https://www.dropbox.com/s/example' })
    await transport.terminateSession()
    await transport.close()
  })

  it('calls modify_shared_link_settings', async () => {
    mockClient.sharingModifySharedLinkSettings.mockResolvedValue(buildDropboxResponse({
      url: 'https://www.dropbox.com/s/example',
      name: 'file.txt',
      link_permissions: {
        resolved_visibility: {
          '.tag': 'public'
        }
      }
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'modify_shared_link_settings',
      arguments: {
        url: 'https://www.dropbox.com/s/example',
        settings: {
          allow_download: true
        }
      }
    })

    expect(mockClient.sharingModifySharedLinkSettings).toHaveBeenCalled()
    await transport.terminateSession()
    await transport.close()
  })

  it('calls get_shared_link_metadata', async () => {
    mockClient.sharingGetSharedLinkMetadata.mockResolvedValue(buildDropboxResponse({
      '.tag': 'file',
      url: 'https://www.dropbox.com/s/example',
      name: 'file.txt',
      link_permissions: {
        can_revoke: true,
        visibility_policies: [],
        can_set_expiry: false,
        can_remove_expiry: false,
        allow_download: true,
        can_allow_download: true,
        can_disallow_download: true,
        allow_comments: false
      }
    }))

    const { client, transport } = await createAuthenticatedClient(serverHandle.baseUrl)
    await client.callTool({
      name: 'get_shared_link_metadata',
      arguments: {
        url: 'https://www.dropbox.com/s/example'
      }
    })

    expect(mockClient.sharingGetSharedLinkMetadata).toHaveBeenCalledWith({
      url: 'https://www.dropbox.com/s/example',
      path: undefined,
      link_password: undefined
    })
    await transport.terminateSession()
    await transport.close()
  })
})
