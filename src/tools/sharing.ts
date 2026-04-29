import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DropboxResponseError } from 'dropbox'

import { baseArgsSchema, sharedLinkSettingsSchema } from './schemas.js'
import { buildDirectDownloadUrl, callDropbox, createPathTag, createToolTextResult, executeDropboxTool, normalizeDropboxPath } from './runtime.js'

const createSharedLinkInputSchema = baseArgsSchema.extend({
  path: z.string().min(1),
  requested_visibility: z.enum(['public', 'team_only', 'password']).optional().default('public'),
  audience: z.enum(['public', 'team', 'no_one', 'password', 'members']).optional().default('public'),
  access: z.enum(['viewer', 'editor', 'max', 'default']).optional(),
  allow_download: z.boolean().optional().default(true),
  expires: z.string().datetime().optional(),
  link_password: z.string().min(1).optional(),
  require_password: z.boolean().optional()
})

const getTemporaryLinkInputSchema = baseArgsSchema.extend({
  path: z.string().min(1)
})

const listSharedLinksInputSchema = baseArgsSchema.extend({
  path: z.string().optional(),
  cursor: z.string().optional(),
  direct_only: z.boolean().optional()
})

const revokeSharedLinkInputSchema = baseArgsSchema.extend({
  url: z.string().url()
})

const modifySharedLinkInputSchema = baseArgsSchema.extend({
  url: z.string().url(),
  settings: sharedLinkSettingsSchema,
  remove_expiration: z.boolean().optional()
})

const getSharedLinkMetadataInputSchema = baseArgsSchema.extend({
  url: z.string().url(),
  path: z.string().optional(),
  link_password: z.string().min(1).optional()
})

function toSharedLinkSettings(args: z.infer<typeof createSharedLinkInputSchema> | z.infer<typeof modifySharedLinkInputSchema>['settings']) {
  return {
    requested_visibility: args.requested_visibility ? createPathTag(args.requested_visibility) : undefined,
    audience: args.audience ? createPathTag(args.audience) : undefined,
    access: args.access ? createPathTag(args.access) : undefined,
    allow_download: args.allow_download,
    expires: args.expires,
    link_password: args.link_password,
    require_password: args.require_password
  }
}

export function registerSharingTools(server: McpServer): void {
  server.registerTool(
    'create_shared_link',
    {
      description: 'Preferred for reusable public download links. Create a persistent Dropbox shared link for a file or folder when you need a link that can be shared and opened later by anyone. The result includes both the normal Dropbox URL and direct_download_url for anonymous download. Defaults are optimized for public no-sign-in download, but callers should check resolved_visibility in the result because Dropbox account or team policy can downgrade public access.',
      inputSchema: createSharedLinkInputSchema
    },
    async args => {
      return executeDropboxTool('create_shared_link', '/2/sharing/create_shared_link_with_settings', args.path_root, async client => {
        try {
          const response = await callDropbox('/2/sharing/create_shared_link_with_settings', () => client.sharingCreateSharedLinkWithSettings({
            path: normalizeDropboxPath(args.path),
            settings: toSharedLinkSettings(args)
          }))

          const result = response.result

          return createToolTextResult({
            ...result,
            direct_download_url: buildDirectDownloadUrl(result.url),
            resolved_visibility: result.link_permissions.resolved_visibility ?? null
          })
        } catch (error) {
          if (error instanceof DropboxResponseError) {
            const payload = error.error as { error?: Record<string, unknown> }
            const tag = payload.error?.['.tag']

            if (tag === 'shared_link_already_exists') {
              const links = await callDropbox('/2/sharing/list_shared_links', () => client.sharingListSharedLinks({
                path: normalizeDropboxPath(args.path),
                direct_only: true
              }))

              const existing = links.result.links[0]

              if (existing) {
                return createToolTextResult({
                  ...existing,
                  direct_download_url: buildDirectDownloadUrl(existing.url),
                  resolved_visibility: existing.link_permissions.resolved_visibility ?? null,
                  reused_existing_link: true
                })
              }
            }
          }

          throw error
        }
      })
    }
  )

  server.registerTool(
    'get_temporary_link',
    {
      description: 'Preferred for short-lived anonymous download links. Return a temporary direct-download Dropbox URL for a file when you need a link that anyone can use without signing into Dropbox, but only for a limited time. The link is intended for direct file download and expires after about 4 hours.',
      inputSchema: getTemporaryLinkInputSchema
    },
    async args => {
      return executeDropboxTool('get_temporary_link', '/2/files/get_temporary_link', args.path_root, async client => {
        const response = await callDropbox('/2/files/get_temporary_link', () => client.filesGetTemporaryLink({
          path: normalizeDropboxPath(args.path)
        }))

        return createToolTextResult(response.result)
      })
    }
  )

  server.registerTool(
    'list_shared_links',
    {
      description: 'List Dropbox shared links',
      inputSchema: listSharedLinksInputSchema
    },
    async args => {
      return executeDropboxTool('list_shared_links', '/2/sharing/list_shared_links', args.path_root, async client => {
        const response = await callDropbox('/2/sharing/list_shared_links', () => client.sharingListSharedLinks({
          path: args.path ? normalizeDropboxPath(args.path) : undefined,
          cursor: args.cursor,
          direct_only: args.direct_only
        }))

        return createToolTextResult(response.result)
      })
    }
  )

  server.registerTool(
    'revoke_shared_link',
    {
      description: 'Revoke a Dropbox shared link',
      inputSchema: revokeSharedLinkInputSchema
    },
    async args => {
      return executeDropboxTool('revoke_shared_link', '/2/sharing/revoke_shared_link', args.path_root, async client => {
        await callDropbox('/2/sharing/revoke_shared_link', () => client.sharingRevokeSharedLink({
          url: args.url
        }))

        return createToolTextResult({
          revoked: true,
          url: args.url
        })
      })
    }
  )

  server.registerTool(
    'modify_shared_link_settings',
    {
      description: 'Modify Dropbox shared link settings',
      inputSchema: modifySharedLinkInputSchema
    },
    async args => {
      return executeDropboxTool('modify_shared_link_settings', '/2/sharing/modify_shared_link_settings', args.path_root, async client => {
        const response = await callDropbox('/2/sharing/modify_shared_link_settings', () => client.sharingModifySharedLinkSettings({
          url: args.url,
          settings: toSharedLinkSettings(args.settings),
          remove_expiration: args.remove_expiration
        }))

        return createToolTextResult(response.result)
      })
    }
  )

  server.registerTool(
    'get_shared_link_metadata',
    {
      description: 'Get Dropbox shared link metadata',
      inputSchema: getSharedLinkMetadataInputSchema
    },
    async args => {
      return executeDropboxTool('get_shared_link_metadata', '/2/sharing/get_shared_link_metadata', args.path_root, async client => {
        const response = await callDropbox('/2/sharing/get_shared_link_metadata', () => client.sharingGetSharedLinkMetadata({
          url: args.url,
          path: args.path,
          link_password: args.link_password
        }))

        return createToolTextResult(response.result)
      })
    }
  )
}
