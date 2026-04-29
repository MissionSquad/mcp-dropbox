import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { baseArgsSchema } from './schemas.js'
import { callDropbox, createToolTextResult, executeDropboxTool } from './runtime.js'

const accountInputSchema = baseArgsSchema

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    'get_current_account',
    {
      description: 'Get the current Dropbox account',
      inputSchema: accountInputSchema
    },
    async args => {
      return executeDropboxTool('get_current_account', '/2/users/get_current_account', args.path_root, async client => {
        const response = await callDropbox('/2/users/get_current_account', () => client.usersGetCurrentAccount())
        return createToolTextResult(response.result)
      })
    }
  )

  server.registerTool(
    'get_space_usage',
    {
      description: 'Get Dropbox account space usage',
      inputSchema: accountInputSchema
    },
    async args => {
      return executeDropboxTool('get_space_usage', '/2/users/get_space_usage', args.path_root, async client => {
        const response = await callDropbox('/2/users/get_space_usage', () => client.usersGetSpaceUsage())
        return createToolTextResult(response.result)
      })
    }
  )
}
