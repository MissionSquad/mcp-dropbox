export interface JsonRpcErrorPayload {
  jsonrpc: '2.0'
  error: {
    code: number
    message: string
    data?: Record<string, unknown>
  }
  id: null
}

export function createJsonRpcErrorPayload(
  code: number,
  message: string,
  data?: Record<string, unknown>
): JsonRpcErrorPayload {
  return {
    jsonrpc: '2.0',
    error: {
      code,
      message,
      data
    },
    id: null
  }
}
