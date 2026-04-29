# Changelog

## Unreleased

### Added

- Streamable HTTP MCP transport on `/mcp` with `GET`, `POST`, and `DELETE` handling
- Request-scoped Dropbox token extraction from HTTP headers
- Request-scoped Dropbox client factory with optional `path_root`
- Full Dropbox tool surface for file operations, uploads, downloads, search, revisions, sharing, and account introspection
- Structured JSON logging with request IDs and Dropbox endpoint metadata
- Retry handling for Dropbox `429` responses
- Dockerfile and docker-compose local run assets
- HTTP integration coverage and mocked Dropbox-client tool tests

### Changed

- Replaced the stdio/single-tenant architecture with an HTTP multi-tenant design
- Replaced legacy tool names with the new surface, keeping `list_files` and `search_file_db` as deprecated aliases
- Rewrote the README for token-consumer deployment and Streamable HTTP usage

### Removed

- Interactive OAuth setup flow
- Encrypted token storage and token refresh persistence
- On-disk `.tokens.json` management
- PKCE helpers, token reset helpers, and legacy prompt/resource subsystems
