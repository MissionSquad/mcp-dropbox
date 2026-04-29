import { DropboxResponseError } from 'dropbox'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'

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

function getErrorCode(status: number, tagPath: string): { code: string; mcpCode: ErrorCode } {
  if (status === 401 || tagPath.includes('expired_access_token') || tagPath.includes('invalid_access_token')) {
    return {
      code: 'dropbox_auth_error',
      mcpCode: ErrorCode.InvalidRequest
    }
  }

  if (status === 403 || tagPath.includes('insufficient_scope') || tagPath.includes('access_denied') || tagPath.includes('no_permission')) {
    return {
      code: 'dropbox_access_denied',
      mcpCode: ErrorCode.InvalidRequest
    }
  }

  if (status === 409 || tagPath.startsWith('path/') || tagPath.includes('not_found') || tagPath.includes('malformed_path')) {
    return {
      code: 'dropbox_path_error',
      mcpCode: ErrorCode.InvalidParams
    }
  }

  if (status === 429) {
    return {
      code: 'dropbox_rate_limited',
      mcpCode: ErrorCode.InternalError
    }
  }

  return {
    code: 'dropbox_api_error',
    mcpCode: ErrorCode.InternalError
  }
}

export function mapDropboxError(error: unknown, endpoint: string): McpError {
  if (error instanceof McpError) {
    return error
  }

  if (error instanceof DropboxResponseError) {
    const payload = (error.error ?? {}) as DropboxErrorPayload
    const tagPath = getTagChain(payload.error).join('/')
    const details = getErrorCode(error.status, tagPath)

    return new McpError(
      details.mcpCode,
      payload.user_message?.text ?? payload.error_summary ?? `Dropbox ${endpoint} request failed`,
      {
        code: details.code,
        endpoint,
        status: error.status,
        tag_path: tagPath || undefined,
        error_summary: payload.error_summary,
        dropbox_error: payload.error
      }
    )
  }

  if (error instanceof Error) {
    return new McpError(ErrorCode.InternalError, error.message, {
      code: 'unexpected_error',
      endpoint
    })
  }

  return new McpError(ErrorCode.InternalError, `Dropbox ${endpoint} request failed`, {
    code: 'unexpected_error',
    endpoint
  })
}
