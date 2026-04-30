# External OAuth Refactor Plan

Date: 2026-04-29
Status: Implementation-ready plan
Scope: `mcp-dropbox` refactor back to an external Streamable HTTP MCP server with OAuth, plus the exact external server registration shape MissionSquad can use without platform code changes

## Objective

Refactor `@missionsquad/mcp-dropbox` from the current MissionSquad stdio hidden-secret package into a standalone HTTPS Streamable HTTP MCP server that:

1. Implements MCP Streamable HTTP transport
2. Implements MCP HTTP authorization discovery metadata
3. Acts as an OAuth-protected external MCP server for MissionSquad
4. Internally manages Dropbox OAuth code flow with offline access
5. Persists Dropbox refresh tokens durably and encrypted across restarts
6. Refreshes Dropbox access tokens automatically at runtime
7. Preserves the current Dropbox tool surface and team-member delegation behavior

This plan is based only on verified local code, local MCP spec files, and official Dropbox documentation.

## Verified Facts

### 1. MissionSquad already supports external OAuth for Streamable HTTP MCP servers

Verified in:

- [mcp-api/docs/external-mcp-system-context-2026-03-25.md](/Users/jaysonjacobs/Code/msq/mcp-api/docs/external-mcp-system-context-2026-03-25.md:34)
- [mcp-api/src/services/oauthTokens.ts](/Users/jaysonjacobs/Code/msq/mcp-api/src/services/oauthTokens.ts:1)
- [mcp-api/src/services/userServerInstalls.ts](/Users/jaysonjacobs/Code/msq/mcp-api/src/services/userServerInstalls.ts:1)
- [mcp-api/src/services/mcp.ts](/Users/jaysonjacobs/Code/msq/mcp-api/src/services/mcp.ts:57)

Verified platform behavior:

- shared external server definitions support `transportType: 'streamable_http'`
- shared external server definitions support `authMode: 'oauth2'`
- per-user OAuth tokens are already persisted by `mcp-api`
- per-user OAuth refresh is already implemented by `mcp-api`
- user install/auth state is already modeled as `not_connected`, `connected`, `reauth_required`, etc.

### 2. MCP HTTP authorization is the correct auth model for HTTP transports

Verified in local MCP spec:

- [mcp-spec/base-protocol/authorization.md](/Users/jaysonjacobs/Code/msq/mcp-api/mcp-spec/base-protocol/authorization.md:1)
- [mcp-spec/base-protocol/transports.md](/Users/jaysonjacobs/Code/msq/mcp-api/mcp-spec/base-protocol/transports.md:1)

Verified requirements relevant to this refactor:

- authorization is defined at the transport layer for HTTP-based transports
- stdio should not use this authorization model
- Streamable HTTP servers must expose one MCP endpoint and should implement auth for protected deployments
- protected MCP servers must expose OAuth Protected Resource Metadata
- MCP clients use resource metadata plus authorization server metadata discovery

### 3. Dropbox access tokens are short-lived; offline access requires refresh tokens

Verified in official Dropbox docs:

