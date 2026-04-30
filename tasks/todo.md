# Dropbox MCP Refactor Checklist

- [x] Phase 0: Re-read the mission prompt and required references after writing the plan
- [x] Phase 0: Document the current repository architecture in `docs/CURRENT_ARCHITECTURE.md`
- [x] Phase 0: Document the file-by-file refactor plan in `docs/REFACTOR_PLAN.md`
- [x] Phase 0: Create `docs/PHASE_LOG.md` and append the Phase 0 completion entry with sources consulted

- [x] Phase 1: Remove the `setup` workflow from `package.json`
- [x] Phase 1: Delete OAuth, PKCE, token refresh, encryption, and token persistence source files
- [x] Phase 1: Remove legacy auth env vars from `.env.example`, config loading, and docs
- [x] Phase 1: Skip legacy tests with `TODO(Phase 4)` markers where temporary coverage breakage is expected
- [x] Phase 1: Run `npm run build`
- [x] Phase 1: Append Phase 1 verification note to `docs/PHASE_LOG.md`

- [x] Phase 2: Install or upgrade dependencies required for Streamable HTTP, validation, logging, and HTTP testing
- [x] Phase 2: Implement minimal runtime config with `PORT`, `LOG_LEVEL`, origin validation, retry, and shutdown settings
- [x] Phase 2: Implement Express HTTP server with `POST /mcp`, `GET /mcp`, `DELETE /mcp`, and `GET /healthz`
- [x] Phase 2: Implement token extraction middleware for `Authorization` and `X-Dropbox-Access-Token`
- [x] Phase 2: Implement request-scoped Dropbox client factory with optional `PathRoot`
- [x] Phase 2: Refactor MCP server wiring for Streamable HTTP transport
- [x] Phase 2: Smoke-test initialization and unauthenticated rejection behavior
- [x] Phase 2: Run `npm run build` and targeted tests
- [x] Phase 2: Append Phase 2 verification note to `docs/PHASE_LOG.md`

- [x] Phase 3: Inspect Dropbox SDK type definitions in `node_modules/dropbox/types/`
- [x] Phase 3: Implement file/folder tools with Zod validation and structured errors
- [x] Phase 3: Implement upload and download tools, including chunked upload routing and base64 download responses
- [x] Phase 3: Implement search and search cursor continuation tools
- [x] Phase 3: Implement revisions and restore tools
- [x] Phase 3: Implement sharing tools, including persistent public links and temporary direct links
- [x] Phase 3: Implement account tools
- [x] Phase 3: Preserve `list_files` and `search_file_db` as one-release aliases with deprecation logging
- [x] Phase 3: Add at least one mocked unit test per tool
- [x] Phase 3: Exercise every tool against a real Dropbox account during verification
- [x] Phase 3: Run `npm run build` and relevant tests
- [x] Phase 3: Append Phase 3 verification note to `docs/PHASE_LOG.md`

- [x] Phase 4: Reactivate any previously skipped tests
- [x] Phase 4: Replace the legacy stdio-oriented test helpers with HTTP-aware helpers
- [x] Phase 4: Add end-to-end MCP client integration coverage against the HTTP server
- [x] Phase 4: Ensure `npm test` passes with zero skips
- [x] Phase 4: Append Phase 4 verification note to `docs/PHASE_LOG.md`

- [x] Phase 5: Implement shared Dropbox 429 retry handling with `Retry-After` support
- [x] Phase 5: Implement structured JSON logging with `request_id`, `tool_name`, `latency_ms`, and `dropbox_endpoint`
- [x] Phase 5: Implement `mapDropboxError(err)` and document stable codes in `docs/ERROR_CODES.md`
- [x] Phase 5: Implement graceful shutdown with 30 second drain timeout
- [x] Phase 5: Add tests for retry, logging redaction, error mapping, and shutdown
- [x] Phase 5: Run `npm run build` and `npm test`
- [x] Phase 5: Append Phase 5 verification note to `docs/PHASE_LOG.md`

- [x] Phase 6: Rewrite `README.md` from scratch with architecture, quickstart, tool reference, config, and ops notes
- [x] Phase 6: Add `Dockerfile`
- [x] Phase 6: Add `docker-compose.yml`
- [x] Phase 6: Add `CHANGELOG.md`
- [x] Phase 6: Run `npm run build` and `npm test`
- [x] Phase 6: Append Phase 6 verification note to `docs/PHASE_LOG.md`

