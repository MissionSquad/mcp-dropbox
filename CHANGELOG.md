# Changelog

## Unreleased

### Added

- External Streamable HTTP runtime on `/mcp`
- MCP OAuth protected-resource metadata and authorization-server metadata endpoints
- OAuth authorization, token, and revocation endpoints for MissionSquad external MCP auth
- Dropbox OAuth connect-start and callback endpoints with offline access
- SQLite persistence on a mounted volume for OAuth and linked-account state
- Encrypted persistence for Dropbox refresh tokens and cached access tokens
- Email-to-team-member resolution for Dropbox Business tokens with in-process LRU caching
- Full Dropbox tool surface for file operations, uploads, downloads, search, revisions, sharing, and account introspection
- Structured JSON logging to stderr with Dropbox endpoint metadata
- Retry handling for Dropbox `429` responses
- Vitest coverage for hidden-secret config resolution, retries, logging, team-member resolution, and tool registration

### Changed

- Replaced the MissionSquad stdio hidden-secret runtime with an external HTTP OAuth architecture
- Replaced legacy tool names with the new surface, keeping `list_files` and `search_file_db` as deprecated aliases
- Rewrote the README for external HTTP deployment and OAuth usage

### Removed

- MissionSquad stdio hidden-secret package metadata as the primary runtime contract
