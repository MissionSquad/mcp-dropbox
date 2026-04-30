import { z } from 'zod'

import { logger } from '../logger.js'
import { baseArgsSchema, batchPollingArgsSchema, relocationArgsSchema } from './schemas.js'
import type { ToolRegistry } from './registry.js'
import { callDropbox, createToolTextResult, executeDropboxTool, normalizeDropboxPath, pollAsyncJob } from './runtime.js'

const listFolderInputSchema = baseArgsSchema.extend({
  path: z.string().default(''),
  recursive: z.boolean().optional(),
  include_media_info: z.boolean().optional(),
  include_deleted: z.boolean().optional(),
  include_has_explicit_shared_members: z.boolean().optional(),
  include_mounted_folders: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
  include_non_downloadable_files: z.boolean().optional()
})

const listFolderContinueInputSchema = baseArgsSchema.extend({
  cursor: z.string().min(1)
})

const getMetadataInputSchema = baseArgsSchema.extend({
  path: z.string().min(1),
  include_media_info: z.boolean().optional(),
  include_deleted: z.boolean().optional(),
  include_has_explicit_shared_members: z.boolean().optional()
})

const createFolderInputSchema = baseArgsSchema.extend({
  path: z.string().min(1),
  autorename: z.boolean().optional()
})

const deleteInputSchema = baseArgsSchema.extend({
  path: z.string().min(1),
  parent_rev: z.string().min(1).optional()
})

const deleteBatchInputSchema = baseArgsSchema.merge(batchPollingArgsSchema).extend({
  entries: z.array(
    z.object({
      path: z.string().min(1),
      parent_rev: z.string().min(1).optional()
    })
  ).min(1)
})

const copyMoveBatchInputSchema = baseArgsSchema.merge(batchPollingArgsSchema).extend({
  entries: z.array(
    z.object({
      from_path: z.string().min(1),
      to_path: z.string().min(1)
    })
  ).min(1),
  autorename: z.boolean().optional(),
  allow_ownership_transfer: z.boolean().optional()
})