- [x] Phase 7: Add `typecheck` script if missing
- [x] Phase 7: Run `npm run build`
- [x] Phase 7: Run `npm test`
- [x] Phase 7: Run `npm run typecheck`
- [x] Phase 7: Perform manual smoke tests against a real Dropbox account for file ops, upload, download, search, sharing, and account tools
- [x] Phase 7: Document smoke results in `docs/SMOKE_TEST.md`
- [x] Phase 7: Re-read the mission prompt and produce `docs/COMPLETION_REPORT.md`
- [x] Phase 7: Review the final diff for unexercised paths or lingering single-tenant behavior

## 2026-04-29 MissionSquad Package Cleanup

- [x] Remove Docker and GHCR artifacts that are no longer used by the MissionSquad package runtime
- [x] Clean up CI/CD so it validates and publishes the npm package only
- [x] Update package/runtime metadata to match the published `0.3.0` stdio package
- [x] Remove stale Docker and HTTP operator guidance from package-facing docs
- [x] Run `npm run build`
- [x] Run `npm test`
- [x] Run `npm run typecheck`
- [x] Perform a real stdio smoke test using the env fallbacks without directly reading `.env`
- [x] Record the final verification results in the docs review section

## Review

- `npm run build` passed on 2026-04-29
- `npm test` passed on 2026-04-29 with 6 files and 12 tests green
- `npm run typecheck` passed on 2026-04-29
- Live stdio smoke passed on 2026-04-29 after the local fallback token was refreshed
- Verified live tools:
  - `get_current_account`
  - `create_folder`
  - `upload_file`
  - `download_file`
  - `create_shared_link`
  - `get_temporary_link`
  - `delete`

## 2026-04-29 External OAuth Refactor Plan

- [x] Verify current `mcp-api` external OAuth and Streamable HTTP support from local source files
- [x] Verify current Dropbox OAuth and refresh-token requirements from official docs
- [x] Verify current Dropbox SDK refresh-token surface from installed SDK types/source
- [x] Write implementation-ready external OAuth refactor plan in `docs/EXTERNAL_OAUTH_REFACTOR_PLAN.md`
- [x] Record the verified architecture decision: external Streamable HTTP + OAuth, not stdio hidden-secret auth

## 2026-04-29 External OAuth Implementation

- [x] Replace the current stdio hidden-secret runtime with an external Streamable HTTP server entrypoint
- [x] Reintroduce `/mcp` and `/healthz` plus origin validation and graceful shutdown
- [x] Add MCP OAuth protected-resource metadata and authorization-server metadata endpoints
- [x] Implement `mcp-dropbox` OAuth endpoints for MissionSquad client authorization
- [x] Add SQLite persistence on the mounted volume with encrypted sensitive fields
- [x] Implement Dropbox OAuth code flow with `token_access_type=offline`
- [x] Persist Dropbox refresh tokens and cached access-token state durably
- [x] Rewire tool execution to resolve Dropbox auth from persisted linked accounts instead of hidden `accessToken`
- [x] Preserve and retest Dropbox Business delegated-member retry behavior
- [x] Restore deployment artifacts for the external HTTP container runtime
- [x] Update README, changelog, and verification docs for the new architecture
- [x] Run `npm run build`
- [x] Run `npm test`
- [x] Run `npm run typecheck`
- [ ] Perform end-to-end smoke validation for:
  - MissionSquad external OAuth discovery/connect
  - Dropbox upstream OAuth connect
  - live Dropbox tool execution after restart

## External OAuth Review

- `npm run build` passes after the HTTP/OAuth refactor
- `npm test` passes with 6 files and 11 tests green
- `npm run typecheck` passes
- Local HTTP smoke passed for:
  - `GET /healthz`
  - `GET /.well-known/oauth-protected-resource/mcp`
  - `GET /.well-known/oauth-authorization-server`
  - unauthenticated `POST /mcp` returning `401` plus `WWW-Authenticate` `resource_metadata`
  - `GET /authorize` redirecting into `/oauth/dropbox/start`
  - `/oauth/dropbox/start` generating a Dropbox offline-authorization redirect URL
- Container build passes with `docker build -t mcp-dropbox-http-refactor-check .`
- Full interactive Dropbox OAuth browser flow on the new external server is not yet proven in this terminal session
