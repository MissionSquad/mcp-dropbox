import { DropboxResponseError } from 'dropbox'

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

function getDropboxErrorMessage(error: DropboxResponseError<unknown>): string {
  const payload = (error.error ?? {}) as DropboxErrorPayload

  if (typeof error.error === 'string') {
    return error.error
  }

  return payload.user_message?.text ?? payload.error_summary ?? ''
}

export function isSelectUserRequiredDropboxError(error: unknown): boolean {
  if (!(error instanceof DropboxResponseError)) {
    return false
  }

  const message = getDropboxErrorMessage(error)
  return message.includes('Dropbox-API-Select-User') || message.includes('select_user')
}

export function mapDropboxError(error: unknown, endpoint: string): Error {
  if (error instanceof DropboxResponseError) {
    const payload = (error.error ?? {}) as DropboxErrorPayload
    const tagPath = getTagChain(payload.error).join('/')
    const rawMessage = getDropboxErrorMessage(error) || `Dropbox ${endpoint} request failed`

    if (isSelectUserRequiredDropboxError(error)) {
      return new Error(
        'This Dropbox token is a team token and needs a selected user context. Configure hidden argument "email" with the Dropbox account email in MissionSquad.'
      )
    }

    const message = rawMessage

    return new Error(
      `${message}${tagPath ? ` (Dropbox tag path: ${tagPath})` : ''}`
    )
  }

  if (error instanceof Error) {
    return error
  }

  return new Error(`Dropbox ${endpoint} request failed`)
}