- [Dropbox OAuth Guide](https://developers.dropbox.com/oauth-guide)
- [Migrating App Permissions and Access Tokens](https://dropbox.tech/developers/migrating-app-permissions-and-access-tokens)
- [Dropbox authentication types](https://www.dropbox.com/developers/reference/auth-types)

Verified Dropbox rules:

- access tokens are short-lived
- refresh tokens are returned only when OAuth authorization uses `token_access_type=offline`
- the authorization code must be exchanged at `/oauth2/token`
- background/offline access should use refresh tokens
- Business/team tokens may require delegated member selection

### 4. The Dropbox JavaScript SDK already supports refresh-token-based auth

Verified in installed SDK:

- [node_modules/dropbox/types/index.d.ts](/Users/jaysonjacobs/Code/msq/mcp-dropbox/node_modules/dropbox/types/index.d.ts:7)
- [node_modules/dropbox/src/auth.js](/Users/jaysonjacobs/Code/msq/mcp-dropbox/node_modules/dropbox/src/auth.js:340)
- [node_modules/dropbox/src/dropbox.js](/Users/jaysonjacobs/Code/msq/mcp-dropbox/node_modules/dropbox/src/dropbox.js:1)

Verified SDK capabilities:

- `refreshToken`
- `clientId`
- `clientSecret`
- `accessTokenExpiresAt`
- automatic `checkAndRefreshAccessToken()`
- `refreshAccessToken()`

### 5. Current `mcp-dropbox` state is incompatible with the target architecture

Verified in current package:

- [package.json](/Users/jaysonjacobs/Code/msq/mcp-dropbox/package.json:1)
- [src/index.ts](/Users/jaysonjacobs/Code/msq/mcp-dropbox/src/index.ts:1)
- [src/config.ts](/Users/jaysonjacobs/Code/msq/mcp-dropbox/src/config.ts:1)

Current verified state:

- transport is stdio
- auth contract is hidden `accessToken` and `email`
- package metadata is MissionSquad stdio-oriented
- no external OAuth or HTTP runtime remains

## Locked Decisions

These are the decisions this plan adopts because they match verified platform and spec capabilities and minimize new moving parts.

### 1. Runtime mode

`mcp-dropbox` will return to:

- standalone process
- `streamable_http`
- single MCP endpoint path `/mcp`

It will no longer be a MissionSquad stdio hidden-secret package.

### 2. OAuth boundary

There are two separate OAuth/token systems:

1. MissionSquad authenticates to `mcp-dropbox`
2. `mcp-dropbox` authenticates to Dropbox

MissionSquad must store only tokens for talking to `mcp-dropbox`.

`mcp-dropbox` must store Dropbox refresh tokens internally.

### 3. Platform integration mode

MissionSquad will use the already-supported external server path:

- `source: 'external'`
- `transportType: 'streamable_http'`
- `authMode: 'oauth2'`

### 4. OAuth client registration mode

Use `registrationMode: 'manual'` for the first implementation.

Reason, based on verified facts:

- `mcp-api` already supports `manual`
- this avoids adding dynamic client registration support to `mcp-dropbox`
- it avoids relying on client metadata document hosting details
- it is the least moving parts path with no platform code changes

Verified support surfaces:

- [mcp-api/src/services/mcp.ts](/Users/jaysonjacobs/Code/msq/mcp-api/src/services/mcp.ts:75)
- [missionsquad-api/src/services/mcp.ts](/Users/jaysonjacobs/Code/msq/missionsquad-api/src/services/mcp.ts:84)

### 5. Persistence model

`mcp-dropbox` must persist, durably and encrypted:

- Dropbox `refresh_token`
- Dropbox account identity metadata needed to map the MCP user to the Dropbox auth record
- optional cached Dropbox access token + expiry
- optional cached Dropbox email / member resolution metadata

Locked storage choice:

- SQLite database file on a persisted container volume
- application-level encryption for sensitive fields using the same AES-256-GCM pattern already verified in MissionSquad’s `SecretEncryptor`

Verified local basis for this choice:

- MissionSquad already uses AES-256-GCM encrypted secret persistence: [mcp-api/src/utils/secretEncryptor.ts](/Users/jaysonjacobs/Code/msq/mcp-api/src/utils/secretEncryptor.ts:1)
- Current runtime here is Node `v22.22.0`
- `node:sqlite` is not available in this verified runtime, so implementation must add a SQLite library dependency rather than assuming a built-in module

It must not persist these in `.env`, the repository working tree, the ephemeral container filesystem, or memory only.

### 6. Current Business delegation logic remains

The existing `email -> team_member_id` resolution logic remains relevant for Dropbox Business team-token cases, but it moves behind the server’s own persisted Dropbox auth model.

## Non-Goals

This refactor will not:

- keep the current stdio hidden-secret package as the primary runtime
- require MissionSquad platform code changes for new auth infrastructure
- require users to paste Dropbox access tokens
- require users to paste Dropbox refresh tokens
- rely on an unmounted or ephemeral container filesystem for durable token persistence
- implement DCR in the first pass
- implement OpenID Connect identity usage beyond what MCP discovery requires

## Target Architecture

### External topology

```text
MissionSquad mcp-api
  -> external OAuth flow against mcp-dropbox
  -> calls mcp-dropbox /mcp with MCP access token

mcp-dropbox
  -> validates MCP access token
  -> loads user’s persisted Dropbox refresh token
  -> refreshes Dropbox access token if needed
  -> calls Dropbox API
```

### Required HTTP surface in `mcp-dropbox`

Verified-required or implementation-required endpoints:

1. `POST /mcp`
2. `GET /mcp`
3. `DELETE /mcp`
4. `GET /healthz`
5. OAuth protected resource metadata well-known path for the MCP endpoint
6. Authorization server metadata well-known path
7. OAuth authorization endpoint for MissionSquad
8. OAuth token endpoint for MissionSquad
9. Dropbox OAuth connect-start and callback endpoints, unless the same authorization server endpoints are designed to also own the Dropbox upstream flow

### Required internal data stores

At minimum:

1. MCP OAuth client/token/session persistence for MissionSquad users
2. Dropbox OAuth refresh-token persistence for Dropbox users/accounts linked through `mcp-dropbox`
3. Optional in-memory caches:
   - Dropbox short-lived access token + expiry
   - email -> team member resolution

### Locked persistence topology

The server must use:

- mounted persistent data directory, defaulting to `/data`
- SQLite database file inside that directory
- application-managed schema initialization on startup
- application-level encryption for sensitive columns

Recommended default file path:

- `/data/mcp-dropbox.sqlite`

The implementation should make the path configurable with an env var while defaulting to `/data/mcp-dropbox.sqlite`.

### Locked deployment assumption

The SQLite plan assumes:

- one active writer instance for a given database file
- no multi-writer horizontal scaling against the same SQLite file over a shared network volume
- backups are taken at the mounted volume layer or by copying the SQLite file safely

If later deployment requires multiple write-active replicas, this storage decision must be revisited.

## Concrete Implementation Phases

## Phase 0: Baseline and guardrails

1. Freeze the current Dropbox tool behavior and tests as the functional baseline
2. Create a new refactor checklist in `tasks/todo.md`
3. Add a dedicated design document for this refactor
4. Record all local and external references used for the design

Acceptance:

- plan doc exists
- checklist exists
- no implementation starts before the plan is committed

## Phase 1: Restore external HTTP runtime skeleton

### Work

1. Replace stdio-only startup with an HTTP server entrypoint
2. Reintroduce `StreamableHTTPServerTransport`
3. Reintroduce `/mcp` and `/healthz`
4. Reintroduce origin validation required by the MCP spec
5. Keep existing tool registration modules and runtime helpers where compatible

### Files to create or restore

- `src/server.ts`
- `src/http/*` for request handling and origin validation
- `src/shutdown.ts`

### Files to modify

- `src/index.ts`
- `package.json`
- `README.md`
- `manifest.json`

### Files to delete or retire

- MissionSquad stdio-only metadata blocks and hidden-secret-specific docs

Acceptance:

- local HTTP server starts
- `/healthz` responds `200`
- MCP initialize works over `POST /mcp`

## Phase 2: Add MCP HTTP authorization surface

### Work

1. Add OAuth Protected Resource Metadata endpoint(s)
2. Add `WWW-Authenticate` challenge behavior on unauthenticated MCP requests
3. Add authorization server metadata endpoint(s)
4. Decide and document exact issuer URL and metadata URLs
5. Ensure MissionSquad can discover the auth server automatically from the MCP endpoint

### Notes

This phase must follow the MCP authorization spec exactly enough for MissionSquad’s external OAuth client path to work.

Acceptance:

- unauthenticated request to `/mcp` returns `401`
- `WWW-Authenticate` includes `resource_metadata`
- protected resource metadata advertises at least one authorization server
- authorization server metadata is discoverable from the advertised issuer

## Phase 3: Implement `mcp-dropbox` as an OAuth authorization server for MissionSquad

### Work

1. Add authorization endpoint
2. Add token endpoint
3. Implement PKCE-capable authorization code flow for MissionSquad as MCP client
4. Support the `manual` client registration mode first
5. Persist issued tokens for MissionSquad users
6. Support refresh tokens on the `mcp-dropbox` authorization server side as appropriate for the client model

### Verified dependency

MissionSquad external OAuth token persistence already expects:

- access token
- refresh token
- expiry
- client credentials metadata

Acceptance:

- MissionSquad can complete connect flow against `mcp-dropbox`
- MissionSquad receives connected auth state for the external server
- reauth and refresh behavior work through the existing platform OAuth token service

## Phase 4: Implement Dropbox upstream OAuth inside `mcp-dropbox`

### Work

1. Add Dropbox app config:
   - `DROPBOX_APP_KEY`
   - `DROPBOX_APP_SECRET`
   - `DROPBOX_REDIRECT_URI`
2. Add Dropbox authorization start flow using:
   - code flow
   - `token_access_type=offline`
3. Add Dropbox OAuth callback handler
4. Exchange Dropbox auth code at `/oauth2/token`
5. Persist:
   - Dropbox refresh token
   - Dropbox access token
   - expiry
   - Dropbox account ID
   - optional team/account metadata

### Important requirement

This is the step that removes user responsibility for acquiring refresh tokens manually.

Acceptance:

- user can link Dropbox through browser redirect flow
- resulting Dropbox refresh token is persisted durably and encrypted
- restart does not break Dropbox connectivity

## Phase 5: Replace direct-token tool auth with persisted Dropbox auth resolution

### Work

1. Remove current `accessToken` hidden-secret/env-first execution contract
2. Introduce request auth context for the authenticated MissionSquad user
3. Resolve linked Dropbox account for that authenticated user
4. Build Dropbox client using:
   - persisted refresh token
   - app key
   - app secret
   - cached access token and expiry when available
5. Let Dropbox SDK refresh short-lived access tokens automatically
6. Persist updated access token and expiry after refresh if the chosen design stores them

### Files to modify

- `src/config.ts`
- `src/dropbox/client-factory.ts`
- `src/tools/runtime.ts`
- `src/dropbox/team-member-resolver.ts`
- `src/errors/map-dropbox-error.ts`

Acceptance:

- tool handlers no longer depend on hidden `accessToken`
- expired Dropbox access token is recovered transparently using refresh token
- restart-safe auth is proven

## Phase 6: Reintroduce or adapt Business delegation

### Work

1. Preserve the verified `email -> team_member_id` resolver
2. Tie resolver to the persisted Dropbox auth identity
3. Keep lazy delegation:
   - try raw Dropbox call first
   - if Dropbox requires delegated user context, resolve member and retry
4. Persist or cache member lookup safely

Acceptance:

- normal user-linked Dropbox accounts work with no manual team config
- Business/team-linked accounts work when Dropbox requires delegated member context

## Phase 7: Durable storage layer

### Work

1. Add a SQLite-backed persistence layer for `mcp-dropbox`
2. Store the database file on the mounted persistent volume
3. Encrypt persisted sensitive fields with AES-256-GCM
4. Add startup schema initialization and migration handling
5. Add a clear single-writer operational note to deployment docs

### Locked implementation constraints

- the persistence backend is SQLite
- the database file lives on the mounted persistent volume, default `/data/mcp-dropbox.sqlite`
- sensitive fields are encrypted before writing to SQLite
- the implementation must add a SQLite library dependency because `node:sqlite` is not available in the verified runtime here

### Minimum required tables or equivalent records

1. MissionSquad OAuth token record
2. Dropbox OAuth token record
3. PKCE/code-verifier or state record where applicable
4. linked-account mapping record

The exact normalized schema may differ, but the implementation must cover these persisted concerns.

Acceptance:

- no critical auth state is kept only in memory
- restart-safe OAuth flows are proven in tests
- persisted database survives container restart via mounted volume

## Phase 8: Tests

### Required coverage

1. HTTP transport tests
2. authorization metadata discovery tests
3. MissionSquad OAuth authorization endpoint tests
4. token endpoint tests
5. Dropbox OAuth callback and token exchange tests
6. persisted refresh-token runtime refresh tests
7. regression tests for all Dropbox tools
8. Business delegation retry tests
9. restart-safe persistence tests

### Required live verification

1. external OAuth connect from MissionSquad to `mcp-dropbox`
2. Dropbox connect through `mcp-dropbox`
3. live Dropbox tool calls after server restart

Acceptance:

- `npm run build`
- `npm test`
- `npm run typecheck`
- live end-to-end smoke across:
  - MissionSquad external OAuth
  - Dropbox OAuth
  - Dropbox tool execution

## Phase 9: Packaging and deployment

### Work

1. Restore container runtime artifacts:
   - `Dockerfile`
   - `docker-compose.yml` for local integration only if still useful
2. Restore GHCR image publishing if deployment uses containers
3. Keep npm publishing only if still needed for code reuse or local tooling; it is no longer the primary runtime artifact

Acceptance:

- container image runs the HTTP server correctly
- containerized deployment preserves durable storage behavior

## External Server Registration Shape

The first platform registration should use a shared external definition compatible with current MissionSquad support.

### Recommended auth mode

```json
{
  "source": "external",
  "transportType": "streamable_http",
  "authMode": "oauth2"
}
```

### Recommended registration mode

`manual`

Rationale:

- verified existing platform support
- lowest implementation complexity on `mcp-dropbox`
- no DCR requirement

### Required server metadata fields

At minimum:

- `name`
- `displayName`
- `description`
- `source`
- `transportType`
- `url`
- `authMode`
- `oauthTemplate`

### Required `oauthTemplate` contents

This must be generated from the actual deployed server metadata, not handwritten guesses.

The implementation must populate:

- `authorizationServerIssuer`
- `authorizationServerMetadataUrl`
- `resourceMetadataUrl`
- `resourceUri`
- `authorizationEndpoint`
- `tokenEndpoint`
- `codeChallengeMethodsSupported`
- `pkceRequired`
- `discoveryMode`
- `registrationMode: 'manual'`
- `manualClientCredentialsAllowed`

## Files Expected To Change In `mcp-dropbox`

### New or restored runtime/auth files

- `src/server.ts`
- `src/shutdown.ts`
- `src/http/*`
- `src/oauth/*`
- `src/persistence/*`
- `src/auth/*`

### Expected persistence-specific files

- `src/persistence/sqlite.ts`
- `src/persistence/schema.ts`
- `src/persistence/migrations/*` or equivalent migration bootstrap
- `src/persistence/repositories/*`

### Modified Dropbox execution files

- `src/index.ts`
- `src/config.ts`
- `src/dropbox/client-factory.ts`
- `src/dropbox/team-member-resolver.ts`
- `src/errors/map-dropbox-error.ts`
- `src/tools/runtime.ts`

### Modified packaging/docs

- `package.json`
- `README.md`
- `CHANGELOG.md`
- `docs/SMOKE_TEST.md`
- `docs/COMPLETION_REPORT.md`
- `docs/BLOCKERS.md`
- `docs/ERROR_CODES.md`

### Likely removed

- MissionSquad stdio hidden-secret-specific metadata and docs

## Locked Storage Decision

The persistence backend is now locked:

- SQLite database file
- mounted persistent container volume
- encrypted sensitive fields

Implementation must still document:

- schema
- migration strategy
- local development story
- production deployment story
- backup and restore procedure

## Verification Checklist

The implementation is complete only when all of the following are proven:

1. MissionSquad can install `mcp-dropbox` as an external Streamable HTTP server
2. MissionSquad can connect to `mcp-dropbox` through external OAuth
3. `mcp-dropbox` can connect the user to Dropbox through Dropbox OAuth with offline access
4. Dropbox refresh token is persisted durably and encrypted
5. `mcp-dropbox` can restart and still execute Dropbox tools successfully
6. expired Dropbox access tokens are refreshed automatically
7. Dropbox Business delegated-member retry path still works
8. `npm run build` passes
9. `npm test` passes
10. `npm run typecheck` passes

## Recommended Execution Order

1. Restore HTTP transport
2. Add MCP auth discovery endpoints
3. Add `mcp-dropbox` authorization server endpoints for MissionSquad
4. Add Dropbox upstream OAuth
5. Add durable encrypted persistence
6. Rewire tool runtime to persisted refresh-token auth
7. Re-add deployment artifacts
8. Run end-to-end smoke across both OAuth layers
