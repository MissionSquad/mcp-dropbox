import { randomUUID, createHash } from 'node:crypto'
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js'

import { SecretEncryptor } from '../crypto/secret-encryptor.js'
import { logger } from '../logger.js'
import { SQLiteDatabase } from './sqlite.js'

export interface LinkedDropboxAccountRecord {
  id: string
  dropboxAccountId: string | null
  email: string | null
  encryptedRefreshToken: string
  encryptedAccessToken: string | null
  accessTokenExpiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BrowserSessionRecord {
  id: string
  linkedAccountId: string
  expiresAt: string
}

export interface AuthorizationCodeRecord {
  code: string
  clientId: string
  linkedAccountId: string
  redirectUri: string
  codeChallenge: string
  scopesJson: string
  resource: string | null
  state: string | null
  expiresAt: string
}

export interface McpRefreshTokenRecord {
  refreshTokenHash: string
  clientId: string
  linkedAccountId: string
  scopesJson: string
  resource: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface McpAccessTokenRecord {
  accessTokenHash: string
  clientId: string
  linkedAccountId: string
  scopesJson: string
  resource: string | null
  expiresAtEpochSeconds: number
  refreshTokenHash: string
  createdAt: string
}

export interface DropboxOauthStateRecord {
  state: string
  nextUrl: string
  expiresAt: string
}

export interface PersistedOauthClientRecord {
  clientId: string
  encryptedPayload: string
  createdAt: string
  updatedAt: string
}

export interface PersistedDropboxAuth {
  linkedAccountId: string
  dropboxAccountId?: string
  email?: string
  refreshToken: string
  accessToken?: string
  accessTokenExpiresAt?: Date
}

function nowIso(): string {
  return new Date().toISOString()
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export class AppDatabase {
  private readonly sqlite: SQLiteDatabase
  private readonly encryptor: SecretEncryptor

  constructor(filename: string, encryptionKey: string) {
    this.sqlite = new SQLiteDatabase(filename)
    this.encryptor = new SecretEncryptor(encryptionKey)
  }

  async init(): Promise<void> {
    await this.sqlite.open()
    await this.sqlite.exec('PRAGMA journal_mode = WAL;')
    await this.sqlite.exec('PRAGMA foreign_keys = ON;')

    await this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS linked_dropbox_accounts (
        id TEXT PRIMARY KEY,
        dropbox_account_id TEXT UNIQUE,
        email TEXT,
        encrypted_refresh_token TEXT NOT NULL,
        encrypted_access_token TEXT,
        access_token_expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS browser_sessions (
        id TEXT PRIMARY KEY,
        linked_account_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (linked_account_id) REFERENCES linked_dropbox_accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS authorization_codes (
        code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        linked_account_id TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        code_challenge TEXT NOT NULL,
        scopes_json TEXT NOT NULL,
        resource TEXT,
        state TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (linked_account_id) REFERENCES linked_dropbox_accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS mcp_refresh_tokens (
        refresh_token_hash TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        linked_account_id TEXT NOT NULL,
        scopes_json TEXT NOT NULL,
        resource TEXT,
        revoked_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (linked_account_id) REFERENCES linked_dropbox_accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS mcp_access_tokens (
        access_token_hash TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        linked_account_id TEXT NOT NULL,
        scopes_json TEXT NOT NULL,
        resource TEXT,
        expires_at_epoch_seconds INTEGER NOT NULL,
        refresh_token_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (linked_account_id) REFERENCES linked_dropbox_accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (refresh_token_hash) REFERENCES mcp_refresh_tokens(refresh_token_hash) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS dropbox_oauth_states (
        state TEXT PRIMARY KEY,
        next_url TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS oauth_clients (
        client_id TEXT PRIMARY KEY,
        encrypted_payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
  }

  async close(): Promise<void> {
    await this.sqlite.close()
  }

  async createDropboxOauthState(nextUrl: string, ttlMinutes = 10): Promise<string> {
    const state = randomUUID()
    const createdAt = nowIso()
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString()

    await this.sqlite.run(
      `INSERT INTO dropbox_oauth_states (state, next_url, expires_at, created_at) VALUES (?, ?, ?, ?)`,
      [state, nextUrl, expiresAt, createdAt]
    )

    return state
  }

  async getOauthClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const record = await this.sqlite.get<{
      client_id: string
      encrypted_payload: string
    }>(`SELECT client_id, encrypted_payload FROM oauth_clients WHERE client_id = ?`, [clientId])

    if (!record) {
      return undefined
    }

    return JSON.parse(this.encryptor.decrypt(record.encrypted_payload)) as OAuthClientInformationFull
  }

  async saveOauthClient(client: OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
    const createdAt = nowIso()
    const updatedAt = nowIso()
    const encryptedPayload = this.encryptor.encrypt(JSON.stringify(client))

    await this.sqlite.run(
      `
        INSERT INTO oauth_clients (
          client_id,
          encrypted_payload,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(client_id) DO UPDATE SET
          encrypted_payload = excluded.encrypted_payload,
          updated_at = excluded.updated_at
      `,
      [client.client_id, encryptedPayload, createdAt, updatedAt]
    )

    return client
  }

  async consumeDropboxOauthState(state: string): Promise<DropboxOauthStateRecord | null> {
    const record = await this.sqlite.get<{
      state: string
      next_url: string
      expires_at: string
    }>(
      `SELECT state, next_url, expires_at FROM dropbox_oauth_states WHERE state = ?`,
      [state]
    )

    if (!record) {
      return null
    }

    await this.sqlite.run(`DELETE FROM dropbox_oauth_states WHERE state = ?`, [state])

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      return null
    }

    return {
      state: record.state,
      nextUrl: record.next_url,
      expiresAt: record.expires_at
    }
  }

  async upsertLinkedDropboxAccount(input: {
    dropboxAccountId?: string
    email?: string
    refreshToken: string
    accessToken?: string
    accessTokenExpiresAt?: Date
  }): Promise<LinkedDropboxAccountRecord> {
    const existing = input.dropboxAccountId
      ? await this.sqlite.get<{
          id: string
          dropbox_account_id: string | null
          email: string | null
          encrypted_refresh_token: string
          encrypted_access_token: string | null
          access_token_expires_at: string | null
          created_at: string
          updated_at: string
        }>(
          `SELECT * FROM linked_dropbox_accounts WHERE dropbox_account_id = ?`,
          [input.dropboxAccountId]
        )
      : input.email
      ? await this.sqlite.get<{
          id: string
          dropbox_account_id: string | null
          email: string | null
          encrypted_refresh_token: string
          encrypted_access_token: string | null
          access_token_expires_at: string | null
          created_at: string
          updated_at: string
        }>(
          `SELECT * FROM linked_dropbox_accounts WHERE email = ?`,
          [input.email]
        )
      : undefined

    const id = existing?.id ?? randomUUID()
    const createdAt = existing?.created_at ?? nowIso()
    const updatedAt = nowIso()

    await this.sqlite.run(
      `
        INSERT INTO linked_dropbox_accounts (
          id,
          dropbox_account_id,
          email,
          encrypted_refresh_token,
          encrypted_access_token,
          access_token_expires_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          dropbox_account_id = excluded.dropbox_account_id,
          email = excluded.email,
          encrypted_refresh_token = excluded.encrypted_refresh_token,
          encrypted_access_token = excluded.encrypted_access_token,
          access_token_expires_at = excluded.access_token_expires_at,
          updated_at = excluded.updated_at
      `,
      [
        id,
        input.dropboxAccountId ?? existing?.dropbox_account_id ?? null,
        input.email ?? existing?.email ?? null,
        this.encryptor.encrypt(input.refreshToken),
        input.accessToken ? this.encryptor.encrypt(input.accessToken) : existing?.encrypted_access_token ?? null,
        input.accessTokenExpiresAt?.toISOString() ?? existing?.access_token_expires_at ?? null,
        createdAt,
        updatedAt
      ]
    )

    const saved = await this.getLinkedDropboxAccountById(id)

    if (!saved) {
      throw new Error('Failed to load persisted Dropbox account.')
    }

    return saved
  }

  async getLinkedDropboxAccountById(id: string): Promise<LinkedDropboxAccountRecord | null> {
    const record = await this.sqlite.get<{
      id: string
      dropbox_account_id: string | null
      email: string | null
      encrypted_refresh_token: string
      encrypted_access_token: string | null
      access_token_expires_at: string | null
      created_at: string
      updated_at: string
    }>(`SELECT * FROM linked_dropbox_accounts WHERE id = ?`, [id])

    if (!record) {
      return null
    }

    return {
      id: record.id,
      dropboxAccountId: record.dropbox_account_id,
      email: record.email,
      encryptedRefreshToken: record.encrypted_refresh_token,
      encryptedAccessToken: record.encrypted_access_token,
      accessTokenExpiresAt: record.access_token_expires_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    }
  }

  async getPersistedDropboxAuth(linkedAccountId: string): Promise<PersistedDropboxAuth | null> {
    const record = await this.getLinkedDropboxAccountById(linkedAccountId)

    if (!record) {
      return null
    }

    return {
      linkedAccountId: record.id,
      dropboxAccountId: record.dropboxAccountId ?? undefined,
      email: record.email ?? undefined,
      refreshToken: this.encryptor.decrypt(record.encryptedRefreshToken),
      accessToken: record.encryptedAccessToken ? this.encryptor.decrypt(record.encryptedAccessToken) : undefined,
      accessTokenExpiresAt: record.accessTokenExpiresAt ? new Date(record.accessTokenExpiresAt) : undefined
    }
  }

  async updatePersistedDropboxAuth(input: PersistedDropboxAuth): Promise<void> {
    const existing = await this.getLinkedDropboxAccountById(input.linkedAccountId)

    if (!existing) {
      throw new Error(`Linked Dropbox account ${input.linkedAccountId} not found`)
    }

    await this.sqlite.run(
      `
        UPDATE linked_dropbox_accounts
        SET
          dropbox_account_id = ?,
          email = ?,
          encrypted_refresh_token = ?,
          encrypted_access_token = ?,
          access_token_expires_at = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        input.dropboxAccountId ?? existing.dropboxAccountId,
        input.email ?? existing.email,
        this.encryptor.encrypt(input.refreshToken),
        input.accessToken ? this.encryptor.encrypt(input.accessToken) : null,
        input.accessTokenExpiresAt?.toISOString() ?? null,
        nowIso(),
        input.linkedAccountId
      ]
    )
  }

  async createBrowserSession(linkedAccountId: string, ttlHours: number): Promise<string> {
    const id = randomUUID()
    const createdAt = nowIso()
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString()

    await this.sqlite.run(
      `INSERT INTO browser_sessions (id, linked_account_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
      [id, linkedAccountId, expiresAt, createdAt]
    )

    return id
  }

  async getBrowserSession(sessionId: string): Promise<BrowserSessionRecord | null> {
    const record = await this.sqlite.get<{
      id: string
      linked_account_id: string
      expires_at: string
    }>(`SELECT * FROM browser_sessions WHERE id = ?`, [sessionId])

    if (!record) {
      return null
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await this.deleteBrowserSession(sessionId)
      return null
    }

    return {
      id: record.id,
      linkedAccountId: record.linked_account_id,
      expiresAt: record.expires_at
    }
  }

  async deleteBrowserSession(sessionId: string): Promise<void> {
    await this.sqlite.run(`DELETE FROM browser_sessions WHERE id = ?`, [sessionId])
  }

  async createAuthorizationCode(input: Omit<AuthorizationCodeRecord, 'expiresAt'> & { expiresAt: Date }): Promise<void> {
    await this.sqlite.run(
      `
        INSERT INTO authorization_codes (
          code,
          client_id,
          linked_account_id,
          redirect_uri,
          code_challenge,
          scopes_json,
          resource,
          state,
          expires_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.code,
        input.clientId,
        input.linkedAccountId,
        input.redirectUri,
        input.codeChallenge,
        input.scopesJson,
        input.resource,
        input.state,
        input.expiresAt.toISOString(),
        nowIso()
      ]
    )
  }

  async getAuthorizationCode(code: string): Promise<AuthorizationCodeRecord | null> {
    const record = await this.sqlite.get<{
      code: string
      client_id: string
      linked_account_id: string
      redirect_uri: string
      code_challenge: string
      scopes_json: string
      resource: string | null
      state: string | null
      expires_at: string
    }>(`SELECT * FROM authorization_codes WHERE code = ?`, [code])

    if (!record) {
      return null
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await this.sqlite.run(`DELETE FROM authorization_codes WHERE code = ?`, [code])
      return null
    }

    return {
      code: record.code,
      clientId: record.client_id,
      linkedAccountId: record.linked_account_id,
      redirectUri: record.redirect_uri,
      codeChallenge: record.code_challenge,
      scopesJson: record.scopes_json,
      resource: record.resource,
      state: record.state,
      expiresAt: record.expires_at
    }
  }

  async consumeAuthorizationCode(code: string): Promise<AuthorizationCodeRecord | null> {
    const record = await this.getAuthorizationCode(code)

    if (!record) {
      return null
    }

    await this.sqlite.run(`DELETE FROM authorization_codes WHERE code = ?`, [code])
    return record
  }

  async issueMcpTokens(input: {
    clientId: string
    linkedAccountId: string
    scopes: string[]
    resource?: string
    accessTokenTtlSeconds: number
  }): Promise<{
    accessToken: string
    refreshToken: string
    expiresIn: number
  }> {
    const accessToken = randomUUID()
    const refreshToken = randomUUID()
    const accessTokenHash = hashToken(accessToken)
    const refreshTokenHash = hashToken(refreshToken)
    const now = nowIso()
    const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + input.accessTokenTtlSeconds

    await this.sqlite.run(
      `
        INSERT INTO mcp_refresh_tokens (
          refresh_token_hash,
          client_id,
          linked_account_id,
          scopes_json,
          resource,
          revoked_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
      `,
      [
        refreshTokenHash,
        input.clientId,
        input.linkedAccountId,
        JSON.stringify(input.scopes),
        input.resource ?? null,
        now,
        now
      ]
    )

    await this.sqlite.run(
      `
        INSERT INTO mcp_access_tokens (
          access_token_hash,
          client_id,
          linked_account_id,
          scopes_json,
          resource,
          expires_at_epoch_seconds,
          refresh_token_hash,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        accessTokenHash,
        input.clientId,
        input.linkedAccountId,
        JSON.stringify(input.scopes),
        input.resource ?? null,
        expiresAtEpochSeconds,
        refreshTokenHash,
        now
      ]
    )

    return {
      accessToken,
      refreshToken,
      expiresIn: input.accessTokenTtlSeconds
    }
  }

  async exchangeMcpRefreshToken(input: {
    refreshToken: string
    clientId: string
    scopes?: string[]
    resource?: string
    accessTokenTtlSeconds: number
  }): Promise<{
    accessToken: string
    refreshToken: string
    scopes: string[]
    expiresIn: number
    linkedAccountId: string
  } | null> {
    const refreshTokenHash = hashToken(input.refreshToken)
    const record = await this.sqlite.get<{
      refresh_token_hash: string
      client_id: string
      linked_account_id: string
      scopes_json: string
      resource: string | null
      revoked_at: string | null
    }>(`SELECT * FROM mcp_refresh_tokens WHERE refresh_token_hash = ?`, [refreshTokenHash])

    if (!record || record.revoked_at) {
      return null
    }

    if (record.client_id !== input.clientId) {
      return null
    }

    const scopes = input.scopes && input.scopes.length > 0 ? input.scopes : JSON.parse(record.scopes_json) as string[]
    const resource = input.resource ?? record.resource ?? undefined
    const accessToken = randomUUID()
    const accessTokenHash = hashToken(accessToken)
    const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + input.accessTokenTtlSeconds

    await this.sqlite.run(
      `
        INSERT INTO mcp_access_tokens (
          access_token_hash,
          client_id,
          linked_account_id,
          scopes_json,
          resource,
          expires_at_epoch_seconds,
          refresh_token_hash,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        accessTokenHash,
        record.client_id,
        record.linked_account_id,
        JSON.stringify(scopes),
        resource ?? null,
        expiresAtEpochSeconds,
        refreshTokenHash,
        nowIso()
      ]
    )

    return {
      accessToken,
      refreshToken: input.refreshToken,
      scopes,
      expiresIn: input.accessTokenTtlSeconds,
      linkedAccountId: record.linked_account_id
    }
  }

  async verifyMcpAccessToken(accessToken: string): Promise<{
    clientId: string
    linkedAccountId: string
    scopes: string[]
    resource?: string
    expiresAtEpochSeconds: number
  } | null> {
    const accessTokenHash = hashToken(accessToken)
    const record = await this.sqlite.get<{
      client_id: string
      linked_account_id: string
      scopes_json: string
      resource: string | null
      expires_at_epoch_seconds: number
    }>(`SELECT client_id, linked_account_id, scopes_json, resource, expires_at_epoch_seconds FROM mcp_access_tokens WHERE access_token_hash = ?`, [
      accessTokenHash
    ])

    if (!record) {
      return null
    }

    return {
      clientId: record.client_id,
      linkedAccountId: record.linked_account_id,
      scopes: JSON.parse(record.scopes_json) as string[],
      resource: record.resource ?? undefined,
      expiresAtEpochSeconds: record.expires_at_epoch_seconds
    }
  }

  async revokeMcpToken(token: string): Promise<void> {
    const tokenHash = hashToken(token)

    await this.sqlite.run(`DELETE FROM mcp_access_tokens WHERE access_token_hash = ?`, [tokenHash])
    await this.sqlite.run(`UPDATE mcp_refresh_tokens SET revoked_at = ?, updated_at = ? WHERE refresh_token_hash = ?`, [
      nowIso(),
      nowIso(),
      tokenHash
    ])
  }

  async cleanupExpiredState(): Promise<void> {
    const now = nowIso()
    const nowEpochSeconds = Math.floor(Date.now() / 1000)

    await this.sqlite.run(`DELETE FROM dropbox_oauth_states WHERE expires_at <= ?`, [now])
    await this.sqlite.run(`DELETE FROM browser_sessions WHERE expires_at <= ?`, [now])
    await this.sqlite.run(`DELETE FROM authorization_codes WHERE expires_at <= ?`, [now])
    await this.sqlite.run(`DELETE FROM mcp_access_tokens WHERE expires_at_epoch_seconds <= ?`, [nowEpochSeconds])

    logger.debug('SQLite maintenance completed')
  }
}
