# Smoke Test

## 2026-04-29 Local Transport Smoke

- Mode: local MCP HTTP verification with Dropbox HTTP mocked at the network layer
- Server path: `http://127.0.0.1:3000/mcp`
- Verified:
  - `GET /healthz` returned `200`
  - unauthenticated `POST /mcp` returned `401` with `missing_dropbox_access_token`
  - MCP initialization over Streamable HTTP succeeded and returned a session ID
  - `listTools` returned the registered Dropbox tool set
  - `list_folder` completed successfully over the MCP client path with Dropbox HTTP mocked via `nock`

## Live Dropbox Status

## 2026-04-29 Live Dropbox Smoke

- Mode: real MCP HTTP server with live Dropbox API
- Server path: `http://127.0.0.1:3013/mcp`
- Auth mode:
  - `Authorization: Bearer <team token>`
  - local fallback `DROPBOX_SELECT_USER=<team_member_id>`
- Results:
  - account: `get_current_account` succeeded for `jayson@missionsquad.ai`
  - file operation: `create_folder` succeeded
  - upload: `upload_file` succeeded
  - download: `download_file` succeeded and returned matching content
  - search: `search` call succeeded end-to-end; returned `matchCount: 0` for the just-uploaded file, which is consistent with Dropbox search indexing lag
  - sharing (public): `create_shared_link` succeeded and returned a public `direct_download_url`
  - sharing (temporary): `get_temporary_link` succeeded
  - cleanup: `delete` succeeded for the temporary smoke folder
- Smoke artifact summary:
  - folder: `/mcp-dropbox-smoke-2026-04-29T18-29-27-499Z`
  - file: `/mcp-dropbox-smoke-2026-04-29T18-29-27-499Z/smoke.txt`
  - upload `content_hash`: `2f14fe5a29edfbb9906b326df5b2a46f1c9510418ac89d6c5daff2a2cfff39c9`
