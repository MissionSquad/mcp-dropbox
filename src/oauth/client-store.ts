import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'

import { appConfig } from '../config.js'
import type { AppDatabase } from '../persistence/database.js'

export class OAuthClientsStore implements OAuthRegisteredClientsStore {
  constructor(private readonly database: AppDatabase) {}

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    if (clientId !== appConfig.oauthClientId) {
      return this.database.getOauthClient(clientId)
    }

    return {
      client_id: appConfig.oauthClientId,
      client_secret: appConfig.oauthClientSecret,
      redirect_uris: appConfig.oauthRedirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'mcp:tools'
    }
  }

  async registerClient(client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'> | OAuthClientInformationFull): Promise<OAuthClientInformationFull> {
    const normalized = client as OAuthClientInformationFull
    return this.database.saveOauthClient(normalized)
  }
}
