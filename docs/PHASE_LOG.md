# Phase Log

## 2026-04-29T10:22:24-0600 Phase 0

- Read the full `src/` and `tests/` trees plus `package.json`, `tsconfig.json`, `jest.config.cjs`, `.env.example`, `manifest.json`, and `README.md`
- Confirmed the active fork remote is `git@github.com:MissionSquad/mcp-dropbox.git` and pulled `origin/main` successfully with `git pull --ff-only origin main`
- Verified the current implementation is stdio-based, single-tenant, and built around encrypted on-disk token storage plus OAuth setup helpers
- Wrote `docs/CURRENT_ARCHITECTURE.md`, `docs/REFACTOR_PLAN.md`, and `tasks/todo.md`
- Re-read the mission prompt against the plan before starting Phase 1
- Required protocol references consulted before implementation:
  - Local MCP spec: `/Users/jaysonjacobs/Code/msq/mcp-api/mcp-spec/base-protocol/transports.md`
  - Local MCP spec: `/Users/jaysonjacobs/Code/msq/mcp-api/mcp-spec/base-protocol/authorization.md`
  - MCP TypeScript SDK repository overview: https://github.com/modelcontextprotocol/typescript-sdk
  - MCP server guide: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md
  - Dropbox HTTP documentation index: https://www.dropbox.com/developers/documentation/http/documentation
  - Dropbox sharing guide: https://developers.dropbox.com/dbx-sharing-guide
  - Dropbox force-download behavior: https://help.dropbox.com/share/force-download
  - Dropbox temporary-link TTL confirmation: https://www.dropboxforum.com/discussions/101000014/temporary-link-info/657167

## 2026-04-29T10:28:57-0600 Phase 1

- Removed the legacy OAuth, PKCE, refresh-token, token-encryption, token-reset, and token-persistence code paths from `src/`
- Removed the `setup` script from `package.json` and replaced the package/toolchain configuration with a clean TypeScript + Jest + Express baseline
- Replaced the old `.env.example` auth settings with runtime-only operational settings
- Replaced the old global test setup with a minimal Jest bootstrap and converted the pre-refactor test suites into explicit `describe.skip` placeholders carrying `TODO(Phase 4)` notes
- Deleted stale Jest mocks that still referenced removed auth modules
- Verification:
  - `npm install`
  - `npm run build`
  - `npm test` with 8 skipped legacy suites and 0 runtime/module resolution failures

## 2026-04-29T10:35:00-0600 Phase 2

- Upgraded to `@modelcontextprotocol/sdk@^1.17.5` and installed the HTTP/runtime/test dependencies required for the new architecture
- Replaced the placeholder server with an Express-based Streamable HTTP server exposing:
  - `POST /mcp`
  - `GET /mcp`
  - `DELETE /mcp`
  - `GET /healthz`
- Implemented origin validation, per-request Dropbox token extraction from `Authorization` and `X-Dropbox-Access-Token`, request IDs, and AsyncLocalStorage-backed request context
- Implemented the request-scoped Dropbox client factory with `PathRoot` validation and serialization
- Replaced the low-level stdio server wiring with per-session `McpServer` + `StreamableHTTPServerTransport` instances
- Added first working tool registration on the new transport (`list_folder` plus `list_files` alias) and verified the expanded registry remains reachable over the HTTP transport
- Verification:
  - `npm run build`
  - `npm test`
  - Local Streamable HTTP smoke run outside the sandbox:
    - `GET /healthz` returned `200`
    - missing-token `POST /mcp` returned `401` with structured JSON-RPC error payload
    - MCP client initialization over Streamable HTTP succeeded and returned a session ID
    - `list_folder` succeeded end-to-end over MCP with Dropbox HTTP mocked at the network layer
- Constraint noted:
  - real Dropbox validation is blocked pending a live Dropbox access token; tracked in `docs/BLOCKERS.md`

## 2026-04-29T11:25:24-0600 Phase 3

- Read the installed Dropbox SDK type definitions from:
  - `node_modules/dropbox/types/index.d.ts`
  - `node_modules/dropbox/types/dropbox_types.d.ts`
  - `node_modules/dropbox/src/response.js` for the verified `fileBinary` download response shape not reflected in the published `.d.ts`
- Expanded the tool surface to cover:
  - file/folder ops: `list_folder`, `list_folder_continue`, `get_metadata`, `create_folder`, `delete`, `delete_batch`, `move`, `move_batch`, `copy`, `copy_batch`
  - upload/download: `upload_file`, `upload_file_chunked`, `download_file`
  - search: `search`, `search_continue`, alias `search_file_db`
  - revisions: `list_revisions`, `restore_revision`
  - sharing: `create_shared_link`, `get_temporary_link`, `list_shared_links`, `revoke_shared_link`, `modify_shared_link_settings`, `get_shared_link_metadata`
  - account: `get_current_account`, `get_space_usage`
