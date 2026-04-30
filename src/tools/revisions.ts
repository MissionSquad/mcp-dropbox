import { z } from 'zod'

import { baseArgsSchema } from './schemas.js'
import type { ToolRegistry } from './registry.js'
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

export function registerRevisionTools(server: ToolRegistry): void {
  server.addTool({
    name: 'list_revisions',
    description: 'List Dropbox file revisions',
    parameters: listRevisionsInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('list_revisions', '/2/files/list_revisions', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/list_revisions', () => client.filesListRevisions({
          path: normalizeDropboxPath(args.path),
          mode: args.mode ? createPathTag(args.mode) : undefined,
          limit: args.limit
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'restore_revision',
    description: 'Restore a Dropbox file revision',
    parameters: restoreRevisionInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('restore_revision', '/2/files/restore', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/restore', () => client.filesRestore({
          path: normalizeDropboxPath(args.path),
          rev: args.rev
        }))

        return createToolTextResult(response.result)
      })
    }
  })
}
