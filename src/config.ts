import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().optional(),
  HOST: z.string().optional(),
  PUBLIC_BASE_URL: z.string().url(),
  MCP_PATH: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  SQLITE_PATH: z.string().optional(),
  DATA_DIR: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().optional(),
  OAUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().optional(),
  MCP_OAUTH_CLIENT_ID: z.string().min(1),
  MCP_OAUTH_CLIENT_SECRET: z.string().optional(),
  MCP_OAUTH_REDIRECT_URIS: z.string().min(1),
  DROPBOX_APP_KEY: z.string().min(1),
  DROPBOX_APP_SECRET: z.string().min(1),
  DROPBOX_REDIRECT_URI: z.string().url().optional(),
  DROPBOX_SCOPES: z.string().optional(),
  DROPBOX_RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().optional(),
  DROPBOX_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().optional(),
  DROPBOX_ACCESS_TOKEN: z.string().optional(),
  DROPBOX_EMAIL: z.string().optional()
})

const env = EnvSchema.parse(process.env)

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function parseCsv(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
}

const publicBaseUrl = normalizeBaseUrl(env.PUBLIC_BASE_URL)
const mcpPath = env.MCP_PATH?.trim() || '/mcp'
const dataDir = env.DATA_DIR?.trim() || '/data'

export interface AppConfig {
  port: number
  host: string
  publicBaseUrl: string
  mcpPath: string
  logLevel: string
  allowedOrigins: string[]
  sqlitePath: string
  encryptionKey: string
  sessionCookieName: string
  sessionTtlHours: number
  oauthAccessTokenTtlSeconds: number
  oauthIssuerUrl: string
  oauthClientId: string
  oauthClientSecret?: string
  oauthRedirectUris: string[]
  dropboxAppKey: string
  dropboxAppSecret: string
  dropboxRedirectUri: string
  dropboxScopes: string[]
  dropboxRetryMaxAttempts: number
  dropboxRetryBaseDelayMs: number
  developmentAccessToken?: string
  developmentEmail?: string
}

export const appConfig: AppConfig = {
  port: env.PORT ?? 3000,
  host: env.HOST?.trim() || '0.0.0.0',
  publicBaseUrl,
  mcpPath,
  logLevel: env.LOG_LEVEL?.trim() || 'info',
  allowedOrigins: parseCsv(env.ALLOWED_ORIGINS),
  sqlitePath: env.SQLITE_PATH?.trim() || `${dataDir}/mcp-dropbox.sqlite`,
  encryptionKey: env.ENCRYPTION_KEY,
  sessionCookieName: env.SESSION_COOKIE_NAME?.trim() || 'mcp_dropbox_session',
  sessionTtlHours: env.SESSION_TTL_HOURS ?? 24,
  oauthAccessTokenTtlSeconds: env.OAUTH_ACCESS_TOKEN_TTL_SECONDS ?? 3600,
  oauthIssuerUrl: publicBaseUrl,
  oauthClientId: env.MCP_OAUTH_CLIENT_ID.trim(),
  oauthClientSecret: env.MCP_OAUTH_CLIENT_SECRET?.trim() || undefined,
  oauthRedirectUris: parseCsv(env.MCP_OAUTH_REDIRECT_URIS),
  dropboxAppKey: env.DROPBOX_APP_KEY.trim(),
  dropboxAppSecret: env.DROPBOX_APP_SECRET.trim(),
  dropboxRedirectUri: env.DROPBOX_REDIRECT_URI?.trim() || `${publicBaseUrl}/oauth/dropbox/callback`,
  dropboxScopes:
    parseCsv(env.DROPBOX_SCOPES).length > 0
      ? parseCsv(env.DROPBOX_SCOPES)
      : [
          'account_info.read',
          'files.metadata.read',
          'files.metadata.write',
          'files.content.read',
          'files.content.write',
          'sharing.read',
          'sharing.write'
        ],
  dropboxRetryMaxAttempts: env.DROPBOX_RETRY_MAX_ATTEMPTS ?? 3,
  dropboxRetryBaseDelayMs: env.DROPBOX_RETRY_BASE_DELAY_MS ?? 250,
  developmentAccessToken: env.DROPBOX_ACCESS_TOKEN?.trim() || undefined,
  developmentEmail: env.DROPBOX_EMAIL?.trim() || undefined
}

export function getMcpEndpointUrl(): URL {
  return new URL(appConfig.mcpPath, `${appConfig.publicBaseUrl}/`)
}

