import { z } from 'zod'
import type { files } from 'dropbox'

import { uploadArgsSchema } from './schemas.js'
import type { ToolRegistry } from './registry.js'
import { callDropbox, createToolTextResult, executeDropboxTool, normalizeDropboxPath, parseBase64Content } from './runtime.js'

const maxDirectUploadBytes = 150 * 1024 * 1024

const uploadFileChunkedInputSchema = uploadArgsSchema.extend({
  chunk_size_bytes: z.number().int().positive().optional()
})

const downloadFileInputSchema = z.object({
  path: z.string().min(1),
  path_root: z.any().optional()
})

type DropboxDownloadResult = files.FileMetadata & {
  fileBinary?: Buffer
}

function createCommitInfo(args: z.infer<typeof uploadArgsSchema>): files.CommitInfo {
  return {
    path: normalizeDropboxPath(args.path),
    mode: args.mode,
    autorename: args.autorename,
    client_modified: args.client_modified,
    mute: args.mute,
    strict_conflict: args.strict_conflict
  }
}

async function uploadWithSession(
  client: import('dropbox').Dropbox,
  args: z.infer<typeof uploadFileChunkedInputSchema>,
  buffer: Buffer
) {
  const chunkSizeBytes = args.chunk_size_bytes ?? 8 * 1024 * 1024
  const firstChunk = buffer.subarray(0, chunkSizeBytes)
  const start = await callDropbox('/2/files/upload_session/start', () => client.filesUploadSessionStart({
    contents: firstChunk,
    close: false,
    content_hash: args.content_hash
  }))

  let offset = firstChunk.length
  const sessionId = start.result.session_id

  while (offset < buffer.length - chunkSizeBytes) {
    const nextChunk = buffer.subarray(offset, offset + chunkSizeBytes)

    await callDropbox('/2/files/upload_session/append_v2', () => client.filesUploadSessionAppendV2({
      contents: nextChunk,
      cursor: {
        session_id: sessionId,
        offset
      },
      close: false
    }))

    offset += nextChunk.length
  }

  const finalChunk = buffer.subarray(offset)
  const finish = await callDropbox('/2/files/upload_session/finish', () => client.filesUploadSessionFinish({
    contents: finalChunk,
    cursor: {
      session_id: sessionId,
      offset
    },
    commit: createCommitInfo(args),
    content_hash: args.content_hash
  }))

  return finish.result
}

export function registerUploadDownloadTools(server: ToolRegistry): void {
  server.addTool({
    name: 'upload_file',
    description: 'Upload a Dropbox file up to 150 MB using /2/files/upload',
    parameters: uploadArgsSchema,
    execute: async (args, context) => {
      return executeDropboxTool('upload_file', '/2/files/upload', args.path_root, context, async client => {
        const buffer = parseBase64Content(args.content)

        if (buffer.length > maxDirectUploadBytes) {
          throw new Error('upload_file only supports payloads up to 150 MB; use upload_file_chunked instead')
        }

        const response = await callDropbox('/2/files/upload', () => client.filesUpload({
          ...createCommitInfo(args),
          contents: buffer,
          content_hash: args.content_hash
        }))

        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'upload_file_chunked',
    description: 'Upload a Dropbox file with automatic direct-vs-session routing based on payload size',
    parameters: uploadFileChunkedInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('upload_file_chunked', '/2/files/upload_session/*', args.path_root, context, async client => {
        const buffer = parseBase64Content(args.content)

        if (buffer.length <= maxDirectUploadBytes) {
          const directUpload = await callDropbox('/2/files/upload', () => client.filesUpload({
            ...createCommitInfo(args),
            contents: buffer,
            content_hash: args.content_hash
          }))

          return createToolTextResult({
            route: 'direct',
            result: directUpload.result
          })
        }

        const result = await uploadWithSession(client, args, buffer)

        return createToolTextResult({
          route: 'chunked',
          result
        })
      })
    }
  })

  server.addTool({
    name: 'download_file',
    description: 'Download a Dropbox file and return base64 content plus metadata and content_hash',
    parameters: downloadFileInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('download_file', '/2/files/download', args.path_root, context, async client => {
        const response = await callDropbox('/2/files/download', () => client.filesDownload({
          path: normalizeDropboxPath(args.path)
        }))

        const result = response.result as DropboxDownloadResult

        return createToolTextResult({
          metadata: result,
          content_base64: result.fileBinary?.toString('base64') ?? null,
          content_hash: result.content_hash ?? null
        })
      })
    }
  })
}
