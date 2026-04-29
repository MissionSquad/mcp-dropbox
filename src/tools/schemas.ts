import { z } from 'zod'

import { pathRootSchema } from '../dropbox/path-root.js'

export const baseArgsSchema = z.object({
  path_root: pathRootSchema.optional()
})

export const writeModeSchema = z.union([
  z.object({
    '.tag': z.literal('add')
  }),
  z.object({
    '.tag': z.literal('overwrite')
  }),
  z.object({
    '.tag': z.literal('update'),
    update: z.string().min(1)
  })
])

export const relocationArgsSchema = baseArgsSchema.extend({
  from_path: z.string().min(1),
  to_path: z.string().min(1),
  allow_shared_folder: z.boolean().optional(),
  autorename: z.boolean().optional(),
  allow_ownership_transfer: z.boolean().optional()
})

export const batchPollingArgsSchema = z.object({
  poll_interval_ms: z.number().int().positive().optional(),
  max_poll_attempts: z.number().int().positive().optional()
})

export const uploadArgsSchema = baseArgsSchema.extend({
  path: z.string().min(1),
  content: z.string().min(1).describe('Base64 encoded file content'),
  mode: writeModeSchema.optional(),
  autorename: z.boolean().optional(),
  client_modified: z.string().datetime().optional(),
  mute: z.boolean().optional(),
  strict_conflict: z.boolean().optional(),
  content_hash: z.string().min(1).optional()
})

export const sharedLinkSettingsSchema = z.object({
  requested_visibility: z.enum(['public', 'team_only', 'password']).optional(),
  audience: z.enum(['public', 'team', 'no_one', 'password', 'members']).optional(),
  access: z.enum(['viewer', 'editor', 'max', 'default']).optional(),
  allow_download: z.boolean().optional(),
  expires: z.string().datetime().optional(),
  link_password: z.string().min(1).optional(),
  require_password: z.boolean().optional()
})
