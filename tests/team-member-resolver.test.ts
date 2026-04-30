import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/dropbox/client-factory.js', () => {
  return {
    createDropboxClient: vi.fn()
  }
})

import { createDropboxClient } from '../src/dropbox/client-factory.js'
import { resolveDelegationSelectors } from '../src/dropbox/team-member-resolver.js'

describe('resolveDelegationSelectors', () => {
  it('passes dbmid values through unchanged', async () => {
    await expect(resolveDelegationSelectors('token-1', 'dbmid:user-1')).rejects.toThrow(
      /valid Dropbox account email address/
    )
  })

  it('resolves emails to team member ids and reuses the cache', async () => {
    const mockClient = {
      teamMembersGetInfo: vi.fn().mockResolvedValue({
        result: [
          {
            '.tag': 'member_info',
            profile: {
              team_member_id: 'dbmid:user-1',
              email: 'user@example.com'
            },
            role: {
              '.tag': 'team_admin'
            }
          }
        ]
      })
    }

    vi.mocked(createDropboxClient).mockReturnValue(mockClient as any)

    const first = await resolveDelegationSelectors('token-2', 'user@example.com')
    const second = await resolveDelegationSelectors('token-2', 'user@example.com')

    expect(first).toEqual({
      selectUser: 'dbmid:user-1',
      selectAdmin: 'dbmid:user-1'
    })
    expect(second).toEqual(first)
    expect(mockClient.teamMembersGetInfo).toHaveBeenCalledTimes(1)
  })

  it('does not populate selectAdmin for non-admin emails', async () => {
    const mockClient = {
      teamMembersGetInfo: vi.fn().mockResolvedValue({
        result: [
          {
            '.tag': 'member_info',
            profile: {
              team_member_id: 'dbmid:user-2',
              email: 'member@example.com'
            },
            role: {
              '.tag': 'member_only'
            }
          }
        ]
      })
    }

    vi.mocked(createDropboxClient).mockReturnValue(mockClient as any)

    const result = await resolveDelegationSelectors('token-3', 'member@example.com')
    expect(result).toEqual({
      selectUser: 'dbmid:user-2',
      selectAdmin: undefined
    })
  })
})
