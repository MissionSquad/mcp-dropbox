import { DropboxResponseError } from 'dropbox'
import { UserError } from '@missionsquad/fastmcp'

interface DropboxErrorPayload {
  error_summary?: string
  error?: unknown
  user_message?: {
    text?: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getTagChain(value: unknown): string[] {
  if (!isRecord(value)) {
    return []
  }

  const tag = value['.tag']

  if (typeof tag !== 'string') {
    return []
  }

  const nested = value[tag]
  return [tag, ...getTagChain(nested)]
}

export function mapDropboxError(error: unknown, endpoint: string): Error {
  if (error instanceof UserError) {
    return error
  }

  if (error instanceof DropboxResponseError) {
    const payload = (error.error ?? {}) as DropboxErrorPayload
    const tagPath = getTagChain(payload.error).join('/')
    const rawMessage =
      typeof error.error === 'string'
        ? error.error
        : payload.user_message?.text ?? payload.error_summary ?? `Dropbox ${endpoint} request failed`

    if (typeof rawMessage === 'string' && rawMessage.includes('Dropbox-API-Select-User')) {
      return new UserError(
        'This Dropbox token is a team token and needs a selected user context. Configure hidden argument "email" with the Dropbox account email in MissionSquad.'
      )
    }

    const message = rawMessage

    return new UserError(
      `${message}${tagPath ? ` (Dropbox tag path: ${tagPath})` : ''}`
    )
  }

  if (error instanceof Error) {
    return error
  }

  return new Error(`Dropbox ${endpoint} request failed`)
}
