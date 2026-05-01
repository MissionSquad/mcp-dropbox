# mcp-dropbox

`@missionsquad/mcp-dropbox` is a standalone Dropbox MCP server that runs over **Streamable HTTP**.

MissionSquad connects to this server through external MCP OAuth. This server then manages the real Dropbox OAuth lifecycle internally and persists Dropbox refresh tokens in an encrypted SQLite database on a mounted volume.

## Architecture

There are two auth boundaries:

1. `mcp-api` authenticates to `mcp-dropbox`
2. `mcp-dropbox` authenticates to Dropbox

MissionSquad stores only the OAuth state needed to call this MCP server.

`mcp-dropbox` stores:

- Dropbox refresh tokens
- cached Dropbox access tokens and expiry
- linked Dropbox account metadata
- MCP OAuth authorization codes, access tokens, refresh tokens, and browser session state

## HTTP Surface

Primary MCP endpoints:

- `POST /mcp`
- `GET /mcp`
- `DELETE /mcp`
- `GET /healthz`

OAuth and discovery endpoints:

- `/.well-known/oauth-protected-resource/mcp`
- `/.well-known/oauth-authorization-server`
- `/authorize`
- `/token`
- `/revoke`
- `/register`
- `/oauth/dropbox/start`
- `/oauth/dropbox/callback`

## Persistence

The server uses:

- SQLite on a mounted persistent volume
- default database path: `/data/mcp-dropbox.sqlite`
- AES-256-GCM encryption for sensitive persisted fields

This deployment assumes one active writer instance per database file.

## Required Configuration

```env
PORT=3000
HOST=0.0.0.0
PUBLIC_BASE_URL=https://dropboxmcp.example.com
MCP_PATH=/mcp
ALLOWED_ORIGINS=https://app.missionsquad.ai

SQLITE_PATH=/data/mcp-dropbox.sqlite
ENCRYPTION_KEY=replace-me

MCP_OAUTH_CLIENT_ID=missionsquad-dropbox
MCP_OAUTH_CLIENT_SECRET=replace-me
MCP_OAUTH_REDIRECT_URIS=https://api.missionsquad.ai/v1/mcp/oauth/callback

DROPBOX_APP_KEY=replace-me
DROPBOX_APP_SECRET=replace-me
DROPBOX_REDIRECT_URI=https://dropboxmcp.example.com/oauth/dropbox/callback
DROPBOX_SCOPES=account_info.read,files.metadata.read,files.metadata.write,files.content.read,files.content.write,sharing.read,sharing.write

LOG_LEVEL=info
DROPBOX_RETRY_MAX_ATTEMPTS=3
DROPBOX_RETRY_BASE_DELAY_MS=250
```

Optional local Dropbox fallback for standalone testing only:

```env
DROPBOX_ACCESS_TOKEN=
DROPBOX_EMAIL=
```

## MissionSquad Registration

Register the deployed server as:

```json
{
  "source": "external",
  "transportType": "streamable_http",
  "authMode": "oauth2",
  "url": "https://dropboxmcp.example.com/mcp"
}
```

OAuth registration modes now supported by the server:

- pre-registered manual client credentials using:
  - `MCP_OAUTH_CLIENT_ID`
  - `MCP_OAUTH_CLIENT_SECRET`
- dynamic client registration through `/register`

The server advertises `registration_endpoint` in OAuth metadata when DCR is available.

## Local Development

```bash
npm install
npm run build
npm test
npm run typecheck
npm start
```

## Tool Surface

Registered tools:

- `list_folder`
- `list_files`
- `list_folder_continue`
- `get_metadata`
- `create_folder`
- `delete`
- `delete_batch`
- `move`
- `move_batch`
- `copy`
- `copy_batch`
- `upload_file`
- `upload_file_chunked`
- `download_file`
- `search`
- `search_file_db`
- `search_continue`
- `list_revisions`
- `restore_revision`
- `create_shared_link`
- `get_temporary_link`
- `list_shared_links`
- `revoke_shared_link`
- `modify_shared_link_settings`
- `get_shared_link_metadata`
- `get_current_account`
- `get_space_usage`

## Notes

- `create_shared_link` is the reusable public-download-link tool
- `get_temporary_link` is the short-lived anonymous direct-download tool
- Dropbox Business delegated-member retry is preserved through the stored linked account email when available

## License

MIT
