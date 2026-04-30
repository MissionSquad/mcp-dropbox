import { z } from 'zod'
import type { FastMCP } from '@missionsquad/fastmcp'

import { baseArgsSchema } from './schemas.js'
import { callDropbox, createToolTextResult, executeDropboxTool } from './runtime.js'

const accountInputSchema = baseArgsSchema

export function registerAccountTools(server: FastMCP<undefined>): void {
  server.addTool({
    name: 'get_current_account',
    description: 'Get the current Dropbox account',
    parameters: accountInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('get_current_account', '/2/users/get_current_account', args.path_root, context, async client => {
        const response = await callDropbox('/2/users/get_current_account', () => client.usersGetCurrentAccount())
        return createToolTextResult(response.result)
      })
    }
  })

  server.addTool({
    name: 'get_space_usage',
    description: 'Get Dropbox account space usage',
    parameters: accountInputSchema,
    execute: async (args, context) => {
      return executeDropboxTool('get_space_usage', '/2/users/get_space_usage', args.path_root, context, async client => {
        const response = await callDropbox('/2/users/get_space_usage', () => client.usersGetSpaceUsage())
        return createToolTextResult(response.result)
      })
    }
  })
}
