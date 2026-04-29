# Refactor Plan

## Scope

This refactor will replace the current single-tenant stdio server with a stateless Streamable HTTP MCP server that accepts Dropbox access tokens per request, creates a request-scoped Dropbox SDK client, supports optional `PathRoot` overrides, exposes the full required tool surface, and removes all server-side OAuth, token storage, and legacy prompt/resource code not required by the mission.

## New dependencies to add

| Package | Why it is needed |
| --- | --- |
| `express` | HTTP server for `POST/GET/DELETE /mcp` and `/healthz` |
| `zod` | Runtime validation for every tool input and `path_root` union |
| `pino` | Structured JSON logging with redaction-safe request metadata |
| `nock` | HTTP-level Dropbox API mocking for the MCP client integration test |
| `supertest` or equivalent | HTTP server assertions for health and transport endpoints if needed |

These are targeted additions, each directly tied to explicit mission requirements.

## Files to modify

| Path | Why |
| --- | --- |
| `package.json` | Remove `setup`, add `typecheck`, add/update dependencies and scripts for the HTTP server and tests |
| `package-lock.json` | Reflect dependency and script changes |
| `tsconfig.json` | Move to ES2022/NodeNext-aligned settings, drop `allowJs`, keep strict declaration output |
| `jest.config.cjs` | Repoint the suite at the new HTTP and tool architecture, remove legacy JS mock assumptions |
| `.env.example` | Replace auth/OAuth vars with runtime-only operational settings |
| `README.md` | Full rewrite for the new architecture, tools, Docker usage, and operations |
| `src/index.ts` | Replace stdio boot with HTTP server startup and graceful shutdown |

## Files to delete

| Path | Why |
| --- | --- |
| `src/auth.ts` | Legacy OAuth, refresh, and token persistence logic conflicts with header-based auth |
| `src/auth.js` | Checked-in JS duplicate of legacy auth logic |
| `src/security-utils.ts` | Encryption utilities are unnecessary with no token storage |
| `src/security-utils.js` | Checked-in JS duplicate of encryption utilities |
| `src/setup.ts` | Interactive OAuth setup flow is forbidden by the mission |
| `src/setup.js` | Checked-in JS duplicate of the setup flow |
| `src/create-tokens.ts` | On-disk token creation is forbidden |
| `src/exchange-code.ts` | OAuth code exchange is forbidden |
| `src/generate-auth-url.ts` | Server-side authorization URL generation is forbidden |
| `src/reset-tokens.ts` | Token reset utility is obsolete once token storage is removed |
| `src/reset-tokens.js` | Checked-in JS duplicate of token reset logic |
| `reset-tokens.sh` | Shell wrapper for obsolete token reset logic |
| `src/dbx-api.ts` | Replace monolithic singleton-style Dropbox wrapper with request-scoped tool modules |
| `src/dbx-server.ts` | Replace stdio-era MCP wiring with HTTP-aware server factory |
| `src/tool-definitions.ts` | Replace static legacy schemas with validated tool registration |
| `src/interfaces.ts` | Replace ad hoc MCP response typing with current tool result types |
| `src/resource-handler.ts` | Remove legacy resource subsystem outside mission scope |
| `src/resource/resource-handler.ts` | Remove legacy resource subsystem outside mission scope |
| `src/resource/resource-resolver.ts` | Remove legacy resource subsystem outside mission scope |
| `src/prompt-handler.ts` | Remove legacy prompt subsystem outside mission scope |
| `src/prompt-definitions.ts` | Remove legacy prompt subsystem outside mission scope |
| `src/prompt-definitions/file-review-prompt.ts` | Remove legacy prompt subsystem outside mission scope |
| `src/prompt-handlers/resource-prompt-handler.ts` | Remove legacy prompt/resource integration outside mission scope |
| `src/types/resource-types.ts` | Remove legacy prompt/resource typing outside mission scope |
| `src/examples/resource-prompt-example.ts` | Remove outdated example coupled to deleted prompt/resource modules |
| `tests/dbx-operations.test.ts` | Replace stdio integration test with HTTP MCP client integration coverage |
| `tests/resource-system.test.ts` | Remove tests for the deleted resource/prompt subsystem |
| `tests/resource/handler.test.ts` | Remove tests for the deleted resource subsystem |
| `tests/resource/prompt-handler.test.ts` | Remove tests for the deleted prompt subsystem |
| `tests/resource/resolver.test.ts` | Remove tests for the deleted resource subsystem |
| `tests/resource/test-helpers.ts` | Remove helper for deleted resource tests |
| `tests/resource/test-helpers.mock.js` | Remove helper for deleted resource tests |
| `tests/mocks/auth.js` | Remove mock for deleted auth module |
| `tests/mocks/config.js` | Replace with new config mocks tied to the HTTP server if still needed |
| `tests/mocks/dbx-api.js` | Replace with Dropbox client mocks aligned to the new tool architecture |

