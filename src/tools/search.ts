import { z } from 'zod'
import type { FastMCP } from '@missionsquad/fastmcp'

import { baseArgsSchema } from './schemas.js'
import { callDropbox, createPathTag, createToolTextResult, executeDropboxTool, normalizeDropboxPath } from './runtime.js'
import { logger } from '../logger.js'

const fileCategorySchema = z.enum([
  'image',
  'document',
  'pdf',
  'spreadsheet',
  'presentation',
  'audio',
  'video',
  'folder',
  'paper',
  'others'
])

const searchInputSchema = baseArgsSchema.extend({
  query: z.string().min(1),
  path: z.string().optional(),
  max_results: z.number().int().positive().optional(),
  order_by: z.enum(['relevance', 'last_modified_time']).optional(),
  file_status: z.enum(['active', 'deleted']).optional(),
  filename_only: z.boolean().optional(),
  file_extensions: z.array(z.string().min(1)).optional(),
  file_categories: z.array(fileCategorySchema).optional(),
  account_id: z.string().min(1).optional(),
  include_highlights: z.boolean().optional()
})

const searchContinueInputSchema = baseArgsSchema.extend({
  cursor: z.string().min(1)
})

export function registerSearchTools(server: FastMCP<undefined>): void {
  server.addTool({
    name: 'search',
    description: 'Search Dropbox files and folders with search_v2',
    parameters: searchInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('search', '/2/files/search_v2', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/search_v2', () => client.filesSearchV2({
          query: args.query,
          options: {
            path: args.path ? normalizeDropboxPath(args.path) : undefined,
            max_results: args.max_results,
            order_by: args.order_by ? createPathTag(args.order_by) : undefined,
            file_status: args.file_status ? createPathTag(args.file_status) : undefined,
            filename_only: args.filename_only,
            file_extensions: args.file_extensions,
            file_categories: args.file_categories?.map(category => createPathTag(category)),
            account_id: args.account_id
          },
          match_field_options: {
            include_highlights: args.include_highlights
          },
          include_highlights: args.include_highlights
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'search_file_db',
    description: 'Deprecated alias for search',
    parameters: searchInputSchema,
    execute: async (args, context) => {
      logger.warn({ toolName: 'search_file_db' }, 'Deprecated tool alias invoked')

      return executeDropboxTool('search_file_db', '/2/files/search_v2', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/search_v2', () => client.filesSearchV2({
          query: args.query,
          options: {
            path: args.path ? normalizeDropboxPath(args.path) : undefined,
            max_results: args.max_results,
            order_by: args.order_by ? createPathTag(args.order_by) : undefined,
            file_status: args.file_status ? createPathTag(args.file_status) : undefined,
            filename_only: args.filename_only,
            file_extensions: args.file_extensions,
            file_categories: args.file_categories?.map(category => createPathTag(category)),
            account_id: args.account_id
          },
          match_field_options: {
            include_highlights: args.include_highlights
          },
          include_highlights: args.include_highlights
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'search_continue',
    description: 'Continue a Dropbox search_v2 cursor',
    parameters: searchContinueInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('search_continue', '/2/files/search/continue_v2', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/search/continue_v2', () => client.filesSearchContinueV2({
          cursor: args.cursor
        }))

        return createToolTextResult(response.result)
      })
    }
  })
}
