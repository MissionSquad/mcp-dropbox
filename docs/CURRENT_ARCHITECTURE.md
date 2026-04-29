# Current Architecture

## Repository state

The current `dbx-mcp-server` implementation is a single-tenant MCP server built around stdio transport, Dropbox OAuth setup scripts, encrypted on-disk token persistence, and a singleton-style Dropbox client lookup hidden behind `getValidAccessToken()`. The codebase mixes TypeScript source files with checked-in JavaScript source duplicates under `src/`, and the test suite is largely shaped around those legacy auth and stdio assumptions.

## Entry flow

- `src/index.ts` boots `DbxServer` and connects it to `StdioServerTransport`
- `src/dbx-server.ts` constructs a low-level MCP `Server`, registers tools, resources, prompts, and dispatches tool calls with a large `switch`
- `src/dbx-api.ts` contains nearly all Dropbox operations plus safety logic, mime detection, formatting, and MCP response shaping
- `src/auth.ts` resolves tokens from `.tokens.json` or `DROPBOX_ACCESS_TOKEN`, refreshes tokens, performs OAuth code exchange, and persists updated token state
- `src/config.js` loads required auth env vars, decrypts secrets, configures Winston file logging, and sets delete safety defaults

## Auth and token model

The current implementation is incompatible with the mission architecture:

- Requires `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REDIRECT_URI`, and `TOKEN_ENCRYPTION_KEY`
- Supports Dropbox OAuth setup, PKCE, refresh-token rotation, and token refresh retries
- Stores encrypted token state in `.tokens.json`
- Can fall back to a process-wide `DROPBOX_ACCESS_TOKEN`
- Does not accept per-request Dropbox credentials over HTTP

## Tool surface

The current tool registry in `src/tool-definitions.ts` exposes a partial, legacy set of tools:

- `list_files`
- `upload_file`
- `download_file`
- `safe_delete_item`
- `delete_item`
- `create_folder`
- `copy_item`
- `move_item`
- `get_file_metadata`
- `search_file_db`
- `get_sharing_link`
- `get_account_info`
- `get_file_content`

Gaps relative to the mission include Streamable HTTP support, cursor continuation, batch operations, revisions and restore, temporary links, shared-link administration, space usage, and per-request path-root overrides.

## Resources and prompts

The repo includes a secondary prompt/resource subsystem that is not required for the Dropbox tool mission:

- `src/resource-handler.ts`
- `src/resource/`
- `src/prompt-handler.ts`
- `src/prompt-definitions.ts`
- `src/prompt-definitions/file-review-prompt.ts`
- `src/prompt-handlers/`
- `src/examples/resource-prompt-example.ts`

These modules are tightly coupled to the legacy `dbx-api.ts` response shapes and add extra maintenance surface unrelated to the target multi-tenant tool server.

## Source layout

### Main runtime files

- `src/index.ts`
- `src/dbx-server.ts`
- `src/dbx-api.ts`
- `src/tool-definitions.ts`
- `src/interfaces.ts`
- `src/config.js`
- `src/auth.ts`
- `src/security-utils.ts`

### Legacy setup and token management files

- `src/setup.ts`
- `src/setup.js`
- `src/create-tokens.ts`
- `src/exchange-code.ts`
- `src/generate-auth-url.ts`
- `src/reset-tokens.ts`
- `src/reset-tokens.js`
- `reset-tokens.sh`

### Checked-in JavaScript duplicates

- `src/auth.js`
- `src/config.mock.js`
- `src/security-utils.js`
- `src/setup.js`
- `src/reset-tokens.js`

The repository currently compiles with `"allowJs": true`, so these JS files participate in the TypeScript build even though they duplicate TS modules or exist only for test workarounds.

## Tests

The test suite is Jest-based and currently split across:

- Dropbox operation tests under `tests/dropbox/`
- A stdio integration-style test in `tests/dbx-operations.test.ts`
- Resource and prompt tests under `tests/resource/` and `tests/resource-system.test.ts`
- Jest-wide mocks in `tests/setup.ts` and `tests/mocks/`

Current issues:

- Tests assume stdio transport and single-process invocation
- Tests mock old module contracts such as `src/dbx-api.js`
- Tests do not cover the full Dropbox surface required by the mission
- Tests do not validate Streamable HTTP session flow, header auth, or per-request client creation

## Build and toolchain

### Runtime dependencies

| Package | Version |
| --- | --- |
| `@modelcontextprotocol/sdk` | `0.6.0` |
| `axios` | `^1.7.9` |
| `crypto-js` | `^4.2.0` |
| `dotenv` | `^16.4.7` |
| `dropbox` | `^10.34.0` |
| `httpx` | `^3.0.1` |
| `open` | `^10.1.0` |
| `winston` | `^3.17.0` |

### Dev dependencies

| Package | Version |
| --- | --- |
| `@babel/core` | `^7.26.9` |
| `@babel/plugin-proposal-class-properties` | `^7.18.6` |
| `@babel/plugin-syntax-import-meta` | `^7.10.4` |
| `@babel/plugin-transform-modules-commonjs` | `^7.26.3` |
| `@babel/plugin-transform-runtime` | `^7.26.9` |
| `@babel/preset-env` | `^7.26.9` |
| `@babel/preset-typescript` | `^7.26.0` |
| `@jest/globals` | `^29.7.0` |
| `@types/crypto-js` | `^4.2.2` |
| `@types/jest` | `^29.5.14` |
| `@types/node` | `^20.11.24` |
| `babel-jest` | `^29.7.0` |
| `jest` | `^29.7.0` |
| `jest-ts-webcompat-resolver` | `^1.0.0` |
| `ts-jest` | `^29.2.6` |
| `ts-node` | `^10.9.2` |
| `typescript` | `^5.3.3` |

## Notable mismatches with the target state

- Transport is stdio instead of Streamable HTTP
- Auth is server-managed and stateful instead of header-driven and request-scoped
- Logging writes to local files instead of structured JSON to stdout/stderr
- Error handling collapses Dropbox errors into generic MCP errors and hides `.tag` detail
- Validation is mostly ad hoc and not Zod-based
- The tool set is incomplete and some existing names do not match the required final surface
- The README and `.env.example` document a completely different operational model than the one required by the mission
