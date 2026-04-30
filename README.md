# mcp-dropbox

`@missionsquad/mcp-dropbox` is a MissionSquad-compatible Dropbox MCP server designed for **stdio installation inside the platform**. User authentication is handled through MissionSquad hidden secret injection, not through visible tool arguments and not through MCP OAuth on the server itself.

## MissionSquad Runtime Model

This package is intended to run as a shared stdio MCP server under `mcp-api`.

The expected auth flow is:

1. The server is installed in MissionSquad as a stdio package
2. The server definition declares hidden fields:
   - `accessToken`
   - `email`
3. Each user saves their Dropbox credentials through MissionSquad’s server secret UI
4. `mcp-api` injects those values per tool call
5. The server reads them from FastMCP `context.extraArgs`
6. If `email` is present, the server resolves it to the correct Dropbox `dbmid:` identifier and caches the lookup in an in-memory LRU cache

Important rules:

- `accessToken` and `email` are intentionally **not** part of the tool schemas
- the LLM never needs to provide auth values directly
- environment variables remain only as a **local standalone fallback**

## Hidden Secret Contract

### `secretNames`

```json
["accessToken", "email"]
```

### `secretFields`

```json
[
  {
    "name": "accessToken",
    "label": "Dropbox access token",
    "description": "Dropbox access token for the current user.",
    "required": true,
    "inputType": "password"
  },
  {
    "name": "email",
    "label": "Dropbox account email",
    "description": "Dropbox account email. For Dropbox Business team tokens, this lets the server resolve the correct team member automatically.",
    "required": false,
    "inputType": "password"
  }
]
```

## Local Standalone Fallback

For local development outside MissionSquad, you can use `.env`:

```env
DROPBOX_ACCESS_TOKEN=
DROPBOX_EMAIL=
LOG_LEVEL=info
DROPBOX_RETRY_MAX_ATTEMPTS=3
DROPBOX_RETRY_BASE_DELAY_MS=250
```

Hidden MissionSquad values always take precedence over these local env fallbacks.

For Dropbox Business team tokens:

- users should set `email` to their Dropbox team email
- users do not need to find `dbmid:` identifiers manually; the server resolves the email automatically and caches the result

## Running Locally

### Node

```bash
npm install
npm run build
npm start
```

This starts the stdio MCP server. It is meant to be launched by an MCP client or by MissionSquad `mcp-api`, not browsed to over HTTP.

### Docker

The container image runs the same stdio entrypoint:

```bash
docker build -t mcp-dropbox .
docker run --rm -it \
  -e DROPBOX_ACCESS_TOKEN=... \
  -e DROPBOX_EMAIL=user@example.com \
  mcp-dropbox
```

## Tool Reference

All tool auth is hidden. Examples below show only the LLM-visible arguments.

### Common Input: `path_root`

All tools accept optional `path_root` with one of these shapes:

```json
{ ".tag": "home" }
```

```json
{ ".tag": "root", "root": "1234567890" }
```

```json
{ ".tag": "namespace_id", "namespace_id": "1234567890" }
```

### File Operations

| Tool | Input schema | Output schema | Example invocation |
| --- | --- | --- | --- |
| `list_folder` | `path?: string`, `recursive?: boolean`, `include_media_info?: boolean`, `include_deleted?: boolean`, `include_has_explicit_shared_members?: boolean`, `include_mounted_folders?: boolean`, `limit?: integer`, `include_non_downloadable_files?: boolean`, `path_root?` | Dropbox `files.ListFolderResult` | `{"path":"/Docs","recursive":false}` |
| `list_files` | Same as `list_folder`; deprecated alias | Dropbox `files.ListFolderResult` | `{"path":"/Docs"}` |
| `list_folder_continue` | `cursor: string`, `path_root?` | Dropbox `files.ListFolderResult` | `{"cursor":"cursor-1"}` |
| `get_metadata` | `path: string`, `include_media_info?: boolean`, `include_deleted?: boolean`, `include_has_explicit_shared_members?: boolean`, `path_root?` | Dropbox metadata object from `filesGetMetadata` | `{"path":"/Docs/report.pdf"}` |
| `create_folder` | `path: string`, `autorename?: boolean`, `path_root?` | Dropbox `files.CreateFolderResult` | `{"path":"/Docs/New Folder"}` |
| `delete` | `path: string`, `parent_rev?: string`, `path_root?` | Dropbox `files.DeleteResult` | `{"path":"/Docs/old.txt"}` |
| `delete_batch` | `entries: [{ path: string, parent_rev?: string }]`, `poll_interval_ms?: integer`, `max_poll_attempts?: integer`, `path_root?` | Dropbox completed batch delete result | `{"entries":[{"path":"/Docs/a.txt"},{"path":"/Docs/b.txt"}]}` |
| `move` | `from_path: string`, `to_path: string`, `allow_shared_folder?: boolean`, `autorename?: boolean`, `allow_ownership_transfer?: boolean`, `path_root?` | Dropbox `files.RelocationResult` | `{"from_path":"/Docs/a.txt","to_path":"/Archive/a.txt"}` |
| `move_batch` | `entries: [{ from_path: string, to_path: string }]`, `autorename?: boolean`, `allow_ownership_transfer?: boolean`, `poll_interval_ms?: integer`, `max_poll_attempts?: integer`, `path_root?` | Dropbox completed batch move result | `{"entries":[{"from_path":"/Docs/a.txt","to_path":"/Archive/a.txt"}]}` |
| `copy` | `from_path: string`, `to_path: string`, `allow_shared_folder?: boolean`, `autorename?: boolean`, `allow_ownership_transfer?: boolean`, `path_root?` | Dropbox `files.RelocationResult` | `{"from_path":"/Docs/a.txt","to_path":"/Copies/a.txt"}` |
| `copy_batch` | `entries: [{ from_path: string, to_path: string }]`, `autorename?: boolean`, `poll_interval_ms?: integer`, `max_poll_attempts?: integer`, `path_root?` | Dropbox completed batch copy result | `{"entries":[{"from_path":"/Docs/a.txt","to_path":"/Copies/a.txt"}]}` |