export function registerFileOperationTools(server: ToolRegistry): void {
  server.addTool({
    name: 'list_folder',
    description: 'List files and folders in a Dropbox path',
    parameters: listFolderInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('list_folder', '/2/files/list_folder', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/list_folder', () => client.filesListFolder({
          path: normalizeDropboxPath(args.path),
          recursive: args.recursive,
          include_media_info: args.include_media_info,
          include_deleted: args.include_deleted,
          include_has_explicit_shared_members: args.include_has_explicit_shared_members,
          include_mounted_folders: args.include_mounted_folders,
          limit: args.limit,
          include_non_downloadable_files: args.include_non_downloadable_files
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'list_files',
    description: 'Deprecated alias for list_folder',
    parameters: listFolderInputSchema,
    execute: async (args, context) => {
      logger.warn({ toolName: 'list_files' }, 'Deprecated tool alias invoked')
      return executeDropboxTool('list_files', '/2/files/list_folder', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/list_folder', () => client.filesListFolder({
          path: normalizeDropboxPath(args.path),
          recursive: args.recursive,
          include_media_info: args.include_media_info,
          include_deleted: args.include_deleted,
          include_has_explicit_shared_members: args.include_has_explicit_shared_members,
          include_mounted_folders: args.include_mounted_folders,
          limit: args.limit,
          include_non_downloadable_files: args.include_non_downloadable_files
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'list_folder_continue',
    description: 'Continue a Dropbox list_folder cursor',
    parameters: listFolderContinueInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('list_folder_continue', '/2/files/list_folder/continue', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/list_folder/continue', () => client.filesListFolderContinue({
          cursor: args.cursor
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'get_metadata',
    description: 'Get Dropbox metadata for a file or folder',
    parameters: getMetadataInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('get_metadata', '/2/files/get_metadata', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/get_metadata', () => client.filesGetMetadata({
          path: normalizeDropboxPath(args.path),
          include_media_info: args.include_media_info,
          include_deleted: args.include_deleted,
          include_has_explicit_shared_members: args.include_has_explicit_shared_members
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'create_folder',
    description: 'Create a Dropbox folder',
    parameters: createFolderInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('create_folder', '/2/files/create_folder_v2', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/create_folder_v2', () => client.filesCreateFolderV2({
          path: normalizeDropboxPath(args.path),
          autorename: args.autorename
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'delete',
    description: 'Delete a Dropbox file or folder',
    parameters: deleteInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('delete', '/2/files/delete_v2', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/delete_v2', () => client.filesDeleteV2({
          path: normalizeDropboxPath(args.path),
          parent_rev: args.parent_rev
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'delete_batch',
    description: 'Delete multiple Dropbox files or folders and poll until completion',
    parameters: deleteBatchInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('delete_batch', '/2/files/delete_batch', args.path_root, context, async client => {
        const launch = await callDropbox('/2/files/delete_batch', () => client.filesDeleteBatch({
          entries: args.entries.map(entry => ({
            path: normalizeDropboxPath(entry.path),
            parent_rev: entry.parent_rev
          }))
        }))

        const launchResult = launch.result as unknown as Record<string, unknown>

        if (launchResult['.tag'] === 'async_job_id') {
          const completed = await pollAsyncJob(
            '/2/files/delete_batch/check',
            {
              maxPollAttempts: args.max_poll_attempts,
              pollIntervalMs: args.poll_interval_ms
            },
            async asyncJobId => client.filesDeleteBatchCheck({
              async_job_id: asyncJobId
            }),
            String(launchResult.async_job_id)
          )

          return createToolTextResult(completed)
        }

        return createToolTextResult(launch.result)
      })
    }
  })

  server.addTool({
    name: 'move',
    description: 'Move or rename a Dropbox file or folder',
    parameters: relocationArgsSchema,
    execute: async (args, context) => {
      return executeDropboxTool('move', '/2/files/move_v2', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/move_v2', () => client.filesMoveV2({
          from_path: normalizeDropboxPath(args.from_path),
          to_path: normalizeDropboxPath(args.to_path),
          allow_shared_folder: args.allow_shared_folder,
          autorename: args.autorename,
          allow_ownership_transfer: args.allow_ownership_transfer
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'move_batch',
    description: 'Move multiple Dropbox files or folders and poll until completion',
    parameters: copyMoveBatchInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('move_batch', '/2/files/move_batch_v2', args.path_root, context, async client => {
        const launch = await callDropbox('/2/files/move_batch_v2', () => client.filesMoveBatchV2({
          entries: args.entries.map(entry => ({
            from_path: normalizeDropboxPath(entry.from_path),
            to_path: normalizeDropboxPath(entry.to_path)
          })),
          autorename: args.autorename,
          allow_ownership_transfer: args.allow_ownership_transfer
        }))

        const launchResult = launch.result as unknown as Record<string, unknown>

        if (launchResult['.tag'] === 'async_job_id') {
          const completed = await pollAsyncJob(
            '/2/files/move_batch/check_v2',
            {
              maxPollAttempts: args.max_poll_attempts,
              pollIntervalMs: args.poll_interval_ms
            },
            async asyncJobId => client.filesMoveBatchCheckV2({
              async_job_id: asyncJobId
            }),
            String(launchResult.async_job_id)
          )

          return createToolTextResult(completed)
        }

        return createToolTextResult(launch.result)
      })
    }
  })

  server.addTool({
    name: 'copy',
    description: 'Copy a Dropbox file or folder',
    parameters: relocationArgsSchema,
    execute: async (args, context) => {
      return executeDropboxTool('copy', '/2/files/copy_v2', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/copy_v2', () => client.filesCopyV2({
          from_path: normalizeDropboxPath(args.from_path),
          to_path: normalizeDropboxPath(args.to_path),
          allow_shared_folder: args.allow_shared_folder,
          autorename: args.autorename,
          allow_ownership_transfer: args.allow_ownership_transfer
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'copy_batch',
    description: 'Copy multiple Dropbox files or folders and poll until completion',
    parameters: copyMoveBatchInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('copy_batch', '/2/files/copy_batch_v2', args.path_root, context, async client => {
        const launch = await callDropbox('/2/files/copy_batch_v2', () => client.filesCopyBatchV2({
          entries: args.entries.map(entry => ({
            from_path: normalizeDropboxPath(entry.from_path),
            to_path: normalizeDropboxPath(entry.to_path)
          })),
          autorename: args.autorename
        }))

        const launchResult = launch.result as unknown as Record<string, unknown>

        if (launchResult['.tag'] === 'async_job_id') {
          const completed = await pollAsyncJob(
            '/2/files/copy_batch/check_v2',
            {
              maxPollAttempts: args.max_poll_attempts,
              pollIntervalMs: args.poll_interval_ms
            },
            async asyncJobId => client.filesCopyBatchCheckV2({
              async_job_id: asyncJobId
            }),
            String(launchResult.async_job_id)
          )

          return createToolTextResult(completed)
        }

        return createToolTextResult(launch.result)
      })
    }
  })
}
