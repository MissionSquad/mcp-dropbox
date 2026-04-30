import { describe, expect, it } from 'vitest'

import { appConfig, getMcpEndpointUrl } from '../src/config.js'

describe('config', () => {
  it('builds the MCP endpoint URL from PUBLIC_BASE_URL and MCP_PATH', () => {
    expect(getMcpEndpointUrl().toString()).toBe(`${appConfig.publicBaseUrl}${appConfig.mcpPath}`)
  })

  it('uses the configured SQLite default path and OAuth defaults', () => {
    expect(appConfig.sqlitePath).toContain('mcp-dropbox.sqlite')
    expect(appConfig.oauthClientId).toBe('missionsquad-test-client')
    expect(appConfig.dropboxScopes.length).toBeGreaterThan(0)
  })
})