- Added shared runtime validation and execution helpers for `path_root`, Dropbox retries, tool result shaping, and Dropbox error mapping
- Verification:
  - `npm run build`
  - expanded local MCP smoke showing 27 registered tools and successful `list_folder` execution over the HTTP transport with Dropbox HTTP mocked via `nock`
- Constraint noted:
  - the required real-account exercise for every tool remains blocked by the missing live Dropbox access token tracked in `docs/BLOCKERS.md`

## 2026-04-29T11:25:24-0600 Phase 4

- Replaced the skipped legacy suites with a new HTTP-aware test layout under:
  - `tests/tools/`
  - `tests/http/`
  - `tests/integration/`
  - `tests/helpers/`
- Added mocked Dropbox-client coverage for every registered tool through the real Streamable HTTP stack
- Added an MCP SDK client integration test against the running HTTP server with Dropbox mocked at the network layer using `nock`
- Deleted the old stdio-era skipped suites so the test run now has zero skips
- Verification:
  - `npm test` exited `0`
  - `npm run typecheck` exited `0`

## 2026-04-29T11:32:37-0600 Phase 5

- Added shared Dropbox `429` retry handling in [src/dropbox/retry.ts](../src/dropbox/retry.ts)
- Expanded structured logging so request IDs are assigned before origin/auth rejection and request completion logs now cover `POST`, `GET`, and `DELETE` MCP traffic
- Extracted graceful shutdown into [src/shutdown.ts](../src/shutdown.ts) and reused it from [src/index.ts](../src/index.ts)
- Documented stable error codes in [ERROR_CODES.md](./ERROR_CODES.md)
- Verification:
  - `npm run build`
  - `npm test`
  - coverage includes retry, redaction, error mapping, and shutdown tests

## 2026-04-29T11:32:37-0600 Phase 6

- Rewrote [README.md](../README.md) with architecture, quickstart, configuration, tool reference, and operational notes
- Added [Dockerfile](../Dockerfile), [docker-compose.yml](../docker-compose.yml), and [.dockerignore](../.dockerignore)
- Added [CHANGELOG.md](../CHANGELOG.md)
- Verification:
  - `docker build -t dbx-mcp-server-test .`

## 2026-04-29T11:32:37-0600 Phase 7

- Verification completed:
  - `npm run build`
  - `npm test`
  - `npm run typecheck`
  - `docker build -t dbx-mcp-server-test .`
- Live Dropbox MCP smoke completed with the provided team token plus delegated member context:
  - `get_current_account`
  - `create_folder`
  - `upload_file`
  - `download_file`
  - `search`
  - `create_shared_link`
  - `get_temporary_link`
  - `delete`
- Smoke details recorded in [SMOKE_TEST.md](./SMOKE_TEST.md)

## 2026-04-29T22:52:08-0600 MissionSquad Package Cleanup

- Removed Docker and GHCR release assets because the package now ships only as a MissionSquad stdio npm package
- Cleaned the GitHub Actions workflows so CI validates `build`, `test`, and `typecheck`, and publish handles only npm release behavior
- Updated package-facing metadata and docs to the final hidden-secret contract:
  - `accessToken`
  - `email`
- Fixed a runtime bug in delegated Dropbox Business resolution:
  - the server now attempts Dropbox calls with the raw token first
  - it resolves `email` into `selectUser` only when Dropbox explicitly requires delegated team-member context
- Verification:
  - `npm run build`
  - `npm test`
  - `npm run typecheck`
  - live stdio MCP initialize and `tools/list` succeeded
  - live Dropbox smoke succeeded for:
    - `get_current_account`
    - `create_folder`
    - `upload_file`
    - `download_file`
    - `create_shared_link`
    - `get_temporary_link`
    - `delete`

## 2026-04-29T23:59:00-0600 External OAuth HTTP Refactor

- Replaced the MissionSquad stdio hidden-secret runtime with an external Streamable HTTP server
- Added MCP OAuth protected-resource metadata and authorization-server metadata routes using the MCP SDK auth router
- Added bearer-token protection on `/mcp`
- Added SQLite persistence and AES-256-GCM encryption for persisted Dropbox secrets
- Added OAuth authorization, token, revocation, and Dropbox connect-start/callback flow wiring
- Rewired tool execution to resolve Dropbox auth from the authenticated linked-account context
- Restored container deployment assets and GHCR workflow
- Verification:
  - `npm run build`
  - `npm test`
  - `npm run typecheck`
  - `docker build -t mcp-dropbox-http-refactor-check .`
  - local HTTP smoke:
    - `GET /healthz`
    - `GET /.well-known/oauth-protected-resource/mcp`
    - `GET /.well-known/oauth-authorization-server`
    - unauthenticated `POST /mcp` returning `401` with `resource_metadata`
    - `GET /authorize` redirecting into `/oauth/dropbox/start`
    - `/oauth/dropbox/start` generating a Dropbox offline authorization redirect
