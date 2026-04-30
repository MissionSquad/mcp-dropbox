import type { DropboxResponse } from 'dropbox'
import type { CallToolResult, ContentBlock } from '@modelcontextprotocol/sdk/types.js'

import { getAppContext } from '../app-context.js'
import { withDropboxRetry } from '../dropbox/retry.js'
import type { PathRoot } from '../dropbox/path-root.js'
import { logger } from '../logger.js'
import type { ToolContext } from './registry.js'

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
  context: ToolContext,
  callback: (client: import('dropbox').Dropbox) => Promise<T>
): Promise<T> {
  const linkedAccountId = context.authInfo?.extra?.linkedAccountId
  const startedAt = Date.now()

  if (typeof linkedAccountId !== 'string' || linkedAccountId.length === 0) {
    throw new Error('Missing linked Dropbox account context. Reconnect Dropbox and retry.')
  }

  try {
    const { dropboxAccountService } = getAppContext()
    const execution = await dropboxAccountService.executeForLinkedAccount(
      linkedAccountId,
      pathRoot,
      endpoint,
      callback
    )

    logger.info(
      {
        toolName,
        latency_ms: Date.now() - startedAt,
        dropbox_endpoint: endpoint,
        usedDelegatedUser: execution.usedDelegatedUser,
        clientId: context.authInfo?.clientId
      },
      'Dropbox tool completed'
    )

    return execution.result
  } catch (error) {
    logger.error(
      {
        err: error,
        toolName,
        dropbox_endpoint: endpoint,
        clientId: context.authInfo?.clientId
      },
      'Dropbox tool failed'
    )

    throw error
  }
}

export async function callDropbox<T>(
  _endpoint: string,
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
      throw new Error(`Dropbox ${endpoint} async job failed`)
    }

    await wait(pollIntervalMs)
  }

  throw new Error(`Dropbox ${endpoint} async job did not complete in time`)
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
    ] as ContentBlock[]
  }
}
