import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/app-context.js', () => {
  return {
    getAppContext: vi.fn()
  }
})

import { getAppContext } from '../src/app-context.js'
import { executeDropboxTool } from '../src/tools/runtime.js'

describe('executeDropboxTool', () => {
  it('executes against the linked Dropbox account from authInfo', async () => {
    const executeForLinkedAccount = vi.fn().mockResolvedValue({
      result: { ok: true },
      usedDelegatedUser: false
    })

    vi.mocked(getAppContext).mockReturnValue({
      database: {} as never,
      oauthProvider: {} as never,
      dropboxAccountService: {
        executeForLinkedAccount
      } as never
    })

    const callback = vi.fn()

    const result = await executeDropboxTool(
      'test_tool',
      '/2/test',
      undefined,
      {
        authInfo: {
          token: 'mcp-token',
          clientId: 'client-1',
          scopes: [],
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          extra: {
            linkedAccountId: 'linked-account-1'
          }
        }
      } as any,
      callback
    )

    expect(result).toEqual({ ok: true })
    expect(executeForLinkedAccount).toHaveBeenCalledWith(
      'linked-account-1',
      undefined,
      '/2/test',
      callback
    )
  })

  it('fails when authInfo does not include a linked account id', async () => {
    await expect(
      executeDropboxTool(
        'test_tool',
        '/2/test',
        undefined,
        {
          authInfo: {
            token: 'mcp-token',
            clientId: 'client-1',
            scopes: [],
            expiresAt: Math.floor(Date.now() / 1000) + 3600
          }
        } as any,
        async () => ({ ok: true })
      )
    ).rejects.toThrow(/Missing linked Dropbox account context/)
  })
})
