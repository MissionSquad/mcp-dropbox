# Smoke Test

## 2026-04-29 External HTTP Runtime Validation

- Mode: local external Streamable HTTP validation
- Server config:
  - `PUBLIC_BASE_URL=http://127.0.0.1:3005`
  - `SQLITE_PATH=/private/tmp/mcp-dropbox-smoke.sqlite`
  - static local OAuth client config and Dropbox app config placeholders
- Verified:
  - `npm run build` exited `0`
  - `npm test` exited `0`
  - `npm run typecheck` exited `0`
  - `docker build -t mcp-dropbox-http-refactor-check .` exited `0`
  - `GET /healthz` returned `200`
  - `GET /.well-known/oauth-protected-resource/mcp` returned protected resource metadata
  - `GET /.well-known/oauth-authorization-server` returned OAuth authorization server metadata
  - unauthenticated `POST /mcp` returned `401` and included `WWW-Authenticate` with `resource_metadata`
  - `GET /authorize` redirected into `/oauth/dropbox/start`
  - `GET /oauth/dropbox/start` generated a Dropbox authorization redirect with `token_access_type=offline`

## Remaining Interactive Validation

- Not yet executed in this terminal session:
  - full MissionSquad external OAuth connect completion
  - full Dropbox browser OAuth callback completion on the new external server
  - live Dropbox tool execution after restart on the new external server architecture
