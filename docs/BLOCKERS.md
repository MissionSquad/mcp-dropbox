# Blockers

## 2026-04-29T23:59:00-0600 Interactive OAuth End-To-End Validation

- Status: resolved
- Impact: previously prevented me from claiming a full end-to-end production OAuth verification on the new external server architecture
- What I verified locally:
  - the external HTTP server starts
  - OAuth protected-resource metadata is served correctly
  - OAuth authorization-server metadata is served correctly
  - unauthenticated MCP requests challenge correctly
  - `GET /authorize` redirects into the Dropbox connect-start flow
  - `/oauth/dropbox/start` generates a Dropbox offline authorization URL
- Additional confirmation from operator testing:
  - the browser-based MissionSquad -> `mcp-dropbox` OAuth flow worked
  - the Dropbox callback flow worked in the deployed environment
  - the previous external OAuth iteration behaved as expected end to end
- What is still needed:
  - Nothing further for this blocker

## 2026-04-30T18:15:00-0600 Dynamic Client Registration Live Validation

- Status: active
- Impact: prevents me from claiming that the newly added DCR path is live-proven end to end
- What I verified:
  - the server now persists dynamically registered OAuth clients
  - the OAuth metadata advertises `registration_endpoint`
  - build, tests, and typecheck pass with DCR support enabled
- What is still needed:
  - exercise a real `POST /register` from MissionSquad or another MCP client
  - complete OAuth and a live MCP tool call using a dynamically registered client
