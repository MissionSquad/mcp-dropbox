import { describe, expect, it, vi } from 'vitest'

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

vi.mock('../src/dropbox/client-factory.js', () => {
  return {
    createDropboxClient: vi.fn()
  }
})

import { createDropboxClient } from '../src/dropbox/client-factory.js'

describe('tool registration', () => {
  it('registers account tools and resolves auth from hidden extraArgs', async () => {
    const fakeServer = createFakeServer()
    registerAccountTools(fakeServer as any)

    const tool = fakeServer.tools.find(entry => entry.name === 'get_current_account')
    expect(tool).toBeDefined()

    const mockClient = {
      usersGetCurrentAccount: vi.fn().mockResolvedValue({
        result: {
          account_id: 'dbid:test'
        }
      })
    }

    vi.mocked(createDropboxClient).mockReturnValue(mockClient as any)

    const result = await tool!.execute({}, { extraArgs: { accessToken: 'hidden-token' } })
    expect(mockClient.usersGetCurrentAccount).toHaveBeenCalledOnce()
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
