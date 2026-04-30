import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/app-context.js', () => {
  return {
    getAppContext: vi.fn()
  }
})

import { getAppContext } from '../src/app-context.js'
import { registerAccountTools } from '../src/tools/account.js'
import { registerSharingTools } from '../src/tools/sharing.js'

interface CapturedTool {
  name: string
  description?: string
  parameters?: unknown
  execute: (args: any, context: any) => Promise<unknown>
}

function createFakeServer() {
  const tools: CapturedTool[] = []

  return {
    tools,
    addTool(tool: CapturedTool) {
      tools.push(tool)
    }
  }
}

describe('tool registration', () => {
  it('registers account tools and executes through the linked-account service', async () => {
    const fakeServer = createFakeServer()
    registerAccountTools(fakeServer as any)

    const tool = fakeServer.tools.find(entry => entry.name === 'get_current_account')
    expect(tool).toBeDefined()

    const executeForLinkedAccount = vi.fn().mockImplementation(async (_linkedAccountId, _pathRoot, _endpoint, callback) => {
      return {
        result: await callback({
          usersGetCurrentAccount: vi.fn().mockResolvedValue({
            result: {
              account_id: 'dbid:test'
            }
          })
        }),
        usedDelegatedUser: false
      }
    })

    vi.mocked(getAppContext).mockReturnValue({
      database: {} as never,
      oauthProvider: {} as never,
      dropboxAccountService: {
        executeForLinkedAccount
      } as never
    })

    const result = await tool!.execute(
      {},
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
      }
    )

    expect(executeForLinkedAccount).toHaveBeenCalledOnce()
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ account_id: 'dbid:test' }, null, 2)
        }
      ]
    })
  })

  it('describes the anonymous download link behavior clearly', () => {
    const fakeServer = createFakeServer()
    registerSharingTools(fakeServer as any)

    const persistent = fakeServer.tools.find(entry => entry.name === 'create_shared_link')
    const temporary = fakeServer.tools.find(entry => entry.name === 'get_temporary_link')

    expect(persistent?.description).toMatch(/Preferred for reusable public download links/)
    expect(temporary?.description).toMatch(/Preferred for short-lived anonymous download links/)
  })
})
