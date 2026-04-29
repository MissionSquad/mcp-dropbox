import type { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js'

export function createJsonToolResult(payload: unknown): CallToolResult {
  const content: TextContent = {
    type: 'text',
    text: JSON.stringify(payload, null, 2)
  }

  return {
    content: [content]
  }
}
