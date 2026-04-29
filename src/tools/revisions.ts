import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { baseArgsSchema } from './schemas.js'
import { callDropbox, createPathTag, createToolTextResult, executeDropboxTool, normalizeDropboxPath } from './runtime.js'

const listRevisionsInputSchema = baseArgsSchema.extend({
  path: z.string().min(1),
  mode: z.enum(['path', 'id']).optional(),
  limit: z.number().int().positive().optional()
})

const restoreRevisionInputSchema = baseArgsSchema.extend({
  path: z.string().min(1),
  rev: z.string().min(1)
})

export function registerRevisionTools(server: McpServer): void {
  server.registerTool(
    'list_revisions',
    {
      description: 'List Dropbox file revisions',
      inputSchema: listRevisionsInputSchema
    },
    async args => {
      return executeDropboxTool('list_revisions', '/2/files/list_revisions', args.path_root, async client => {
        const response = await callDropbox('/2/files/list_revisions', () => client.filesListRevisions({
          path: normalizeDropboxPath(args.path),
          mode: args.mode ? createPathTag(args.mode) : undefined,
          limit: args.limit
        }))

        return createToolTextResult(response.result)
      })
    }
  )

  server.registerTool(
    'restore_revision',
    {
      description: 'Restore a Dropbox file revision',
      inputSchema: restoreRevisionInputSchema
    },
    async args => {
      return executeDropboxTool('restore_revision', '/2/files/restore', args.path_root, async client => {
        const response = await callDropbox('/2/files/restore', () => client.filesRestore({
          path: normalizeDropboxPath(args.path),
          rev: args.rev
        }))

        return createToolTextResult(response.result)
      })
    }
  )
}
