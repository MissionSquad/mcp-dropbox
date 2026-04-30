import { UserError } from '@missionsquad/fastmcp'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const EnvSchema = z.object({
  DROPBOX_ACCESS_TOKEN: z.string().optional(),
  DROPBOX_EMAIL: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  DROPBOX_RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().optional(),
  DROPBOX_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().optional()
})

const env = EnvSchema.parse(process.env)

export interface AppConfig {
  defaultAccessToken: string | undefined
  defaultEmail: string | undefined
  logLevel: string
  dropboxRetryMaxAttempts: number
  dropboxRetryBaseDelayMs: number
}

export interface ResolvedRequestConfig {
  accessToken: string
  email?: string
}

export const dropboxSecretNames = ['accessToken', 'email'] as const

export const dropboxSecretFields = [
  {
    name: 'accessToken',
    label: 'Dropbox access token',
    description: 'Dropbox access token for the current user. Required unless DROPBOX_ACCESS_TOKEN is set for local standalone usage.',
    required: true,
    inputType: 'password' as const
  },
  {
    name: 'email',
    label: 'Dropbox account email',
    description: 'Dropbox account email. For Dropbox Business team tokens, this lets the server resolve the correct team member automatically.',
    required: false,
    inputType: 'password' as const
  }
]

function readHiddenString(
  extraArgs: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = extraArgs?.[key]

  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new UserError(`Hidden argument "${key}" must be a string when provided.`)
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    throw new UserError(`Hidden argument "${key}" must be a non-empty string when provided.`)
  }

  return trimmed
}

export const appConfig: AppConfig = {
  defaultAccessToken: env.DROPBOX_ACCESS_TOKEN?.trim() || undefined,
  defaultEmail: env.DROPBOX_EMAIL?.trim() || undefined,
  logLevel: env.LOG_LEVEL ?? 'info',
  dropboxRetryMaxAttempts: env.DROPBOX_RETRY_MAX_ATTEMPTS ?? 3,
  dropboxRetryBaseDelayMs: env.DROPBOX_RETRY_BASE_DELAY_MS ?? 250
}

export function resolveRequestConfig(
  extraArgs: Record<string, unknown> | undefined,
  defaults: AppConfig = appConfig
): ResolvedRequestConfig {
  const accessToken = readHiddenString(extraArgs, 'accessToken') ?? defaults.defaultAccessToken

  if (!accessToken) {
    throw new UserError(
      'Dropbox access token is required. Configure hidden argument "accessToken" in MissionSquad or set DROPBOX_ACCESS_TOKEN for local standalone usage.'
    )
  }

  const email = readHiddenString(extraArgs, 'email') ?? defaults.defaultEmail

  return {
    accessToken,
    email
  }
}
