import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { registerAccountTools } from '../tools/account.js'
import { registerFileOperationTools } from '../tools/file-operations.js'
import { registerRevisionTools } from '../tools/revisions.js'
import { registerSearchTools } from '../tools/search.js'
import { registerSharingTools } from '../tools/sharing.js'
import { registerUploadDownloadTools } from '../tools/upload-download.js'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'dbx-mcp-server',
    version: '0.1.0'
  })

  registerFileOperationTools(server)
  registerUploadDownloadTools(server)
  registerSearchTools(server)
  registerRevisionTools(server)
  registerSharingTools(server)
  registerAccountTools(server)

  return server
}
