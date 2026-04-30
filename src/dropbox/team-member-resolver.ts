import { UserError } from '@missionsquad/fastmcp'
import { SuperLRU, md5 } from 'superlru'

import { createDropboxClient } from './client-factory.js'

interface CachedTeamMember {
  teamMemberId: string
  email: string
  roleTag?: string
}

const teamMemberCache = new SuperLRU<string, CachedTeamMember>({
  maxSize: 500,
  compress: true
})

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)
}

function cacheKey(accessToken: string, value: string): string {
  return `${md5(accessToken)}:${value.trim().toLowerCase()}`
}

async function resolveMemberByEmail(
  accessToken: string,
  email: string
): Promise<CachedTeamMember> {
  const key = cacheKey(accessToken, email)
  const cached = await teamMemberCache.get(key)

  if (cached) {
    return cached
  }

  const client = createDropboxClient(accessToken)
  const response = await client.teamMembersGetInfo({
    members: [
      {
        '.tag': 'email',
        email
      }
    ]
  })

  const item = response.result[0]

  if (!item || item['.tag'] !== 'member_info') {
    throw new UserError(
      `Dropbox team member "${email}" was not found. Configure hidden argument "email" with a valid Dropbox account email.`
    )
  }

  const resolved: CachedTeamMember = {
    teamMemberId: item.profile.team_member_id,
    email: item.profile.email,
    roleTag: item.role['.tag']
  }

  await teamMemberCache.set(key, resolved)
  return resolved
}

export async function resolveDelegationSelectors(
  accessToken: string,
  email: string | undefined
): Promise<{ selectUser?: string; selectAdmin?: string }> {
  if (!email) {
    return {}
  }

  const trimmed = email.trim()

  if (trimmed.length === 0) {
    return {}
  }

  if (!isEmail(trimmed)) {
    throw new UserError('"email" must be a valid Dropbox account email address.')
  }

  const member = await resolveMemberByEmail(accessToken, trimmed)

  return {
    selectUser: member.teamMemberId,
    selectAdmin: member.roleTag === 'member_only' ? undefined : member.teamMemberId
  }
}
