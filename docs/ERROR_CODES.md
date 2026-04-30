# Error Behavior

## HTTP and MCP auth layer

| Condition | Current behavior |
| --- | --- |
| Missing `Authorization` header on `/mcp` | `401` with `WWW-Authenticate: Bearer ... resource_metadata="..."` |
| Invalid bearer token | `401` with OAuth error body from bearer auth middleware |
| Invalid `Origin` header on `/mcp` | `403` JSON-RPC style error body from origin guard |
| Invalid or missing `MCP-Session-Id` on `GET /mcp` or `DELETE /mcp` | `400` plain text response |

## OAuth server layer

| Condition | Current behavior |
| --- | --- |
| Unknown `client_id` | OAuth `invalid_client` response |
| Invalid `redirect_uri` | OAuth `invalid_request` response |
| Invalid auth code or refresh token | OAuth `invalid_grant` response |
| Unsupported grant type | OAuth `unsupported_grant_type` response |

## Dropbox execution layer

| Condition | Current behavior |
| --- | --- |
| No linked Dropbox account in `authInfo.extra` | Tool execution throws `Missing linked Dropbox account context. Reconnect Dropbox and retry.` |
| Team token without delegated member context but stored email exists | Tool runtime retries after resolving `email -> team_member_id` |
| Structured Dropbox API error | Returns Dropbox summary with tag path when available |
| Async batch job failure | Throws `Dropbox <endpoint> async job failed` |
| Async batch job timeout | Throws `Dropbox <endpoint> async job did not complete in time` |
