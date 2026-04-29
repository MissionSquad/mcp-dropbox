# Error Codes

## HTTP and transport errors

| Code | Where it appears | Meaning |
| --- | --- | --- |
| `missing_dropbox_access_token` | HTTP JSON-RPC error payload | No Dropbox token was provided in `Authorization` or `X-Dropbox-Access-Token` |
| `invalid_origin` | HTTP JSON-RPC error payload | The request `Origin` header failed validation |
| `missing_session_id` | HTTP JSON-RPC error payload | `GET /mcp` or `DELETE /mcp` was called without `MCP-Session-Id` |
| `session_not_found` | HTTP JSON-RPC error payload | The supplied `MCP-Session-Id` does not map to a live transport session |
| `missing_session_initialization` | HTTP JSON-RPC error payload | A non-initialize `POST /mcp` request was sent without a session |
| `internal_server_error` | HTTP JSON-RPC error payload | An unhandled HTTP-layer failure occurred |

## Dropbox tool errors

| Code | Meaning |
| --- | --- |
| `dropbox_auth_error` | Dropbox rejected the token or the token is expired/invalid |
| `dropbox_access_denied` | Dropbox denied access due to scope, policy, or permission |
| `dropbox_path_error` | Dropbox rejected the requested path or the path was not found |
| `dropbox_rate_limited` | Dropbox returned HTTP `429` |
| `dropbox_api_error` | Dropbox returned another structured API error |
| `dropbox_async_job_failed` | An async Dropbox batch job reached a `.tag = "failed"` state |
| `dropbox_async_job_timeout` | An async Dropbox batch job did not complete within the polling budget |
| `unexpected_error` | A non-Dropbox exception escaped the tool execution path |
