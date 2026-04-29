# Blockers

## 2026-04-29T10:35:00-0600 Live Dropbox Credential Access

- Status: resolved
- Impact: prevents the mandatory real-account Dropbox smoke runs required by Phase 3 and Phase 7
- What I verified:
  - `DROPBOX_ACCESS_TOKEN` is absent from the current shell environment
  - `.env` is not present with a Dropbox access token in this repository
  - `.tokens.json` is not present in this repository
- Current workaround:
  - Streamable HTTP handshake and `list_folder` smoke checks are running against the local server with a synthetic bearer token and Dropbox HTTP mocked at the network layer
- What is still needed:
  - Nothing further for this blocker

## 2026-04-29T11:40:00-0600 Dropbox Business Team Token Delegation

- Status: resolved
- Impact: blocks the real-account smoke run with the currently supplied token
- What I verified:
  - The live Dropbox API rejected `users/get_current_account` with a `400` response stating that the provided OAuth token is for an entire Dropbox Business team, not a single Dropbox account
  - Dropbox’s error explicitly requires `Dropbox-API-Select-User` or `select_user` to target a specific team member
- Mitigation implemented:
  - The server now accepts optional request headers `X-Dropbox-Select-User` and `X-Dropbox-Select-Admin` and passes them through the Dropbox SDK as `selectUser` and `selectAdmin`
  - The server also accepts local-only env fallbacks `DROPBOX_SELECT_USER` and `DROPBOX_SELECT_ADMIN` when the headers are absent
- What is still needed:
  - Nothing further for this blocker