## Files to create

| Path | Why |
| --- | --- |
| `docs/PHASE_LOG.md` | Append-only verification log required between phases |
| `docs/ERROR_CODES.md` | Stable error code reference for mapped Dropbox/MCP failures |
| `docs/SMOKE_TEST.md` | Evidence for the real Dropbox end-to-end verification run |
| `docs/COMPLETION_REPORT.md` | Final phase-by-phase proof of completion |
| `docs/BLOCKERS.md` | Place to document any hard blockers with citations if encountered |
| `tasks/todo.md` | Required execution checklist for the mission |
| `src/config.ts` | Minimal operational config loader without auth state |
| `src/http-server.ts` | Express server setup, middleware, route registration, and shutdown hooks |
| `src/mcp/create-server.ts` | MCP server factory and tool registration entry point |
| `src/mcp/session-store.ts` | Transport/session bookkeeping for Streamable HTTP sessions |
| `src/http/auth-context.ts` | Header token extraction and per-request request-context typing |
| `src/http/origin-guard.ts` | Origin validation required by Streamable HTTP security guidance |
| `src/dropbox/client-factory.ts` | `createDropboxClient(accessToken, pathRoot?)` implementation |
| `src/dropbox/path-root.ts` | Zod validation and serialization for Dropbox `PathRoot` |
| `src/dropbox/retry.ts` | Shared 429 retry and backoff utility |
| `src/errors/map-dropbox-error.ts` | Dropbox-to-MCP error translation with stable codes |
| `src/errors/mcp-server-error.ts` | Local helpers for structured MCP error payloads |
| `src/tools/common.ts` | Shared schema helpers, result formatting, and alias registration |
| `src/tools/file-operations.ts` | List, metadata, create, delete, move, copy, and batch tools |
| `src/tools/upload-download.ts` | Upload, chunked upload, and download tools |
| `src/tools/search.ts` | Search and search continuation tools |
| `src/tools/revisions.ts` | Revision listing and restore tools |
| `src/tools/sharing.ts` | Shared link and temporary link tools |
| `src/tools/account.ts` | Account and space usage tools |
| `src/tools/schemas.ts` | Central Zod schemas for tool inputs including `path_root` |
| `tests/helpers/http-server.ts` | Start/stop helpers for HTTP integration tests |
| `tests/helpers/dropbox-mocks.ts` | Shared mocked Dropbox client builders and fixture data |
| `tests/integration/http-mcp.test.ts` | MCP SDK `Client` integration test against the HTTP server |
| `tests/tools/file-operations.test.ts` | Mocked unit tests for file and folder tools |
| `tests/tools/upload-download.test.ts` | Mocked unit tests for upload and download tools |
| `tests/tools/search.test.ts` | Mocked unit tests for search tools |
| `tests/tools/revisions.test.ts` | Mocked unit tests for revision tools |
| `tests/tools/sharing.test.ts` | Mocked unit tests for sharing tools |
| `tests/tools/account.test.ts` | Mocked unit tests for account tools |
| `tests/http/auth-middleware.test.ts` | Coverage for header extraction and missing-token failures |
| `tests/http/shutdown.test.ts` | Coverage for graceful shutdown behavior |
| `tests/errors/map-dropbox-error.test.ts` | Coverage for stable error-code mapping |
| `tests/dropbox/retry.test.ts` | Coverage for 429 retry handling |
| `Dockerfile` | Multi-stage production image required by the mission |
| `docker-compose.yml` | Local development orchestration required by the mission |
| `CHANGELOG.md` | Summary of changes from upstream fork |

## Files to replace in-place during test migration

| Path | Why |
| --- | --- |
| `tests/setup.ts` | Rebuild global mocks and shared setup for the request-scoped HTTP architecture |
| `tests/dropbox/account.test.ts` | Replace legacy stdio expectations with current tool and schema expectations |
| `tests/dropbox/file-operations.test.ts` | Replace legacy stdio expectations with current tool and schema expectations |
| `tests/dropbox/search-delete.test.ts` | Replace legacy stdio expectations with current tool and schema expectations |
| `tests/dropbox/test-helpers.ts` | Replace child-process stdio helper with HTTP/MCP client helpers |
| `tests/constants.ts` | Update shared fixtures for the new test surface |
| `tests/utils/test-logger.ts` | Align with structured logger assertions where needed |
| `tests/utils/test-results-tracker.ts` | Keep or simplify depending on usefulness after test rewrite |

## Implementation sequence

1. Strip single-tenant auth and token storage until the build is clean again
2. Install missing dependencies and replace stdio with Streamable HTTP transport
3. Build the request context, Dropbox client factory, path-root validation, and shared error mapping
4. Implement tools by domain in the order required by the mission
5. Replace the entire test strategy so coverage matches the new architecture
6. Add operational hardening, Docker assets, and final documentation
7. Finish with build, test, typecheck, and real Dropbox smoke verification
