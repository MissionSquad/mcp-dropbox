import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AppDatabase } from '../src/persistence/database.js'
import { OAuthClientsStore } from '../src/oauth/client-store.js'

const tempPaths: string[] = []

async function createTempDatabase(): Promise<AppDatabase> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-dropbox-dcr-'))
  const dbPath = path.join(tempDir, 'test.sqlite')
  tempPaths.push(tempDir)

  const database = new AppDatabase(dbPath, 'test-encryption-key')
  await database.init()
  return database
}

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map(async tempDir => {
      await fs.rm(tempDir, { recursive: true, force: true })
    })
  )
})

describe('OAuthClientsStore', () => {
  it('registers and reloads a dynamic client', async () => {
    const database = await createTempDatabase()

    try {
      const store = new OAuthClientsStore(database)
      const saved = await store.registerClient({
        client_id: 'dynamic-client-1',
        client_secret: 'dynamic-secret-1',
        client_id_issued_at: 1_700_000_000,
        client_secret_expires_at: 1_800_000_000,
        redirect_uris: ['https://example.com/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
        client_name: 'Dynamic Client',
        scope: 'mcp:tools'
      })

      expect(saved.client_id).toBe('dynamic-client-1')

      const loaded = await store.getClient('dynamic-client-1')
      expect(loaded).toEqual(saved)
    } finally {
      await database.close()
    }
  })
})

