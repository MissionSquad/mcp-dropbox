# Lessons

## 2026-04-29 MissionSquad Hidden Secret Integration

- Do not assume MissionSquad external MCP integration is driven by per-request HTTP headers just because a server supports them.
- When the user points to the MissionSquad hidden-secret handbook, treat that as the governing runtime contract:
  - hidden auth values must be omitted from tool schema
  - MissionSquad stores them per user and per server
  - `mcp-api` injects them immediately before tool execution
  - server code must read them from the runtime hidden-argument path rather than expecting the client to send them directly
- Before advising how users authenticate in MissionSquad, verify whether the server is expected to run as a hidden-secret-aware MissionSquad server rather than a generic external streamable HTTP endpoint.

## 2026-04-29 MissionSquad Secret UX

- Default to the smallest user-facing secret contract that can be resolved internally.
- Prefer user-friendly identifiers such as email over provider-specific opaque IDs when the server can safely resolve the provider ID itself.
- When a package pivots away from HTTP deployment, remove stale Docker and transport guidance from operator-facing docs in the same pass.

## 2026-04-29 Persistence Choice

- Do not overfit persistence recommendations to the broader platform stack when the service is intended to run as an isolated external container.
- If the deployment is a single-container or single-writer service with a mounted persistent volume, evaluate SQLite before recommending a network database.
- Verify runtime support before naming a built-in storage module; in this environment `node:sqlite` is not available in Node `v22.22.0`.
