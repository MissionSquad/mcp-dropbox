import type { z } from 'zod'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { CallToolResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export type ToolContext = RequestHandlerExtra<ServerRequest, ServerNotification>

export interface ToolDefinition<TSchema extends z.ZodTypeAny> {
  name: string
  description: string
  parameters: TSchema
  execute: (args: z.infer<TSchema>, context: ToolContext) => Promise<CallToolResult>
}

export interface ToolRegistry {
  addTool<TSchema extends z.ZodTypeAny>(tool: ToolDefinition<TSchema>): void
}

export class McpToolRegistry implements ToolRegistry {
  constructor(private readonly server: McpServer) {}

  addTool<TSchema extends z.ZodTypeAny>(tool: ToolDefinition<TSchema>): void {
    this.server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.parameters as any
      },
      async (args: any, extra: ToolContext) => tool.execute(args, extra)
    )
  }
}
