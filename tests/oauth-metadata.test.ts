import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'
import { createOAuthMetadata } from '@modelcontextprotocol/sdk/server/auth/router.js'

import { AppDatabase } from '../src/persistence/database.js'
import { DropboxMcpOAuthProvider } from '../src/oauth/provider.js'

const tempPaths: string[] = []

async function createTempProvider(): Promise<{ database: AppDatabase; provider: DropboxMcpOAuthProvider }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-dropbox-oauth-'))
  const dbPath = path.join(tempDir, 'test.sqlite')
  tempPaths.push(tempDir)

  const database = new AppDatabase(dbPath, 'test-encryption-key')
  await database.init()

  return {
    database,
    provider: new DropboxMcpOAuthProvider(database)
  }
}

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map(async tempDir => {
      await fs.rm(tempDir, { recursive: true, force: true })
    })
  )
})

describe('OAuth metadata', () => {
  it('advertises a registration endpoint when dynamic client registration is supported', async () => {
    const { database, provider } = await createTempProvider()

    try {
      const metadata = createOAuthMetadata({
        provider,
        issuerUrl: new URL('https://dropboxmcp.missionsquad.ai/'),
        resourceServerUrl: new URL('https://dropboxmcp.missionsquad.ai/mcp'),
        scopesSupported: ['mcp:tools']
      })

      expect(metadata.registration_endpoint).toBe('https://dropboxmcp.missionsquad.ai/register')
    } finally {
      await database.close()
    }
  })
})