### Upload and Download

| Tool | Input schema | Output schema | Example invocation |
| --- | --- | --- | --- |
| `upload_file` | `path: string`, `content: string` (base64), `mode?: {".tag":"add"|"overwrite"} | {".tag":"update","update":"rev"}`, `autorename?: boolean`, `client_modified?: ISO datetime`, `mute?: boolean`, `strict_conflict?: boolean`, `content_hash?: string`, `path_root?` | Dropbox `files.FileMetadata` | `{"path":"/Docs/hello.txt","content":"SGVsbG8="}` |
| `upload_file_chunked` | Same as `upload_file` plus `chunk_size_bytes?: integer`; auto-routes to direct upload at `<=150 MB` and upload sessions above that | `{ "route": "direct"|"chunked", "result": Dropbox result }` | `{"path":"/Large/video.bin","content":"<base64>","chunk_size_bytes":8388608}` |
| `download_file` | `path: string`, `path_root?` | `{ "metadata": Dropbox file metadata, "content_base64": string|null, "content_hash": string|null }` | `{"path":"/Docs/hello.txt"}` |

### Search

| Tool | Input schema | Output schema | Example invocation |
| --- | --- | --- | --- |
| `search` | `query: string`, `path?: string`, `max_results?: integer`, `order_by?: "relevance"|"last_modified_time"`, `file_status?: "active"|"deleted"`, `filename_only?: boolean`, `file_extensions?: string[]`, `file_categories?: ("image"|"document"|"pdf"|"spreadsheet"|"presentation"|"audio"|"video"|"folder"|"paper"|"others")[]`, `account_id?: string`, `include_highlights?: boolean`, `path_root?` | Dropbox `files.SearchV2Result` | `{"query":"report","path":"/Docs","max_results":25}` |
| `search_file_db` | Same as `search`; deprecated alias | Dropbox `files.SearchV2Result` | `{"query":"report"}` |
| `search_continue` | `cursor: string`, `path_root?` | Dropbox `files.SearchV2Result` | `{"cursor":"cursor-1"}` |

### Revisions

| Tool | Input schema | Output schema | Example invocation |
| --- | --- | --- | --- |
| `list_revisions` | `path: string`, `mode?: "path"|"id"`, `limit?: integer`, `path_root?` | Dropbox `files.ListRevisionsResult` | `{"path":"/Docs/report.docx","limit":10}` |
| `restore_revision` | `path: string`, `rev: string`, `path_root?` | Dropbox `files.FileMetadata` | `{"path":"/Docs/report.docx","rev":"a1c10ce0dd78"}` |

### Sharing

| Tool | Input schema | Output schema | Example invocation |
| --- | --- | --- | --- |
| `create_shared_link` | `path: string`, `requested_visibility?: "public"|"team_only"|"password"` default `public`, `audience?: "public"|"team"|"no_one"|"password"|"members"` default `public`, `access?: "viewer"|"editor"|"max"|"default"`, `allow_download?: boolean` default `true`, `expires?: ISO datetime`, `link_password?: string`, `require_password?: boolean`, `path_root?` | Dropbox shared-link metadata plus `direct_download_url`, `resolved_visibility`, and optional `reused_existing_link` | `{"path":"/Docs/report.pdf","allow_download":true}` |
| `get_temporary_link` | `path: string`, `path_root?` | Dropbox `files.GetTemporaryLinkResult` | `{"path":"/Docs/report.pdf"}` |
| `list_shared_links` | `path?: string`, `cursor?: string`, `direct_only?: boolean`, `path_root?` | Dropbox `sharing.ListSharedLinksResult` | `{"path":"/Docs/report.pdf","direct_only":true}` |
| `revoke_shared_link` | `url: string`, `path_root?` | `{ "revoked": true, "url": string }` | `{"url":"https://www.dropbox.com/s/example"}` |
| `modify_shared_link_settings` | `url: string`, `settings: { requested_visibility?: "public"|"team_only"|"password", audience?: "public"|"team"|"no_one"|"password"|"members", access?: "viewer"|"editor"|"max"|"default", allow_download?: boolean, expires?: ISO datetime, link_password?: string, require_password?: boolean }`, `remove_expiration?: boolean`, `path_root?` | Updated Dropbox shared-link metadata | `{"url":"https://www.dropbox.com/s/example","settings":{"allow_download":true}}` |
| `get_shared_link_metadata` | `url: string`, `path?: string`, `link_password?: string`, `path_root?` | Dropbox shared-link metadata | `{"url":"https://www.dropbox.com/s/example"}` |

### Account

| Tool | Input schema | Output schema | Example invocation |
| --- | --- | --- | --- |
| `get_current_account` | `path_root?` | Dropbox `users.FullAccount` | `{}` |
| `get_space_usage` | `path_root?` | Dropbox `users.SpaceUsage` | `{}` |

## Tool Selection Guidance

- Use `create_shared_link` for reusable public download links
- Use `get_temporary_link` for short-lived anonymous direct downloads

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
```

## License

MIT
