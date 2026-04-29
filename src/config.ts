import dotenv from 'dotenv'

dotenv.config()

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function readList(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
}

export const config = {
  port: readNumber(process.env.PORT, 3000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  allowedOrigins: readList(process.env.ALLOWED_ORIGINS),
  mcpPath: '/mcp',
  healthPath: '/healthz',
  shutdownTimeoutMs: readNumber(process.env.SHUTDOWN_TIMEOUT_MS, 30000),
  dropboxRetryMaxAttempts: readNumber(process.env.DROPBOX_RETRY_MAX_ATTEMPTS, 3),
  dropboxRetryBaseDelayMs: readNumber(process.env.DROPBOX_RETRY_BASE_DELAY_MS, 250)
} as const
