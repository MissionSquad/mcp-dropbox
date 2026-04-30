import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { McpToolRegistry } from '../tools/registry.js'
import { registerAccountTools } from '../tools/account.js'
import { registerFileOperationTools } from '../tools/file-operations.js'
import { registerRevisionTools } from '../tools/revisions.js'
import { registerSearchTools } from '../tools/search.js'
import { registerSharingTools } from '../tools/sharing.js'
import { registerUploadDownloadTools } from '../tools/upload-download.js'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'mcp-dropbox',
    version: '0.3.0'
  })

  const registry = new McpToolRegistry(server)

  registerFileOperationTools(registry)
  registerUploadDownloadTools(registry)
  registerSearchTools(registry)
  registerRevisionTools(registry)
  registerSharingTools(registry)
  registerAccountTools(registry)

  return server
}

