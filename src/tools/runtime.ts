import type { Dropbox, DropboxResponse } from 'dropbox'
import { McpError, ErrorCode, type CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import { createDropboxClient } from '../dropbox/client-factory.js'
import { withDropboxRetry } from '../dropbox/retry.js'
import type { PathRoot } from '../dropbox/path-root.js'
import { mapDropboxError } from '../errors/map-dropbox-error.js'
import { getRequestContext } from '../http/request-context.js'
import { logger } from '../logger.js'

export interface PollOptions {
  maxPollAttempts?: number
  pollIntervalMs?: number
}

export function normalizeDropboxPath(path: string): string {
  if (!path || path === '/') {
    return ''
  }

  return path.startsWith('/') ? path : `/${path}`
}

export function createPathTag<T extends string>(tag: T): { '.tag': T } {
  return { '.tag': tag }
}

export async function executeDropboxTool<T>(
  toolName: string,
  endpoint: string,
  pathRoot: PathRoot | undefined,
  callback: (client: Dropbox) => Promise<T>
): Promise<T> {
  const context = getRequestContext()
  const client = createDropboxClient(context.accessToken, {
    pathRoot,
    selectUser: context.selectUser,
    selectAdmin: context.selectAdmin
  })
  const startedAt = Date.now()

  try {
    const result = await callback(client)

    logger.info(
      {
        requestId: context.requestId,
        toolName,
        latency_ms: Date.now() - startedAt,
        dropbox_endpoint: endpoint
      },
      'Dropbox tool completed'
    )

    return result
  } catch (error) {
    logger.error(
      {
        err: error,
        requestId: context.requestId,
        toolName,
        dropbox_endpoint: endpoint
      },
      'Dropbox tool failed'
    )

    throw mapDropboxError(error, endpoint)
  }
}

export async function callDropbox<T>(
  endpoint: string,
  operation: () => Promise<DropboxResponse<T>>
): Promise<DropboxResponse<T>> {
  return withDropboxRetry(operation)
}

function wait(durationMs: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, durationMs)
  })
}

export async function pollAsyncJob<T>(
  endpoint: string,
  pollOptions: PollOptions,
  operation: (asyncJobId: string) => Promise<DropboxResponse<T>>,
  asyncJobId: string
): Promise<T> {
  const pollIntervalMs = pollOptions.pollIntervalMs ?? 500
  const maxPollAttempts = pollOptions.maxPollAttempts ?? 60

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const response = await withDropboxRetry(() => operation(asyncJobId))
    const result = response.result as unknown as Record<string, unknown>
    const tag = result['.tag']

    if (tag === 'complete') {
      return response.result
    }

    if (tag === 'failed') {
      throw new McpError(ErrorCode.InternalError, `Dropbox ${endpoint} async job failed`, {
        code: 'dropbox_async_job_failed',
        endpoint,
        result: response.result
      })
    }

    await wait(pollIntervalMs)
  }

  throw new McpError(ErrorCode.InternalError, `Dropbox ${endpoint} async job did not complete in time`, {
    code: 'dropbox_async_job_timeout',
    endpoint,
    async_job_id: asyncJobId
  })
}

export function parseBase64Content(content: string): Buffer {
  return Buffer.from(content, 'base64')
}

export function buildDirectDownloadUrl(sharedUrl: string): string {
  const url = new URL(sharedUrl)
  url.searchParams.set('dl', '1')
  return url.toString()
}

export function createToolTextResult(payload: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }
    ]
  }
}
